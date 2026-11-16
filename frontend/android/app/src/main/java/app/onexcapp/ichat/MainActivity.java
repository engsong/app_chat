package app.onexcapp.ichat;

import android.app.KeyguardManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        wakeAndUnlock();
        super.onCreate(savedInstanceState);
        NotificationHelper.createChannels(this);
        requestNotificationPermissions();
        checkOverlayPermission();
        handleCallIntent(getIntent());
    }

    @Override
    public void onStart() {
        super.onStart();
        wakeAndUnlock();
    }

    @Override
    public void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        wakeAndUnlock();
        handleCallIntent(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        wakeAndUnlock();
    }

    private void handleCallIntent(Intent intent) {
        if (intent == null) return;
        boolean autoAccept = intent.getBooleanExtra("autoAcceptCall", false);
        boolean isIncoming = intent.getBooleanExtra("isIncomingCall", false);

        if (autoAccept || isIncoming) {
            String callId = intent.getStringExtra("callId");
            String from = intent.getStringExtra("from");
            String callerName = intent.getStringExtra("callerName");
            boolean isVideo = "true".equalsIgnoreCase(intent.getStringExtra("isVideo"));

            new Handler(Looper.getMainLooper()).postDelayed(() -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js = String.format(
                            "window.__autoAcceptPendingCall = %b; " +
                            "window.dispatchEvent(new CustomEvent('native_call_event', { detail: { autoAccept: %b, callId: '%s', from: '%s', callerName: '%s', isVideo: %b } }));",
                            autoAccept, autoAccept,
                            callId != null ? callId : "",
                            from != null ? from : "",
                            callerName != null ? callerName : "",
                            isVideo
                        );
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception ignored) {}
            }, 1200);
        }
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

    private void requestNotificationPermissions() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }

    private void checkOverlayPermission() {
        try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                if (!Settings.canDrawOverlays(this)) {
                    // Guide user to allow draw over other apps for lock-screen incoming calls
                    Intent intent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())
                    );
                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(intent);
                }
            }
        } catch (Exception ignored) {}
    }
}
