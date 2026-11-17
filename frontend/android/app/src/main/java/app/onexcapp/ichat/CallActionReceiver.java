package app.onexcapp.ichat;

import android.app.NotificationManager;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

public class CallActionReceiver extends BroadcastReceiver {
    public static final String ACTION_DECLINE_CALL = "app.onexcapp.ichat.ACTION_DECLINE_CALL";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent != null && ACTION_DECLINE_CALL.equals(intent.getAction())) {
            try {
                Intent stopIntent = new Intent(context, IncomingCallForegroundService.class);
                stopIntent.setAction(IncomingCallForegroundService.ACTION_STOP_CALL);
                context.startService(stopIntent);

                NotificationHelper.cancelCallNotification(context);
                NotificationManager nm = (NotificationManager) context.getSystemService(Context.NOTIFICATION_SERVICE);
                if (nm != null) {
                    nm.cancel(IncomingCallForegroundService.NOTIFICATION_ID);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
