/**
 * Browser & Service Worker Notification Utility for IChat
 */
import { Capacitor } from '@capacitor/core';
import { PushNotifications } from '@capacitor/push-notifications';

let swRegistration: ServiceWorkerRegistration | null = null;
let activeCallNotification: Notification | null = null;

// Register Service Worker
export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === 'undefined') return null;

  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      swRegistration = reg;
      console.log('[Notification] Service Worker registered successfully');
      return reg;
    } catch (err) {
      console.warn('[Notification] Service Worker registration failed:', err);
    }
  }
  return null;
}

// Request Notification Permission with legacy and modern browser callback fallback
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    let permission: NotificationPermission;
    const req = Notification.requestPermission();
    if (req && typeof (req as any).then === 'function') {
      permission = await req;
    } else {
      permission = await new Promise<NotificationPermission>((resolve) => {
        Notification.requestPermission((p) => resolve(p));
      });
    }
    console.log('[Notification] Permission result:', permission);
    return permission;
  } catch (err) {
    console.warn('[Notification] Failed to request permission:', err);
    return 'denied';
  }
}

export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe user device to background push notifications (Native FCM on mobile APK, Web Push in browser)
export async function subscribeUserToWebPush(userId: string, allowPrompt: boolean = true): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  // 1. If running as Native Mobile App (Capacitor Android APK) -> Use Native Firebase FCM!
  if (Capacitor.isNativePlatform()) {
    try {
      // 1. Remove old listeners
      await PushNotifications.removeAllListeners();

      // 2. Register listeners FIRST so no events are lost
      await PushNotifications.addListener('registration', async (token) => {
        console.log('[FCM] Native device token registered successfully:', token.value);
        try {
          await fetch('/api/devices/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId,
              pushToken: token.value,
              platform: Capacitor.getPlatform(),
              provider: 'FCM',
            }),
          });
          console.log('[FCM] Device token saved to server');
        } catch (e) {
          console.warn('[FCM] Error saving token to server:', e);
        }
      });

      await PushNotifications.addListener('registrationError', (err) => {
        console.error('[FCM] Native registration error:', err);
      });

      await PushNotifications.addListener('pushNotificationReceived', (notification) => {
        console.log('[FCM] Push notification received in foreground/background:', notification);
      });

      await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
        console.log('[FCM] Push notification tapped by user:', notification);
        const data = notification.notification?.data;
        if (data?.chatId && typeof window !== 'undefined') {
          window.location.hash = `#/chat/${data.chatId}`;
        }
      });

      // 3. Check and request notification permissions
      let permStatus = await PushNotifications.checkPermissions();
      if (permStatus.receive === 'prompt' && allowPrompt) {
        permStatus = await PushNotifications.requestPermissions();
      }

      if (permStatus.receive === 'granted') {
        // 4. Create high-importance Android notification channels for calls & messages
        try {
          await PushNotifications.createChannel({
            id: 'ichat_message_channel_v4',
            name: 'IChat Messages',
            description: 'Instant message alerts and notifications',
            importance: 5, // High importance (plays sound and pops up)
            visibility: 1, // Public (shows on lock screen)
            vibration: true,
            sound: 'default',
            lights: true,
            lightColor: '#25D366',
          });

          await PushNotifications.createChannel({
            id: 'ichat_call_channel_v4',
            name: 'IChat Incoming Calls',
            description: 'Incoming voice and video call alerts',
            importance: 5, // Max importance
            visibility: 1, // Public (shows on lock screen)
            vibration: true,
            sound: 'default',
            lights: true,
            lightColor: '#25D366',
          });
        } catch (chErr) {
          console.warn('[FCM] Channel creation note:', chErr);
        }

        // 5. Register with FCM/APNs to retrieve native token
        await PushNotifications.register();
        return true;
      }
    } catch (e) {
      console.warn('[FCM] Native push registration error:', e);
    }
    return false;
  }

  // 2. If running in Web Browser -> Use Service Worker Web Push
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return false;
  }

  let perm = Notification.permission;
  if (perm === 'default' && allowPrompt) {
    perm = await requestNotificationPermission();
  }

  if (perm !== 'granted') {
    return false;
  }

  try {
    const reg = swRegistration || (await navigator.serviceWorker.ready);
    if (!reg || !reg.pushManager) return false;

    // Fetch VAPID public key
    const res = await fetch('/api/push/vapid-public-key');
    if (!res.ok) return false;
    const { publicKey } = await res.json();
    if (!publicKey) return false;

    let sub = await reg.pushManager.getSubscription();
    if (!sub) {
      try {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      } catch (subErr) {
        console.warn('[Push] Direct subscribe failed, resetting old subscription:', subErr);
        const oldSub = await reg.pushManager.getSubscription();
        if (oldSub) await oldSub.unsubscribe().catch(() => {});
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(publicKey),
        });
      }
    }

    if (sub) {
      const subJson = sub.toJSON ? sub.toJSON() : JSON.parse(JSON.stringify(sub));
      const saveRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, subscription: subJson }),
      });
      if (saveRes.ok) {
        console.log('[Notification] Subscribed user to Web Push successfully');
        return true;
      }
    }
  } catch (err) {
    console.warn('[Notification] Failed to subscribe to Web Push:', err);
  }
  return false;
}

// Trigger immediate test push notification on user's device
export async function sendTestPushNotification(userId: string): Promise<boolean> {
  try {
    const res = await fetch('/api/push/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return res.ok;
  } catch (_) {
    return false;
  }
}

// Show message notification
export async function showMessageNotification(options: {
  title: string;
  body: string;
  icon?: string;
  chatId: string;
  onClick?: () => void;
}) {
  if (!isNotificationSupported()) return;

  if (Notification.permission !== 'granted') {
    if (Notification.permission === 'default') {
      const res = await requestNotificationPermission();
      if (res !== 'granted') return;
    } else {
      return;
    }
  }

  // Vibrate mobile device
  if (navigator.vibrate) {
    try {
      navigator.vibrate([100, 50, 100]);
    } catch (_) {}
  }

  const safeIcon = (options.icon && !options.icon.startsWith('data:')) ? options.icon : '/logo.png';

  const notificationOptions: any = {
    body: options.body,
    icon: safeIcon,
    badge: '/logo.png',
    tag: `chat-${options.chatId}`,
    renotify: true,
    data: {
      chatId: options.chatId,
      url: window.location.origin,
    },
  };

  try {
    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(options.title, notificationOptions);
    } else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(options.title, notificationOptions);
    } else {
      const notif = new Notification(options.title, notificationOptions);
      notif.onclick = () => {
        window.focus();
        if (options.onClick) options.onClick();
        notif.close();
      };
    }
  } catch (err) {
    console.warn('[Notification] Error showing message notification:', err);
  }
}

// Show incoming call notification - identical popup format to chat message notification
export async function showCallNotification(options: {
  callerName: string;
  isVideo: boolean;
  callerAvatar?: string;
  onAnswer?: () => void;
  onDecline?: () => void;
}) {
  const title = options.isVideo
    ? `📹 ${options.callerName}`
    : `📞 ${options.callerName}`;
  const body = `${options.isVideo ? '📹 Incoming Video Call' : '📞 Incoming Voice Call'} - Tap to answer`;

  return showMessageNotification({
    title,
    body,
    icon: options.callerAvatar,
    chatId: 'incoming-call',
    onClick: () => {
      window.focus();
      if (options.onAnswer) options.onAnswer();
    },
  });
}

// Close call notification when call answered, rejected, or timed out
export async function closeCallNotification() {
  if (activeCallNotification) {
    try {
      activeCallNotification.close();
      activeCallNotification = null;
    } catch (_) {}
  }

  if (swRegistration) {
    try {
      const notifications = await swRegistration.getNotifications({ tag: 'incoming-call' });
      notifications.forEach((n) => n.close());
    } catch (_) {}
  } else if ('serviceWorker' in navigator && navigator.serviceWorker.ready) {
    try {
      const reg = await navigator.serviceWorker.ready;
      const notifications = await reg.getNotifications({ tag: 'incoming-call' });
      notifications.forEach((n) => n.close());
    } catch (_) {}
  }
}
