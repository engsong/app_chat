/**
 * Browser & Service Worker Notification Utility for IChat
 */

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

// Request Notification Permission
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const permission = await Notification.requestPermission();
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

  const notificationOptions = {
    body: options.body,
    icon: options.icon || '/logo.png',
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

// Show incoming call notification
export async function showCallNotification(options: {
  callerName: string;
  isVideo: boolean;
  callerAvatar?: string;
  onAnswer?: () => void;
  onDecline?: () => void;
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

  const title = options.isVideo
    ? `📹 Incoming Video Call`
    : `📞 Incoming Voice Call`;
  const body = `${options.callerName} is calling you... Tap to answer.`;

  // Continuous vibration for call
  if (navigator.vibrate) {
    try {
      navigator.vibrate([400, 200, 400, 200, 400]);
    } catch (_) {}
  }

  const notificationOptions = {
    body,
    icon: options.callerAvatar || '/logo.png',
    badge: '/logo.png',
    tag: 'incoming-call',
    requireInteraction: true, // Keep notification active until user acts
    renotify: true,
    data: {
      url: window.location.origin,
      type: 'call',
    },
  };

  try {
    if (swRegistration && 'showNotification' in swRegistration) {
      await swRegistration.showNotification(title, notificationOptions);
    } else if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      const reg = await navigator.serviceWorker.ready;
      await reg.showNotification(title, notificationOptions);
    } else {
      const notif = new Notification(title, notificationOptions);
      activeCallNotification = notif;
      notif.onclick = () => {
        window.focus();
        notif.close();
      };
    }
  } catch (err) {
    console.warn('[Notification] Error showing call notification:', err);
  }
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
