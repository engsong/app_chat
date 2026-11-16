import webpush from 'web-push';
import { store } from '../store.js';

export const VAPID_PUBLIC_KEY =
  process.env.VAPID_PUBLIC_KEY ||
  'BIlt8FQuOXc0JAYLqFtlAJpBQf6HZfaUEgXb5hYeeUUZkQxaELnYqcO89KrcnP28OUhlf2ufd-KRAyYGixKDrYg';
export const VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  'UWlG6zY-E6ZHBgVJVmo1UIdF-dxWU0PtQQaeerbS_XA';
export const VAPID_EMAIL =
  process.env.VAPID_EMAIL || 'mailto:admin@on-excapp.app';

try {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
} catch (err) {
  console.warn('[Push] Error initializing VAPID details:', err);
}

import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getMessaging, Message } from 'firebase-admin/messaging';
import fs from 'fs';
import path from 'path';

let firebaseInitialized = false;

function initFirebaseAdmin() {
  if (firebaseInitialized || getApps().length > 0) {
    firebaseInitialized = true;
    return true;
  }
  try {
    // Check possible locations for service account JSON
    const potentialPaths = [
      process.env.FIREBASE_SERVICE_ACCOUNT_PATH,
      path.join(process.cwd(), 'firebase-service-account.json'),
      path.join(process.cwd(), 'backend', 'firebase-service-account.json'),
      path.join(process.cwd(), 'service-account.json'),
    ].filter(Boolean) as string[];

    for (const p of potentialPaths) {
      if (fs.existsSync(p)) {
        const serviceAccount = JSON.parse(fs.readFileSync(p, 'utf8'));
        initializeApp({
          credential: cert(serviceAccount),
        });
        firebaseInitialized = true;
        console.log(`[FCM] Firebase Admin SDK initialized successfully with key file: ${p}`);
        return true;
      }
    }

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
      initializeApp({
        credential: cert(serviceAccount),
      });
      firebaseInitialized = true;
      console.log('[FCM] Firebase Admin SDK initialized successfully with environment variable');
      return true;
    }

    console.warn('[FCM] Notice: firebase-service-account.json not found. Native push notifications require Firebase Admin Service Account key.');
    return false;
  } catch (err: any) {
    console.warn('[FCM] Error initializing Firebase Admin SDK:', err.message || err);
    return false;
  }
}

// Automatically try initializing at startup
initFirebaseAdmin();

// Send native push to FCM device token via modern Firebase Admin SDK
async function sendToFcmToken(token: string, payload: { title: string; body: string; data?: any }) {
  if (!firebaseInitialized) {
    initFirebaseAdmin();
  }

  if (!firebaseInitialized) {
    console.warn(`[FCM] Cannot deliver push: Firebase Admin is not initialized. Please place firebase-service-account.json in the backend directory.`);
    return false;
  }

  try {
    // Convert all data dictionary values to strings as required by FCM HTTP v1 / Firebase Admin
    const stringifiedData: Record<string, string> = {};
    if (payload.data && typeof payload.data === 'object') {
      Object.entries(payload.data).forEach(([k, v]) => {
        stringifiedData[k] = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
      });
    }

    const message: Message = {
      token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: stringifiedData,
      android: {
        priority: 'high',
        notification: {
          channelId: 'ichat_notifications',
          sound: 'default',
          priority: 'high',
          visibility: 'public',
          clickAction: 'FLUTTER_NOTIFICATION_CLICK',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
            contentAvailable: true,
          },
        },
      },
    };

    const response = await getMessaging().send(message);
    console.log(`[FCM] High-priority native push sent successfully via Firebase Admin, messageId: ${response}`);
    return true;
  } catch (err: any) {
    console.warn(`[FCM] Error sending push to token ${token.substring(0, 12)}...:`, err.message || err);
    return false;
  }
}

export async function sendPushToUser(
  userId: string,
  payload: {
    title: string;
    body: string;
    icon?: string;
    tag?: string;
    data?: any;
    requireInteraction?: boolean;
  }
) {
  console.log(`[Push] Attempting to send push to user ${userId} (${payload.title})`);
  const subs = store.pushSubscriptions.get(userId);
  if (!subs || subs.length === 0) {
    console.warn(`[Push] User ${userId} has 0 push subscriptions registered. Push could not be sent.`);
    return;
  }

  const pushPayload = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || '/logo.png',
    badge: '/logo.png',
    tag: payload.tag || 'ichat-notification',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false,
  });

  const remainingSubs: any[] = [];
  for (const sub of subs) {
    try {
      if (sub.token || sub.type === 'fcm') {
        const token = sub.token || sub.pushToken;
        await sendToFcmToken(token, {
          title: payload.title,
          body: payload.body,
          data: payload.data,
        });
        remainingSubs.push(sub);
      } else if (sub.endpoint) {
        await webpush.sendNotification(sub, pushPayload);
        remainingSubs.push(sub);
        console.log(`[Push] Push notification delivered successfully to user ${userId}`);
      }
    } catch (err: any) {
      if (err.statusCode === 404 || err.statusCode === 410) {
        console.log(`[Push] Subscription expired/unregistered for user ${userId}`);
      } else {
        remainingSubs.push(sub);
        console.warn(`[Push] Push delivery note for user ${userId}:`, err.message);
      }
    }
  }

  if (remainingSubs.length !== subs.length) {
    store.pushSubscriptions.set(userId, remainingSubs);
    store.saveToFile();
  }
}
