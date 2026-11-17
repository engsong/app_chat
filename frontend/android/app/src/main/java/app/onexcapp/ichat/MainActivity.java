package app.onexcapp.ichat;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        wakeAndUnlock();
        super.onCreate(savedInstanceState);
        NotificationHelper.createChannels(this);
        checkAllRequiredPermissions();
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
        checkAllRequiredPermissions();
    }

    @Override
    public void onBackPressed() {
        if (getBridge() != null && getBridge().getWebView() != null) {
            getBridge().getWebView().evaluateJavascript(
                "(function() { return !!(window.__handleAndroidBackButton && window.__handleAndroidBackButton()); })();",
                result -> {
                    if (!"true".equals(result)) {
                        moveTaskToBack(true);
                    }
                }
            );
        } else {
            moveTaskToBack(true);
        }
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
            String chatId = intent.getStringExtra("chatId");
            boolean isGroup = "true".equalsIgnoreCase(intent.getStringExtra("isGroup"));

            Runnable dispatchCall = () -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js = String.format(
                            "window.__autoAcceptPendingCall = %b; " +
                            "window.dispatchEvent(new CustomEvent('native_call_event', { detail: { autoAccept: %b, callId: '%s', from: '%s', callerName: '%s', isVideo: %b, chatId: '%s', isGroup: %b } }));",
                            autoAccept, autoAccept,
                            callId != null ? callId : "",
                            from != null ? from : "",
                            callerName != null ? callerName : "",
                            isVideo,
                            chatId != null ? chatId : "",
                            isGroup
                        );
                        getBridge().getWebView().evaluateJavascript(js, null);
                    }
                } catch (Exception ignored) {}
            };

            // Dispatch immediately and retry after WebView finishes rendering
            new Handler(Looper.getMainLooper()).postDelayed(dispatchCall, 300);
            new Handler(Looper.getMainLooper()).postDelayed(dispatchCall, 1200);
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
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON |
                WindowManager.LayoutParams.FLAG_ALLOW_LOCK_WHILE_SCREEN_ON
            );
        } catch (Exception ignored) {}
    }

    private void checkAllRequiredPermissions() {
        // 1. Post Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }

        // 2. Full-Screen Intent permission (Android 14+)
        if (Build.VERSION.SDK_INT >= 34) {
            try {
                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null && !nm.canUseFullScreenIntent()) {
                    Intent fsiIntent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                    fsiIntent.setData(Uri.parse("package:" + getPackageName()));
                    fsiIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(fsiIntent);
                    return; // Let user grant this first
                }
            } catch (Exception ignored) {}
        }

        // 3. Draw over other apps / Pop-up in background (Crucial for Infinix, Xiaomi, Samsung lock screen calling)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                if (!Settings.canDrawOverlays(this)) {
                    Intent overlayIntent = new Intent(
                        Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                        Uri.parse("package:" + getPackageName())
                    );
                    overlayIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(overlayIntent);
                    return;
                }
            } catch (Exception ignored) {}
        }

        // 4. Battery Optimization Whitelist (prevents OS sleeping background push/call services)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            try {
                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                if (pm != null && !pm.isIgnoringBatteryOptimizations(getPackageName())) {
                    Intent batteryIntent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                    batteryIntent.setData(Uri.parse("package:" + getPackageName()));
                    batteryIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    startActivity(batteryIntent);
                }
            } catch (Exception ignored) {}
        }
    }
}
