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
      path.join(process.cwd(), 'data', 'firebase-service-account.json'),
      '/app/data/firebase-service-account.json',
      path.join(process.cwd(), 'firebase-service-account.json'),
      '/app/firebase-service-account.json',
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
async function sendToFcmToken(token: string, payload: {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  silent?: boolean;
  data?: any;
}) {
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
      const senderOrCallerId = payload.data.senderId || payload.data.from || payload.data.userId || '';
      Object.entries(payload.data).forEach(([k, v]) => {
        let val = typeof v === 'object' ? JSON.stringify(v) : String(v ?? '');
        // FCM strictly limits total data payload to 4096 bytes (4KB).
        // Never put base64 data URLs into FCM push data!
        if (val.startsWith('data:')) {
          if (k.toLowerCase().includes('avatar') && senderOrCallerId) {
            val = `https://chat.on-excapp.app/api/users/${senderOrCallerId}/avatar`;
          } else {
            val = '';
          }
        } else if (val.length > 500) {
          val = val.substring(0, 500);
        }
        stringifiedData[k] = val;
      });
    }

    const isSilent = payload.silent === true || payload.data?.silent === 'true' || payload.data?.type === 'call_ended';
    const isIncomingCall = payload.data?.isIncomingCall === 'true';
    const channelId = 'ichat_message_channel_v12';

    stringifiedData.title = (payload.title || '').substring(0, 150);
    stringifiedData.body = (payload.body || '').substring(0, 300);
    stringifiedData.channelId = channelId;
    if (isSilent) {
      stringifiedData.silent = 'true';
    }
    if (!stringifiedData.type) {
      stringifiedData.type = isIncomingCall ? 'incoming_ringing' : 'chat';
    }

    // Safety check: ensure total data length is strictly well under 3500 bytes (FCM limit 4096 bytes)
    let payloadSize = JSON.stringify(stringifiedData).length;
    if (payloadSize > 3500) {
      console.warn(`[FCM] stringifiedData is large (${payloadSize} bytes), compressing fields...`);
      for (const k of Object.keys(stringifiedData)) {
        if (!['type', 'chatId', 'callId', 'from', 'senderId', 'title', 'body', 'channelId'].includes(k)) {
          if (stringifiedData[k].length > 100) {
            stringifiedData[k] = stringifiedData[k].substring(0, 100);
          }
        }
      }
    }

    const androidNotification: any = {
      channelId,
      priority: isSilent ? 'high' : 'max',
      visibility: 'public',
      defaultSound: !isSilent,
      defaultVibrateTimings: !isSilent,
      icon: 'ic_stat_ichat',
      color: isSilent ? '#ea0038' : '#25D366',
    };

    if (payload.tag) {
      androidNotification.tag = payload.tag;
    }

    if (!isSilent) {
      androidNotification.sound = 'default';
    }

    const apnsAps: any = {
      alert: {
        title: payload.title,
        body: payload.body,
      },
      badge: 1,
      contentAvailable: true,
    };

    if (!isSilent) {
      apnsAps.sound = 'default';
    }

    const message: any = {
      token,
      notification: {
        title: (payload.title || '').substring(0, 150),
        body: (payload.body || '').substring(0, 300),
      },
      data: stringifiedData,
      android: {
        priority: 'high',
        ttl: 60 * 1000,
        notification: androidNotification,
      },
      apns: {
        payload: {
          aps: apnsAps,
        },
      },
    };

    const response = await getMessaging().send(message);
    console.log(`[FCM] High-priority native push sent successfully via Firebase Admin (silent=${isSilent}), messageId: ${response}`);
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
    silent?: boolean;
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
    icon: (payload.icon && !payload.icon.startsWith('data:')) ? payload.icon : '/logo.png',
    badge: '/logo.png',
    tag: payload.tag || 'ichat-notification',
    data: payload.data || {},
    requireInteraction: payload.requireInteraction || false,
  });

  // Collect all unique FCM tokens from subscriptions AND device registrations
  const fcmTokens = new Set<string>();
  const webSubs: any[] = [];

  // 1. From pushSubscriptions
  for (const s of subs) {
    if (s.token || s.type === 'fcm') {
      const tok = s.token || s.pushToken;
      if (tok) fcmTokens.add(tok);
    } else if (s.endpoint) {
      webSubs.push(s);
    }
  }

  // 2. From registered devices in store
  for (const dev of store.devices.values()) {
    if (dev.userId === userId && dev.pushToken) {
      fcmTokens.add(dev.pushToken);
    }
  }

  console.log(`[Push] Dispatching push to user ${userId}: ${fcmTokens.size} native FCM token(s), ${webSubs.length} WebPush endpoint(s)`);

  // Send to all native FCM devices concurrently
  if (fcmTokens.size > 0) {
    await Promise.allSettled(
      Array.from(fcmTokens).map((tok) =>
        sendToFcmToken(tok, {
          title: payload.title,
          body: payload.body,
          icon: payload.icon,
          tag: payload.tag,
          silent: payload.silent,
          data: payload.data,
        })
      )
    );
  }

  // Send to WebPush subscriptions with timeout
  if (webSubs.length > 0) {
    await Promise.allSettled(
      webSubs.map(async (ws) => {
        try {
          await Promise.race([
            webpush.sendNotification(ws, pushPayload),
            new Promise((_, reject) => setTimeout(() => reject(new Error('WebPush timeout')), 4000)),
          ]);
          console.log(`[Push] Web push delivered to browser endpoint for user ${userId}`);
        } catch (err: any) {
          console.warn(`[Push] Web push notice for user ${userId}:`, err.message || err);
        }
      })
    );
  }
}
