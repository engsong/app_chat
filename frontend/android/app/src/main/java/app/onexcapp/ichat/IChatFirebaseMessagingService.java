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
import androidx.core.content.ContextCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.util.Map;

public class IChatFirebaseMessagingService extends MessagingService {

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // 1. Ensure high-importance notification channels exist in this process
        NotificationHelper.createChannels(this);

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

        // If call was ended or cancelled by caller, immediately dismiss incoming call screen & sound
        if ("call_ended".equalsIgnoreCase(type) || "call_cancelled".equalsIgnoreCase(type)) {
            Intent stopIntent = new Intent(this, IncomingCallForegroundService.class);
            stopIntent.setAction(IncomingCallForegroundService.ACTION_STOP_CALL);
            startService(stopIntent);
            return;
        }

        boolean isCall = "call".equalsIgnoreCase(type) ||
            (title != null && title.toLowerCase().contains("call"));

        if (isCall) {
            handleIncomingCallPush(data);
        } else {
            // Only pass normal chat messages to Capacitor push plugin
            super.onMessageReceived(remoteMessage);
            handleChatMessagePush(title, body, data);
        }
    }

    private void handleIncomingCallPush(Map<String, String> data) {
        // 1. Wake screen immediately with high-priority WakeLock
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "ichat:fcm_call_wake"
                );
                wakeLock.acquire(30000);
            }
        } catch (Exception ignored) {}

        // 2. Prepare intent targeting IncomingCallActivity
        Intent callIntent = new Intent(this, IncomingCallActivity.class);
        callIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        callIntent.setAction("app.onexcapp.ichat.INCOMING_CALL");
        callIntent.putExtra("isIncomingCall", true);
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                callIntent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        // 3. Start IncomingCallForegroundService with phoneCall serviceType
        Intent serviceIntent = new Intent(this, IncomingCallForegroundService.class);
        serviceIntent.setAction(IncomingCallForegroundService.ACTION_START_CALL);
        if (data != null) {
            for (Map.Entry<String, String> entry : data.entrySet()) {
                serviceIntent.putExtra(entry.getKey(), entry.getValue());
            }
        }

        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                ContextCompat.startForegroundService(this, serviceIntent);
            } else {
                startService(serviceIntent);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }

        // 4. Also launch activity directly as backup
        try {
            startActivity(callIntent);
        } catch (Exception ignored) {}
    }

    private void handleChatMessagePush(String title, String body, Map<String, String> data) {
        try {
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
}
