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
      await webpush.sendNotification(sub, pushPayload);
      remainingSubs.push(sub);
      console.log(`[Push] Push notification delivered successfully to user ${userId}`);
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
