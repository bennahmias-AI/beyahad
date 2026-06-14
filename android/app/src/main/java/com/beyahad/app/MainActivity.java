package com.beyahad.app;

import android.media.AudioManager;
import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // מאפשר ניגון אודיו (צליל צלצול) בלי "מגע" מהמשתמש — אחרת ה-WebView חוסם אותו
        this.getBridge().getWebView().getSettings().setMediaPlaybackRequiresUserGesture(false);
        // לחצני העוצמה בטלפון ישלטו תמיד על עוצמת המדיה (צלילי משחק ווידאו),
        // ולא בהעדר קולה יפלו לעוצמת הצלצול — גם כשאין צליל מתנגן ברגע זה.
        setVolumeControlStream(AudioManager.STREAM_MUSIC);
    }
}
