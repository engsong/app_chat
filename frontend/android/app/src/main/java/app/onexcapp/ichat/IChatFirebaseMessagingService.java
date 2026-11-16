package app.onexcapp.ichat;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class IChatFirebaseMessagingService extends MessagingService {
    public static final int CALL_NOTIFICATION_ID = 1001;

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;

        boolean isCall = "call".equalsIgnoreCase(type) ||
            (remoteMessage.getNotification() != null &&
             remoteMessage.getNotification().getTitle() != null &&
             remoteMessage.getNotification().getTitle().toLowerCase().contains("call"));

        if (isCall) {
            handleIncomingCallPush(data);
        }
    }

    private void handleIncomingCallPush(Map<String, String> data) {
        // 1. Wake up the device screen immediately
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "ichat:incoming_call_wake"
                );
                wakeLock.acquire(25000); // 25 seconds wake lock
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Prepare Intent to launch MainActivity with full screen flags
        Intent fullScreenIntent = new Intent(this, MainActivity.class);
        fullScreenIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        fullScreenIntent.setAction("app.onexcapp.ichat.INCOMING_CALL");
        fullScreenIntent.putExtra("isIncomingCall", true);
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                fullScreenIntent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
            this,
            CALL_NOTIFICATION_ID,
            fullScreenIntent,
            flags
        );

        // 3. Prepare Decline Intent
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            this,
            CALL_NOTIFICATION_ID + 1,
            declineIntent,
            flags
        );

        String callerName = (data != null && data.get("callerName") != null) ? data.get("callerName") : "IChat User";
        boolean isVideo = data != null && "true".equalsIgnoreCase(data.get("isVideo"));
        String callType = isVideo ? "Video Call" : "Voice Call";

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        // 4. Build Notification with setFullScreenIntent
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, "ichat_call_notifications")
            .setSmallIcon(R.drawable.ic_stat_ichat)
            .setContentTitle("Incoming " + callType)
            .setContentText(callerName + " is calling you...")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setOngoing(true)
            .setSound(ringtoneUri)
            .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .addAction(android.R.drawable.ic_menu_close_clear_cancel, "Decline", declinePendingIntent)
            .addAction(android.R.drawable.ic_menu_call, "Answer", fullScreenPendingIntent);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(CALL_NOTIFICATION_ID, builder.build());
        }

        // 5. Also launch MainActivity directly over lock screen
        try {
            startActivity(fullScreenIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
