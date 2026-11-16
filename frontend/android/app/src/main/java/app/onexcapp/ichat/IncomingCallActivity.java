package app.onexcapp.ichat;

import android.app.Activity;
import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.Ringtone;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.Vibrator;
import android.view.WindowManager;
import android.widget.ImageButton;
import android.widget.ImageView;
import android.widget.TextView;

public class IncomingCallActivity extends Activity {
    private Ringtone ringtone;
    private Vibrator vibrator;
    private Handler timeoutHandler = new Handler(Looper.getMainLooper());
    private Runnable timeoutRunnable;

    private String callId;
    private String from;
    private String callerName;
    private String callerAvatar;
    private boolean isVideo;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        wakeAndUnlock();
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_incoming_call);

        // Read intent extras
        Intent intent = getIntent();
        callId = intent.getStringExtra("callId");
        from = intent.getStringExtra("from");
        callerName = intent.getStringExtra("callerName");
        callerAvatar = intent.getStringExtra("callerAvatar");
        isVideo = "true".equalsIgnoreCase(intent.getStringExtra("isVideo"));

        TextView tvCallerName = findViewById(R.id.tv_caller_name);
        TextView tvCallType = findViewById(R.id.tv_call_type);
        ImageButton btnDecline = findViewById(R.id.btn_decline_call);
        ImageButton btnAccept = findViewById(R.id.btn_accept_call);

        if (callerName != null && !callerName.isEmpty()) {
            tvCallerName.setText(callerName);
        } else {
            tvCallerName.setText("IChat User");
        }

        tvCallType.setText(isVideo ? "Incoming Video Call..." : "Incoming Voice Call...");

        btnDecline.setOnClickListener(v -> declineCall());
        btnAccept.setOnClickListener(v -> acceptCall());

        startRingtoneAndVibration();

        // 60-second auto-timeout if no answer
        timeoutRunnable = this::declineCall;
        timeoutHandler.postDelayed(timeoutRunnable, 60000);
    }

    private void wakeAndUnlock() {
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
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            );
        } catch (Exception ignored) {}
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

    private void declineCall() {
        stopRingtoneAndVibration();
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }

        // Cancel status bar notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(IChatFirebaseMessagingService.CALL_NOTIFICATION_ID);
        }

        // Broadcast decline to CallActionReceiver
        Intent declineIntent = new Intent(this, CallActionReceiver.class);
        declineIntent.setAction(CallActionReceiver.ACTION_DECLINE_CALL);
        sendBroadcast(declineIntent);

        finish();
    }

    private void acceptCall() {
        stopRingtoneAndVibration();
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }

        // Cancel status bar notification
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm != null) {
            nm.cancel(IChatFirebaseMessagingService.CALL_NOTIFICATION_ID);
        }

        // Launch MainActivity and trigger answerCall in Webview
        Intent mainIntent = new Intent(this, MainActivity.class);
        mainIntent.addFlags(
            Intent.FLAG_ACTIVITY_NEW_TASK |
            Intent.FLAG_ACTIVITY_CLEAR_TOP |
            Intent.FLAG_ACTIVITY_SINGLE_TOP
        );
        mainIntent.putExtra("autoAcceptCall", true);
        mainIntent.putExtra("callId", callId);
        mainIntent.putExtra("from", from);
        mainIntent.putExtra("callerName", callerName);
        mainIntent.putExtra("callerAvatar", callerAvatar);
        mainIntent.putExtra("isVideo", isVideo ? "true" : "false");
        startActivity(mainIntent);

        finish();
    }

    @Override
    protected void onDestroy() {
        stopRingtoneAndVibration();
        if (timeoutHandler != null && timeoutRunnable != null) {
            timeoutHandler.removeCallbacks(timeoutRunnable);
        }
        super.onDestroy();
    }
}
