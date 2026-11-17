package app.onexcapp.ichat;

import android.app.ActivityOptions;
import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.pm.ServiceInfo;
import android.graphics.Bitmap;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.IBinder;
import android.os.PowerManager;
import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.graphics.drawable.IconCompat;

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

        if (callerName == null || callerName.isEmpty()) {
            callerName = "IChat User";
        }
        String callType = isVideo ? "Video Call" : "Voice Call";

        // 3. Build Full Screen Intent targeting IncomingCallActivity
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        fullScreenIntent.setAction("app.onexcapp.ichat.INCOMING_CALL");
        fullScreenIntent.putExtra("isIncomingCall", true);
        fullScreenIntent.putExtra("callId", callId);
        fullScreenIntent.putExtra("from", from);
        fullScreenIntent.putExtra("callerName", callerName);
        fullScreenIntent.putExtra("callerAvatar", callerAvatar);
        fullScreenIntent.putExtra("isVideo", String.valueOf(isVideo));

        int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

        // Android 14+ (API 34+) explicit authorization to start activity from background
        Bundle activityOptionsBundle = null;
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                ActivityOptions options = ActivityOptions.makeBasic();
                options.setPendingIntentBackgroundActivityStartMode(ActivityOptions.MODE_BACKGROUND_ACTIVITY_START_ALLOWED);
                activityOptionsBundle = options.toBundle();
            } catch (Exception ignored) {}
        }

        PendingIntent fullScreenPendingIntent;
        if (activityOptionsBundle != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                NOTIFICATION_ID,
                fullScreenIntent,
                pFlags,
                activityOptionsBundle
            );
        } else {
            fullScreenPendingIntent = PendingIntent.getActivity(
                this,
                NOTIFICATION_ID,
                fullScreenIntent,
                pFlags
            );
        }

        // Decline Intent
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("from", from);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            this,
            NOTIFICATION_ID + 1,
            declineIntent,
            pFlags
        );

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        // 4. Build high-priority call notification with full-screen intent
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationHelper.CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_ichat)
            .setContentTitle(isVideo ? "Incoming Video Call" : "Incoming Voice Call")
            .setContentText(callerName + " is calling you...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setSound(ringtoneUri)
            .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(R.drawable.ic_call_decline, "Decline", declinePendingIntent)
            .addAction(R.drawable.ic_call_accept, "Answer", fullScreenPendingIntent);

        Notification notification = builder.build();

        // 5. Start Foreground Service immediately with phoneCall type
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

        // 6. Directly launch IncomingCallActivity over lock screen / home screen
        try {
            if (activityOptionsBundle != null) {
                startActivity(fullScreenIntent, activityOptionsBundle);
            } else {
                startActivity(fullScreenIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 7. Asynchronously fetch avatar icon to update notification without blocking main thread
        final String avatarToFetch = callerAvatar;
        new Thread(() -> {
            try {
                Bitmap bmp = IChatFirebaseMessagingService.fetchCircularBitmap(avatarToFetch);
                if (bmp != null) {
                    Notification updatedNotif = builder.setLargeIcon(bmp).build();
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
            }
        } catch (Exception ignored) {}

        try {
            stopForeground(true);
            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}

        stopSelf();
    }

    @Override
    public void onDestroy() {
        stopCall();
        super.onDestroy();
    }
}
