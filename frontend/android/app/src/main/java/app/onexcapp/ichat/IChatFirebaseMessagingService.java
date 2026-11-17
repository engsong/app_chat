package app.onexcapp.ichat;

import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.PowerManager;
import androidx.annotation.NonNull;
import androidx.core.app.NotificationCompat;
import androidx.core.app.Person;
import androidx.core.content.ContextCompat;
import androidx.core.graphics.drawable.IconCompat;
import com.capacitorjs.plugins.pushnotifications.MessagingService;
import com.google.firebase.messaging.RemoteMessage;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class IChatFirebaseMessagingService extends MessagingService {
    // In-memory message cache per chat/user so multiple messages list under one conversation card
    private static final Map<String, List<MessageRecord>> conversationCache = new ConcurrentHashMap<>();
    private static final ExecutorService networkExecutor = Executors.newCachedThreadPool();

    private static class MessageRecord {
        final String text;
        final long time;
        final String senderName;
        final String senderId;

        MessageRecord(String text, long time, String senderName, String senderId) {
            this.text = text;
            this.time = time;
            this.senderName = senderName;
            this.senderId = senderId;
        }
    }

    @Override
    public void onMessageReceived(@NonNull RemoteMessage remoteMessage) {
        // 1. Ensure notification channels exist in this process
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

    private void handleChatMessagePush(String fallbackTitle, String messageBody, Map<String, String> data) {
        // 1. Wake screen for 5 seconds so lock screen lights up with the card
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.SCREEN_BRIGHT_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "ichat:chat_wake"
                );
                wakeLock.acquire(5000);
            }
        } catch (Exception ignored) {}

        String chatId = data != null ? data.get("chatId") : null;
        String senderId = data != null ? data.get("senderId") : null;
        String senderName = data != null ? data.get("senderName") : null;
        String senderAvatar = data != null ? data.get("senderAvatar") : null;
        String chatName = data != null ? data.get("chatName") : null;
        boolean isGroup = data != null && "true".equalsIgnoreCase(data.get("isGroup"));

        if (senderName == null || senderName.isEmpty()) {
            senderName = (fallbackTitle != null && !fallbackTitle.isEmpty()) ? fallbackTitle : "IChat User";
        }
        if (messageBody == null || messageBody.isEmpty()) {
            messageBody = "New message";
        }

        final String finalSenderName = senderName;
        final String finalMessageBody = messageBody;
        final String conversationKey = (chatId != null && !chatId.isEmpty()) ? chatId : (senderId != null ? senderId : "default_chat");

        // Execute on background thread to download sender avatar and build MessagingStyle notification
        networkExecutor.execute(() -> {
            String avatarUrl = senderAvatar;
            if ((avatarUrl == null || avatarUrl.trim().isEmpty()) && senderId != null) {
                avatarUrl = "https://chat.on-excapp.app/api/users/" + senderId + "/avatar";
            }
            Bitmap avatarBitmap = fetchCircularBitmap(avatarUrl);
            IconCompat avatarIcon = avatarBitmap != null ? IconCompat.createWithBitmap(avatarBitmap) : null;

            // Sender Person
            Person.Builder personBuilder = new Person.Builder()
                .setName(finalSenderName)
                .setKey(senderId != null ? senderId : finalSenderName)
                .setImportant(true);
            if (avatarIcon != null) {
                personBuilder.setIcon(avatarIcon);
            }
            Person senderPerson = personBuilder.build();

            // Cache message under conversation key
            List<MessageRecord> records = conversationCache.computeIfAbsent(conversationKey, k -> Collections.synchronizedList(new ArrayList<>()));
            synchronized (records) {
                records.add(new MessageRecord(finalMessageBody, System.currentTimeMillis(), finalSenderName, senderId));
                if (records.size() > 7) {
                    records.remove(0);
                }
            }

            // Build MessagingStyle
            Person me = new Person.Builder().setName("Me").build();
            NotificationCompat.MessagingStyle messagingStyle = new NotificationCompat.MessagingStyle(me);
            if (isGroup && chatName != null && !chatName.isEmpty()) {
                messagingStyle.setConversationTitle(chatName);
                messagingStyle.setGroupConversation(true);
            }

            synchronized (records) {
                for (MessageRecord rec : records) {
                    messagingStyle.addMessage(rec.text, rec.time, senderPerson);
                }
            }

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

            int pFlags = PendingIntent.FLAG_UPDATE_CURRENT;
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                pFlags |= PendingIntent.FLAG_IMMUTABLE;
            }

            int notificationId = Math.abs(conversationKey.hashCode());
            PendingIntent pendingIntent = PendingIntent.getActivity(this, notificationId, intent, pFlags);

            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);

            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, NotificationHelper.MSG_CHANNEL_ID)
                .setSmallIcon(R.drawable.ic_stat_ichat) // Logo of app (renders as small badge at bottom-right of avatar)
                .setStyle(messagingStyle)
                .setPriority(NotificationCompat.PRIORITY_MAX)
                .setCategory(NotificationCompat.CATEGORY_MESSAGE)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setAutoCancel(true)
                .setSound(soundUri)
                .setVibrate(new long[]{0, 300, 150, 300})
                .setContentIntent(pendingIntent);

            if (avatarBitmap != null) {
                builder.setLargeIcon(avatarBitmap);
            }

            NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
            if (nm != null) {
                nm.notify(notificationId, builder.build());
            }
        });
    }

    public static Bitmap fetchCircularBitmap(String urlStr) {
        if (urlStr == null || urlStr.trim().isEmpty()) return null;
        try {
            if (urlStr.startsWith("data:image/")) {
                int comma = urlStr.indexOf(",");
                if (comma != -1) {
                    byte[] decoded = android.util.Base64.decode(urlStr.substring(comma + 1), android.util.Base64.DEFAULT);
                    Bitmap raw = BitmapFactory.decodeByteArray(decoded, 0, decoded.length);
                    if (raw != null) {
                        return toCircular(raw);
                    }
                }
                return null;
            }

            String fullUrl = urlStr;
            if (!fullUrl.startsWith("http://") && !fullUrl.startsWith("https://")) {
                fullUrl = "https://chat.on-excapp.app" + (fullUrl.startsWith("/") ? "" : "/") + fullUrl;
            }
            URL url = new URL(fullUrl);
            HttpURLConnection conn = (HttpURLConnection) url.openConnection();
            conn.setConnectTimeout(3000);
            conn.setReadTimeout(3000);
            conn.setDoInput(true);
            conn.connect();
            InputStream is = conn.getInputStream();
            Bitmap raw = BitmapFactory.decodeStream(is);
            is.close();
            if (raw == null) return null;

            return toCircular(raw);
        } catch (Exception e) {
            return null;
        }
    }

    private static Bitmap toCircular(Bitmap raw) {
        int dim = Math.min(raw.getWidth(), raw.getHeight());
        Bitmap output = Bitmap.createBitmap(dim, dim, Bitmap.Config.ARGB_8888);
        Canvas canvas = new Canvas(output);
        Paint paint = new Paint();
        paint.setAntiAlias(true);
        paint.setShader(new BitmapShader(raw, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
        float r = dim / 2f;
        canvas.drawCircle(r, r, r, paint);
        return output;
    }
}
