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
        // Ensure high-importance notification channels exist in this process
        NotificationHelper.createChannels(this);

        super.onMessageReceived(remoteMessage);

        Map<String, String> data = remoteMessage.getData();
        String type = data != null ? data.get("type") : null;
        String title = null;
        String body = null;

        if (remoteMessage.getNotification() != null) {
            title = remoteMessage.getNotification().getTitle();
            body = remoteMessage.getNotification().getBody();
        }
        if (title == null && data != null) {
            title = data.get("title");
        }
        if (body == null && data != null) {
            body = data.get("body");
        }

        boolean isCall = "call".equalsIgnoreCase(type) ||
            (title != null && title.toLowerCase().contains("call"));

        if (isCall) {
            handleIncomingCallPush(data, title, body);
        } else {
            handleChatMessagePush(title, body, data);
        }
    }

    private void handleChatMessagePush(String title, String body, Map<String, String> data) {
        try {
            // Wake up screen briefly (5 seconds) so user sees the notification pop up on lock screen
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "ichat:message_wake"
                );
                wakeLock.acquire(5000);
            }
        } catch (Exception ignored) {}

        Intent intent = new Intent(this, MainActivity.class);
        intent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        int flags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= PendingIntent.FLAG_IMMUTABLE;
        }

        int reqCode = (int) System.currentTimeMillis();
        PendingIntent pendingIntent = PendingIntent.getActivity(this, reqCode, intent, flags);

        Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationHelper.MSG_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_ichat)
            .setContentTitle(title != null && !title.isEmpty() ? title : "IChat Message")
            .setContentText(body != null ? body : "New message received")
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_MESSAGE)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(true)
            .setSound(soundUri)
            .setVibrate(new long[]{0, 300, 150, 300})
            .setContentIntent(pendingIntent);

        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.notify(reqCode, builder.build());
        }
    }

    private void handleIncomingCallPush(Map<String, String> data, String fallbackTitle, String fallbackBody) {
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
                wakeLock.acquire(30000); // 30 seconds wake lock for incoming call
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 2. Prepare Intent to launch native IncomingCallActivity with full screen flags
        Intent fullScreenIntent = new Intent(this, IncomingCallActivity.class);
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

        // 4. Build Notification with setFullScreenIntent launching IncomingCallActivity
        NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationHelper.CALL_CHANNEL_ID)
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
            .addAction(R.drawable.ic_call_decline, "Decline", declinePendingIntent)
            .addAction(R.drawable.ic_call_accept, "Answer", fullScreenPendingIntent);

        NotificationManager notificationManager = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager != null) {
            notificationManager.notify(CALL_NOTIFICATION_ID, builder.build());
        }

        // 5. Also launch native IncomingCallActivity directly over lock screen
        try {
            startActivity(fullScreenIntent);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
