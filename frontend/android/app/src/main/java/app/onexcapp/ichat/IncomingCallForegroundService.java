package app.onexcapp.ichat;

import android.app.ActivityOptions;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;

public class IncomingCallForegroundService extends Service {
    public static final String ACTION_START_CALL = "app.onexcapp.ichat.ACTION_START_CALL";
    public static final String ACTION_STOP_CALL = "app.onexcapp.ichat.ACTION_STOP_CALL";
    public static final int NOTIFICATION_ID = 1001;

    private PowerManager.WakeLock wakeLock;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (intent == null) {
            stopSelf();
            return START_NOT_STICKY;
        }

        String action = intent.getAction();
        if (ACTION_STOP_CALL.equals(action)) {
            stopCall();
            return START_NOT_STICKY;
        }

        // 1. Acquire WakeLock to wake up screen immediately
        acquireWakeLock();

        // 2. Extract call metadata
        String callId = intent.getStringExtra("callId");
        String from = intent.getStringExtra("from");
        String callerName = intent.getStringExtra("callerName");
        String callerAvatar = intent.getStringExtra("callerAvatar");
        boolean isVideo = "true".equalsIgnoreCase(intent.getStringExtra("isVideo"));
        String chatId = intent.getStringExtra("chatId");
        boolean isGroup = "true".equalsIgnoreCase(intent.getStringExtra("isGroup"));

        // 3. Build notification using unified NotificationHelper
        Notification notification = NotificationHelper.buildCallNotification(
            this, callId, from, callerName, callerAvatar, isVideo, chatId, isGroup, null
        );

        // 4. Start Foreground Service immediately
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                int serviceType = ServiceInfo.FOREGROUND_SERVICE_TYPE_PHONE_CALL;
                startForeground(NOTIFICATION_ID, notification, serviceType);
            } else {
                startForeground(NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
            try {
                startForeground(NOTIFICATION_ID, notification);
            } catch (Exception ignored) {}
        }

        // Also post via NotificationManager to ensure heads-up visibility
        try {
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(NOTIFICATION_ID, notification);
            }
        } catch (Exception ignored) {}

        // 5. Try launching IncomingCallActivity directly as well
        try {
            Intent callIntent = new Intent(this, IncomingCallActivity.class);
            callIntent.addFlags(
                Intent.FLAG_ACTIVITY_NEW_TASK |
                Intent.FLAG_ACTIVITY_CLEAR_TOP |
                Intent.FLAG_ACTIVITY_SINGLE_TOP |
                Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
            );
            callIntent.setAction("app.onexcapp.ichat.INCOMING_CALL");
            callIntent.putExtra("isIncomingCall", true);
            callIntent.putExtra("callId", callId);
            callIntent.putExtra("from", from);
            callIntent.putExtra("callerName", callerName);
            callIntent.putExtra("callerAvatar", callerAvatar);
            callIntent.putExtra("isVideo", String.valueOf(isVideo));
            callIntent.putExtra("chatId", chatId);
            callIntent.putExtra("isGroup", isGroup ? "true" : "false");

            Bundle activityOptionsBundle = null;
            if (Build.VERSION.SDK_INT >= 34) {
                ActivityOptions options = ActivityOptions.makeBasic();
                options.setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
                activityOptionsBundle = options.toBundle();
            }

            if (activityOptionsBundle != null) {
                startActivity(callIntent, activityOptionsBundle);
            } else {
                startActivity(callIntent);
            }
        } catch (Exception ignored) {}

        // 6. Asynchronously fetch avatar icon to update notification
        final String avatarToFetch = callerAvatar;
        final String finalCallerName = callerName;
        final String finalCallId = callId;
        final String finalFrom = from;
        final String finalChatId = chatId;
        final boolean finalIsGroup = isGroup;
        final boolean finalIsVideo = isVideo;

        new Thread(() -> {
            try {
                Bitmap bmp = IChatFirebaseMessagingService.fetchCircularBitmap(avatarToFetch);
                if (bmp != null) {
                    Notification updatedNotif = NotificationHelper.buildCallNotification(
                        this, finalCallId, finalFrom, finalCallerName, avatarToFetch, finalIsVideo, finalChatId, finalIsGroup, bmp
                    );
                    NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                    if (nm != null) {
                        nm.notify(NOTIFICATION_ID, updatedNotif);
                    }
                }
            } catch (Exception ignored) {}
        }).start();

        return START_NOT_STICKY;
    }

    private void acquireWakeLock() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "ichat:foreground_call_wake"
                );
                wakeLock.acquire(45000); // 45s wake lock for call ring
            }
        } catch (Exception e) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && (wakeLock == null || !wakeLock.isHeld())) {
                    wakeLock = pm.newWakeLock(
                        PowerManager.PARTIAL_WAKE_LOCK |
                        PowerManager.ACQUIRE_CAUSES_WAKEUP |
                        PowerManager.ON_AFTER_RELEASE,
                        "ichat:foreground_call_wake_partial"
                    );
                    wakeLock.acquire(45000);
                }
            } catch (Exception ignored) {}
        }
    }

    private void stopCall() {
        try {
            if (wakeLock != null && wakeLock.isHeld()) {
                wakeLock.release();
                wakeLock = null;
            }
        } catch (Exception ignored) {}

        try {
            stopForeground(true);
        } catch (Exception ignored) {}

        NotificationHelper.cancelCallNotification(this);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopCall();
        super.onDestroy();
    }
}
