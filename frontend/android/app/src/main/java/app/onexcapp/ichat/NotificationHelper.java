package app.onexcapp.ichat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;

public class NotificationHelper {
    public static final String CALL_CHANNEL_ID = "ichat_call_channel_v12";
    public static final String MSG_CHANNEL_ID = "ichat_message_channel_v12";

    public static void createChannels(Context context) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm == null) return;

            // Delete older channels so fresh high-importance settings take effect
            try {
                String[] oldChannels = {
                    "ichat_call_channel", "ichat_call_channel_v2", "ichat_call_channel_v3",
                    "ichat_call_channel_v4", "ichat_call_channel_v5", "ichat_call_channel_v6",
                    "ichat_call_channel_v7", "ichat_call_channel_v8", "ichat_call_channel_v9",
                    "ichat_call_channel_v10", "ichat_call_channel_v11",
                    "ichat_message_channel", "ichat_message_channel_v6"
                };
                for (String cId : oldChannels) {
                    nm.deleteNotificationChannel(cId);
                }
            } catch (Exception ignored) {}

            // 1. Incoming Calls Channel (IMPORTANCE_HIGH, Ringtone, Heads-up popup banner)
            NotificationChannel callChannel = new NotificationChannel(
                CALL_CHANNEL_ID,
                "IChat Incoming Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Full-screen and heads-up alerts for incoming voice and video calls");
            callChannel.setImportance(NotificationManager.IMPORTANCE_HIGH);
            callChannel.enableLights(true);
            callChannel.setLightColor(Color.GREEN);
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
            callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            callChannel.setBypassDnd(true);
            callChannel.setShowBadge(true);

            Uri callSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            AudioAttributes callAttr = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .setFlags(AudioAttributes.FLAG_AUDIBILITY_ENFORCED)
                .build();
            callChannel.setSound(callSound, callAttr);
            nm.createNotificationChannel(callChannel);

            // 2. Chat Messages Channel (IMPORTANCE_HIGH, Heads-up popup banner, Alert sound)
            NotificationChannel msgChannel = new NotificationChannel(
                MSG_CHANNEL_ID,
                "IChat Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("Instant pop-up alerts and sound for incoming messages");
            msgChannel.setImportance(NotificationManager.IMPORTANCE_HIGH);
            msgChannel.enableLights(true);
            msgChannel.setLightColor(Color.GREEN);
            msgChannel.enableVibration(true);
            msgChannel.setVibrationPattern(new long[]{0, 300, 150, 300});
            msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri msgSound = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes msgAttr = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            msgChannel.setSound(msgSound, msgAttr);
            nm.createNotificationChannel(msgChannel);
        }
    }
}
