package app.onexcapp.ichat;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        requestNotificationPermissions();
    }

    private void requestNotificationPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager notificationManager = getSystemService(NotificationManager.class);
            if (notificationManager == null) return;

            // 1. General Messages Channel
            String msgChannelId = "ichat_notifications";
            NotificationChannel msgChannel = new NotificationChannel(
                msgChannelId,
                "IChat Messages",
                NotificationManager.IMPORTANCE_HIGH
            );
            msgChannel.setDescription("New messages and chat updates");
            msgChannel.enableLights(true);
            msgChannel.enableVibration(true);
            msgChannel.setVibrationPattern(new long[]{0, 300, 150, 300});
            msgChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri msgSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            AudioAttributes msgAudio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_COMMUNICATION_INSTANT)
                .build();
            msgChannel.setSound(msgSoundUri, msgAudio);
            notificationManager.createNotificationChannel(msgChannel);

            // 2. Incoming Voice/Video Calls Channel (Louder & Ringtone sound)
            String callChannelId = "ichat_call_notifications";
            NotificationChannel callChannel = new NotificationChannel(
                callChannelId,
                "IChat Calls",
                NotificationManager.IMPORTANCE_HIGH
            );
            callChannel.setDescription("Incoming voice and video call alerts");
            callChannel.enableLights(true);
            callChannel.enableVibration(true);
            callChannel.setVibrationPattern(new long[]{0, 1000, 500, 1000, 500, 1000});
            callChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);

            Uri callSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            AudioAttributes callAudio = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();
            callChannel.setSound(callSoundUri, callAudio);
            notificationManager.createNotificationChannel(callChannel);
        }
    }
}
