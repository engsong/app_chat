package app.onexcapp.ichat;

import android.app.Application;

public class IChatApplication extends Application {
    @Override
    public void onCreate() {
        super.onCreate();
        NotificationHelper.createChannels(this);
    }
}
