package app.onexcapp.ichat;

import android.app.Activity;
import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.BitmapShader;
import android.graphics.Canvas;
import android.graphics.Paint;
import android.graphics.Shader;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.view.View;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;

public class IncomingCallActivity extends Activity {
    private Ringtone ringtone;
    private Vibrator vibrator;
    private Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable;
    private ExecutorService imageExecutor = Executors.newSingleThreadExecutor();

    private String callId;
    private String from;
    private String callerName;
    private String callerAvatar;
    private boolean isVideo;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Turn screen on and show on top of keyguard / lock screen
        setupLockScreenFlags();

        setContentView(R.layout.activity_incoming_call);

        // Read intent extras
        Intent intent = getIntent();
        if (intent != null) {
            callId = intent.getStringExtra("callId");
            from = intent.getStringExtra("from");
            callerName = intent.getStringExtra("callerName");
            callerAvatar = intent.getStringExtra("callerAvatar");
            isVideo = "true".equalsIgnoreCase(intent.getStringExtra("isVideo"));
        }

        TextView tvCallHeader = findViewById(R.id.tv_call_header);
        TextView tvCallerName = findViewById(R.id.tv_caller_name);
        TextView tvCallType = findViewById(R.id.tv_call_type);
        ImageView ivCallerAvatar = findViewById(R.id.iv_caller_avatar);
        ImageView ivBlurredBackdrop = findViewById(R.id.iv_blurred_backdrop);
        ImageButton btnDecline = findViewById(R.id.btn_decline_call);
        ImageButton btnAccept = findViewById(R.id.btn_accept_call);
        View llSwipeAnswer = findViewById(R.id.ll_swipe_answer);

        tvCallHeader.setText(isVideo ? "ICHAT VIDEO CALL" : "ICHAT VOICE CALL");

        if (callerName != null && !callerName.isEmpty()) {
            tvCallerName.setText(callerName);
        } else {
            tvCallerName.setText("IChat User");
        }

        tvCallType.setText(isVideo ? "Incoming Video Call..." : "Incoming Voice Call...");

        // Load caller avatar async from URL
        loadCallerAvatar(callerAvatar, ivCallerAvatar, ivBlurredBackdrop);

        btnDecline.setOnClickListener(v -> declineCall());
        btnAccept.setOnClickListener(v -> acceptCall());
        if (llSwipeAnswer != null) {
            llSwipeAnswer.setOnClickListener(v -> acceptCall());
        }

        startRingtoneAndVibration();

        // 60-second auto-timeout if no answer
        timeoutRunnable = this::declineCall;
        timeoutHandler.postDelayed(timeoutRunnable, 60000);
    }

    @Override
    public void onAttachedToWindow() {
        super.onAttachedToWindow();
        setupLockScreenFlags();
    }

    @Override
    protected void onResume() {
        super.onResume();
        setupLockScreenFlags();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        setupLockScreenFlags();
    }

    private void setupLockScreenFlags() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
                setShowWhenLocked(true);
                setTurnScreenOn(true);
                KeyguardManager km = (KeyguardManager) getSystemService(Context.KEYGUARD_SERVICE);
                if (km != null) {
                    km.requestDismissKeyguard(this, null);
                }
            }
            getWindow().addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED |
                WindowManager.LayoutParams.FLAG_DISMISS_KEYGUARD |
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
            );
        } catch (Exception ignored) {}
    }

    private void loadCallerAvatar(String avatarUrl, ImageView ivAvatar, ImageView ivBackdrop) {
        if (avatarUrl == null || avatarUrl.trim().isEmpty()) {
            return;
        }

        final String finalUrl;
        if (!avatarUrl.startsWith("http://") && !avatarUrl.startsWith("https://")) {
            finalUrl = "https://chat.on-excapp.app" + (avatarUrl.startsWith("/") ? "" : "/") + avatarUrl;
        } else {
            finalUrl = avatarUrl;
        }

        imageExecutor.execute(() -> {
            try {
                URL url = new URL(finalUrl);
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setDoInput(true);
                connection.setConnectTimeout(6000);
                connection.setReadTimeout(6000);
                connection.connect();
                InputStream input = connection.getInputStream();
                Bitmap bitmap = BitmapFactory.decodeStream(input);
                if (bitmap != null) {
                    Bitmap circular = getCircularBitmap(bitmap);
                    new Handler(Looper.getMainLooper()).post(() -> {
                        if (ivAvatar != null) {
                            ivAvatar.setImageBitmap(circular);
                        }
                        if (ivBackdrop != null) {
                            ivBackdrop.setImageBitmap(bitmap);
                        }
                    });
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        });
    }

    private Bitmap getCircularBitmap(Bitmap bitmap) {
        try {
            int size = Math.min(bitmap.getWidth(), bitmap.getHeight());
            Bitmap output = Bitmap.createBitmap(size, size, Bitmap.Config.ARGB_8888);
            Canvas canvas = new Canvas(output);
            Paint paint = new Paint();
            paint.setAntiAlias(true);
            paint.setShader(new BitmapShader(bitmap, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP));
            float r = size / 2f;
            canvas.drawCircle(r, r, r, paint);
            return output;
        } catch (Exception e) {
            return bitmap;
        }
    }

    private void startRingtoneAndVibration() {
        try {
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            ringtone = RingtoneManager.getRingtone(this, ringtoneUri);
            if (ringtone != null) {
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.LOLLIPOP) {
                    AudioAttributes audioAttributes = new AudioAttributes.Builder()
                        .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                        .build();
                    ringtone.setAudioAttributes(audioAttributes);
                }
                ringtone.play();
            }

            vibrator = (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
            if (vibrator != null) {
                long[] pattern = {0, 1000, 600, 1000, 600, 1000};
                vibrator.vibrate(pattern, 0); // 0 = repeat
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
    }

    private void stopRingtoneAndVibration() {
        try {
            if (ringtone != null && ringtone.isPlaying()) {
                ringtone.stop();
            }
            if (vibrator != null) {
                vibrator.cancel();
            }
        } catch (Exception ignored) {}
    }

    private void stopForegroundCallService() {
        try {
            Intent stopIntent = new Intent(this, IncomingCallForegroundService.class);
            stopIntent.setAction(IncomingCallForegroundService.ACTION_STOP_CALL);
            startService(stopIntent);
        } catch (Exception ignored) {}
    }

    private void declineCall() {
        stopRingtoneAndVibration();
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }

        stopForegroundCallService();

        // Broadcast decline to CallActionReceiver
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        declineIntent.putExtra("callId", callId);
        declineIntent.putExtra("from", from);
        sendBroadcast(declineIntent);

        finish();
    }

    private void acceptCall() {
        stopRingtoneAndVibration();
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }

        stopForegroundCallService();

        // Launch MainActivity with auto-accept trigger to start WebRTC session instantly
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP |
            Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
        );
        mainIntent.putExtra("autoAcceptCall", true);
        mainIntent.putExtra("isIncomingCall", true);
        mainIntent.putExtra("callId", callId);
        mainIntent.putExtra("from", from);
        mainIntent.putExtra("callerName", callerName);
        mainIntent.putExtra("callerAvatar", callerAvatar);
        mainIntent.putExtra("isVideo", String.valueOf(isVideo));

        startActivity(mainIntent);
        finish();
    }

    @Override
    protected void onDestroy() {
        stopRingtoneAndVibration();
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }
        if (imageExecutor != null && !imageExecutor.isShutdown()) {
            imageExecutor.shutdown();
        }
        super.onDestroy();
    }
}
