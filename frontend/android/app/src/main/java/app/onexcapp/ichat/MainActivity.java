package app.onexcapp.ichat;

import android.app.KeyguardManager;
import android.app.NotificationManager;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.media.AudioDeviceInfo;
import android.media.AudioManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.provider.Settings;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import java.util.List;
import org.json.JSONObject;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    private boolean hasCheckedPermissionsOnce = false;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        wakeAndUnlock();
        super.onCreate(savedInstanceState);
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
                getBridge().getWebView().addJavascriptInterface(new Object() {
                    @JavascriptInterface
                    public void setSpeakerphoneOn(boolean on) {
                        try {
                            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                            if (audioManager != null) {
                                audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                    if (on) {
                                        List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                                        for (AudioDeviceInfo device : devices) {
                                            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_SPEAKER) {
                                                audioManager.setCommunicationDevice(device);
                                                break;
                                            }
                                        }
                                    } else {
                                        boolean earpieceFound = false;
                                        List<AudioDeviceInfo> devices = audioManager.getAvailableCommunicationDevices();
                                        for (AudioDeviceInfo device : devices) {
                                            if (device.getType() == AudioDeviceInfo.TYPE_BUILTIN_EARPIECE) {
                                                audioManager.setCommunicationDevice(device);
                                                earpieceFound = true;
                                                break;
                                            }
                                        }
                                        if (!earpieceFound) {
                                            audioManager.clearCommunicationDevice();
                                        }
                                    }
                                }
                                audioManager.setSpeakerphoneOn(on);
                            }
                        } catch (Exception ignored) {}
                    }

                    @JavascriptInterface
                    public boolean isSpeakerphoneOn() {
                        try {
                            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                            if (audioManager != null) {
                                return audioManager.isSpeakerphoneOn();
                            }
                        } catch (Exception ignored) {}
                        return false;
                    }

                    @JavascriptInterface
                    public void resetAudioMode() {
                        try {
                            AudioManager audioManager = (AudioManager) getSystemService(Context.AUDIO_SERVICE);
                            if (audioManager != null) {
                                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
                                    audioManager.clearCommunicationDevice();
                                }
                                audioManager.setSpeakerphoneOn(false);
                                audioManager.setMode(AudioManager.MODE_NORMAL);
                            }
                        } catch (Exception ignored) {}
                    }

                    @JavascriptInterface
                    public String getCallPermissionStatus() {
                        JSONObject json = new JSONObject();
                        try {
                            boolean notifications = true;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                                notifications = checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) == PackageManager.PERMISSION_GRANTED;
                            }
                            boolean canDrawOverlays = true;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                canDrawOverlays = Settings.canDrawOverlays(MainActivity.this);
                            }
                            boolean isIgnoringBattery = true;
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                                PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
                                if (pm != null) {
                                    isIgnoringBattery = pm.isIgnoringBatteryOptimizations(getPackageName());
                                }
                            }
                            boolean canUseFullScreenIntent = true;
                            if (Build.VERSION.SDK_INT >= 34) {
                                NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
                                if (nm != null) {
                                    canUseFullScreenIntent = nm.canUseFullScreenIntent();
                                }
                            }

                            json.put("notifications", notifications);
                            json.put("canDrawOverlays", canDrawOverlays);
                            json.put("isIgnoringBattery", isIgnoringBattery);
                            json.put("canUseFullScreenIntent", canUseFullScreenIntent);
                            json.put("manufacturer", Build.MANUFACTURER != null ? Build.MANUFACTURER : "");
                            json.put("model", Build.MODEL != null ? Build.MODEL : "");
                            json.put("brand", Build.BRAND != null ? Build.BRAND : "");
                            json.put("sdkInt", Build.VERSION.SDK_INT);
                        } catch (Exception e) {
                            e.printStackTrace();
                        }
                        return json.toString();
                    }

                    @JavascriptInterface
                    public void requestNotificationPermission() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                            requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
                        }
                    }

                    @JavascriptInterface
                    public void openOverlaySettings() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            try {
                                Intent intent = new Intent(
                                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                                    Uri.parse("package:" + getPackageName())
                                );
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            } catch (Exception e) {
                                openAppSettings();
                            }
                        }
                    }

                    @JavascriptInterface
                    public void requestIgnoreBatteryOptimizations() {
                        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
                            try {
                                Intent intent = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS);
                                intent.setData(Uri.parse("package:" + getPackageName()));
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                            } catch (Exception e) {
                                try {
                                    Intent intent = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                                    intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                    startActivity(intent);
                                } catch (Exception ignored) {}
                            }
                        }
                    }

                    @JavascriptInterface
                    public void openFullScreenIntentSettings() {
                        if (Build.VERSION.SDK_INT >= 34) {
                            try {
                                Intent intent = new Intent(Settings.ACTION_MANAGE_APP_USE_FULL_SCREEN_INTENT);
                                intent.setData(Uri.parse("package:" + getPackageName()));
                                intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(intent);
                                return;
                            } catch (Exception ignored) {}
                        }
                        openNotificationSettings();
                    }

                    @JavascriptInterface
                    public void openNotificationSettings() {
                        try {
                            Intent intent = new Intent();
                            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                                intent.setAction(Settings.ACTION_APP_NOTIFICATION_SETTINGS);
                                intent.putExtra(Settings.EXTRA_APP_PACKAGE, getPackageName());
                            } else {
                                intent.setAction("android.settings.APP_NOTIFICATION_SETTINGS");
                                intent.putExtra("app_package", getPackageName());
                                intent.putExtra("app_uid", getApplicationInfo().uid);
                            }
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            openAppSettings();
                        }
                    }

                    @JavascriptInterface
                    public void openSpecialAccessSettings() {
                        try {
                            Intent intent = new Intent(Settings.ACTION_MANAGE_ALL_APPLICATIONS_SETTINGS);
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception e) {
                            openAppSettings();
                        }
                    }

                    @JavascriptInterface
                    public void openAppSettings() {
                        try {
                            Intent intent = new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS);
                            intent.setData(Uri.parse("package:" + getPackageName()));
                            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                            startActivity(intent);
                        } catch (Exception ignored) {}
                    }

                    @JavascriptInterface
                    public void openAutoStartSettings() {
                        String manufacturer = (Build.MANUFACTURER != null ? Build.MANUFACTURER.toLowerCase() : "");
                        String brand = (Build.BRAND != null ? Build.BRAND.toLowerCase() : "");

                        try {
                            // Infinix / Tecno / Transsion (XOS / HiOS)
                            if (manufacturer.contains("infinix") || manufacturer.contains("tecno") || manufacturer.contains("transsion") || brand.contains("infinix") || brand.contains("tecno")) {
                                String[][] transsionIntents = {
                                    {"com.transsion.phonemaster", "com.transsion.phonemaster.autostart.AutoStartActivity"},
                                    {"com.transsion.phonemaster", "com.cyin.himgr.autostart.AutoStartActivity"},
                                    {"com.transsion.phonemaster", "com.transsion.phonemaster.MainActivity"}
                                };
                                for (String[] act : transsionIntents) {
                                    try {
                                        Intent oemIntent = new Intent();
                                        oemIntent.setComponent(new ComponentName(act[0], act[1]));
                                        oemIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                        startActivity(oemIntent);
                                        return;
                                    } catch (Exception ignored) {}
                                }
                            }

                            // Xiaomi / Redmi / POCO (MIUI / HyperOS)
                            if (manufacturer.contains("xiaomi") || brand.contains("redmi") || brand.contains("poco")) {
                                Intent miuiIntent = new Intent();
                                miuiIntent.setComponent(new ComponentName("com.miui.securitycenter", "com.miui.permcenter.autostart.AutoStartManagementActivity"));
                                miuiIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(miuiIntent);
                                return;
                            }

                            // Oppo / Realme (ColorOS)
                            if (manufacturer.contains("oppo") || manufacturer.contains("realme") || brand.contains("oppo") || brand.contains("realme")) {
                                String[][] oppoIntents = {
                                    {"com.coloros.safecenter", "com.coloros.safecenter.permission.startup.StartupAppListActivity"},
                                    {"com.oppo.safe", "com.oppo.safe.permission.startup.StartupAppListActivity"},
                                    {"com.coloros.safecenter", "com.coloros.safecenter.startupapp.StartupAppListActivity"}
                                };
                                for (String[] act : oppoIntents) {
                                    try {
                                        Intent oemIntent = new Intent();
                                        oemIntent.setComponent(new ComponentName(act[0], act[1]));
                                        oemIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                        startActivity(oemIntent);
                                        return;
                                    } catch (Exception ignored) {}
                                }
                            }

                            // Vivo / iQOO (FuntouchOS / OriginOS)
                            if (manufacturer.contains("vivo") || brand.contains("vivo")) {
                                Intent vivoIntent = new Intent();
                                vivoIntent.setComponent(new ComponentName("com.vivo.permissionmanager", "com.vivo.permissionmanager.activity.BgStartUpManagerActivity"));
                                vivoIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(vivoIntent);
                                return;
                            }

                            // Huawei / Honor
                            if (manufacturer.contains("huawei") || manufacturer.contains("honor")) {
                                Intent hwIntent = new Intent();
                                hwIntent.setComponent(new ComponentName("com.huawei.systemmanager", "com.huawei.systemmanager.startupmgr.ui.StartupNormalAppListActivity"));
                                hwIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                                startActivity(hwIntent);
                                return;
                            }
                        } catch (Exception ignored) {}

                        // Fallback: Open application details settings
                        openAppSettings();
                    }

                    @JavascriptInterface
                    public void triggerTestCall(int delaySeconds) {
                        new Handler(Looper.getMainLooper()).postDelayed(() -> {
                            try {
                                Intent callIntent = new Intent(MainActivity.this, IncomingCallActivity.class);
                                callIntent.addFlags(
                                    Intent.FLAG_ACTIVITY_NEW_TASK |
                                    Intent.FLAG_ACTIVITY_CLEAR_TOP |
                                    Intent.FLAG_ACTIVITY_SINGLE_TOP |
                                    Intent.FLAG_ACTIVITY_REORDER_TO_FRONT
                                );
                                callIntent.setAction("app.onexcapp.ichat.INCOMING_CALL");
                                callIntent.putExtra("isIncomingCall", true);
                                callIntent.putExtra("callId", "test_call_" + System.currentTimeMillis());
                                callIntent.putExtra("from", "test_caller");
                                callIntent.putExtra("callerName", "Test Incoming Call");
                                callIntent.putExtra("isVideo", "false");

                                NotificationHelper.showCallNotification(
                                    MainActivity.this,
                                    "test_call_" + System.currentTimeMillis(),
                                    "test_caller",
                                    "Test Incoming Call",
                                    null,
                                    false,
                                    null,
                                    false,
                                    null
                                );

                                startActivity(callIntent);
                            } catch (Exception e) {
                                e.printStackTrace();
                            }
                        }, Math.max(delaySeconds, 1) * 1000L);
                    }
                }, "AndroidAudioBridge");
            }
        } catch (Exception ignored) {}
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
        try {
            if (getBridge() != null && getBridge().getWebView() != null) {
                getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
            }
        } catch (Exception ignored) {}
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
            // Dismiss call notification and stop ringing service
            NotificationHelper.cancelCallNotification(this);
            try {
                Intent stopServiceIntent = new Intent(this, IncomingCallForegroundService.class);
                stopServiceIntent.setAction(IncomingCallForegroundService.ACTION_STOP_CALL);
                startService(stopServiceIntent);
            } catch (Exception ignored) {}

            String callId = intent.getStringExtra("callId");
            String from = intent.getStringExtra("from");
            String callerName = intent.getStringExtra("callerName");
            String callerAvatar = intent.getStringExtra("callerAvatar");
            boolean isVideo = "true".equalsIgnoreCase(intent.getStringExtra("isVideo")) || intent.getBooleanExtra("isVideo", false);
            String chatId = intent.getStringExtra("chatId");
            boolean isGroup = "true".equalsIgnoreCase(intent.getStringExtra("isGroup")) || intent.getBooleanExtra("isGroup", false);

            Runnable dispatchCall = () -> {
                try {
                    if (getBridge() != null && getBridge().getWebView() != null) {
                        String js = String.format(
                            "window.dispatchEvent(new CustomEvent('native_call_event', { detail: { " +
                            "autoAccept: %b, isIncoming: %b, callId: '%s', from: '%s', callerName: '%s', callerAvatar: '%s', isVideo: %b, chatId: '%s', isGroup: %b } }));",
                            autoAccept,
                            isIncoming,
                            callId != null ? callId : "",
                            from != null ? from : "",
                            callerName != null ? callerName.replace("'", "\\'") : "",
                            callerAvatar != null ? callerAvatar.replace("'", "\\'") : "",
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
        if (hasCheckedPermissionsOnce) return;
        hasCheckedPermissionsOnce = true;

        // Post Notifications (Android 13+)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS}, 101);
            }
        }
    }
}
