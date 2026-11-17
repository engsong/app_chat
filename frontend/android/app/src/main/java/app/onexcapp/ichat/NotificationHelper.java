package app.onexcapp.ichat;

import android.app.ActivityOptions;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Color;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;

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

    public static Notification buildCallNotification(
        Context context,
        String callId,
        String from,
        String callerName,
        String callerAvatar,
        boolean isVideo,
        String chatId,
        boolean isGroup,
        Bitmap avatarBitmap
    ) {
        createChannels(context);

        if (callerName == null || callerName.isEmpty()) {
            callerName = isGroup ? "Group Call" : "IChat User";
        }
        String callTypeTitle = (isGroup ? "Group " : "") + (isVideo ? "Incoming Video Call" : "Incoming Voice Call");
        String callTypeDesc = callerName + " is calling you...";

        // 1. PendingIntent targeting IncomingCallActivity (Full-Screen & Tap Action)
        Intent fullScreenIntent = new Intent(context, IncomingCallActivity.class);
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
        fullScreenIntent.putExtra("chatId", chatId);
        fullScreenIntent.putExtra("isGroup", String.valueOf(isGroup));

        int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            pFlags |= PendingIntent.FLAG_IMMUTABLE;
        }

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
            fullScreenPendingIntent = PendingIntent.getActivity(context, IncomingCallForegroundService.NOTIFICATION_ID, fullScreenIntent, pFlags, activityOptionsBundle);
        } else {
            fullScreenPendingIntent = PendingIntent.getActivity(context, IncomingCallForegroundService.NOTIFICATION_ID, fullScreenIntent, pFlags);
        }

        // 2. Decline PendingIntent (Broadcast to CallActionReceiver)
        Intent declineIntent = new Intent(context, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("from", from);
        PendingIntent declinePendingIntent = PendingIntent.getBroadcast(
            context,
            IncomingCallForegroundService.NOTIFICATION_ID + 1,
            declineIntent,
            pFlags
        );

        // 3. Answer PendingIntent (Directly open MainActivity to accept call)
        Intent answerIntent = new Intent(context, MainActivity.class);
        answerIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        answerIntent.putExtra("autoAcceptCall", true);
        answerIntent.putExtra("isIncomingCall", true);
        answerIntent.putExtra("callId", callId);
        answerIntent.putExtra("from", from);
        answerIntent.putExtra("callerName", callerName);
        answerIntent.putExtra("callerAvatar", callerAvatar);
        answerIntent.putExtra("isVideo", String.valueOf(isVideo));
        answerIntent.putExtra("chatId", chatId);
        answerIntent.putExtra("isGroup", isGroup ? "true" : "false");

        PendingIntent answerPendingIntent;
        if (activityOptionsBundle != null && Build.VERSION.SDK_INT >= Build.VERSION_CODES.JELLY_BEAN) {
            answerPendingIntent = PendingIntent.getActivity(context, IncomingCallForegroundService.NOTIFICATION_ID + 2, answerIntent, pFlags, activityOptionsBundle);
        } else {
            answerPendingIntent = PendingIntent.getActivity(context, IncomingCallForegroundService.NOTIFICATION_ID + 2, answerIntent, pFlags);
        }

        Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);

        Person callerPerson = new Person.Builder()
            .setName(callerName)
            .setImportant(true)
            .build();

        NotificationCompat.Builder builder = new NotificationCompat.Builder(context, CALL_CHANNEL_ID)
            .setSmallIcon(R.drawable.ic_stat_ichat)
            .setContentTitle(callerName)
            .setContentText(callTypeDesc)
            .setSubText(callTypeTitle)
            .setPriority(NotificationCompat.PRIORITY_MAX)
            .setCategory(NotificationCompat.CATEGORY_CALL)
            .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
            .setAutoCancel(false)
            .setOngoing(true)
            .setSound(ringtoneUri)
            .setVibrate(new long[]{0, 1000, 500, 1000, 500, 1000})
            .setContentIntent(fullScreenPendingIntent)
            .setFullScreenIntent(fullScreenPendingIntent, true)
            .setStyle(
                NotificationCompat.CallStyle.forIncomingCall(callerPerson, declinePendingIntent, answerPendingIntent)
                    .setIsVideo(isVideo)
            )
            .addAction(R.drawable.ic_call_decline, "Decline", declinePendingIntent)
            .addAction(R.drawable.ic_call_accept, "Answer", answerPendingIntent);

        if (avatarBitmap != null) {
            builder.setLargeIcon(avatarBitmap);
        }

        return builder.build();
    }

    public static void showCallNotification(
        Context context,
        String callId,
        String from,
        String callerName,
        String callerAvatar,
        boolean isVideo,
        String chatId,
        boolean isGroup,
        Bitmap avatarBitmap
    ) {
        try {
            Notification notification = buildCallNotification(
                context, callId, from, callerName, callerAvatar, isVideo, chatId, isGroup, avatarBitmap
            );
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(IncomingCallForegroundService.NOTIFICATION_ID, notification);
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    public static void cancelCallNotification(Context context) {
        try {
            NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.cancel(IncomingCallForegroundService.NOTIFICATION_ID);
            }
        } catch (Exception ignored) {}
    }
}
