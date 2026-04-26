package com.dronemapper.app;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Bridge;

public class MainActivity extends BridgeActivity {

  @Override
  public void onCreate(Bundle savedInstanceState) {
    getWindow().addFlags(WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
    registerPlugin(DjiMissionPlugin.class);
    super.onCreate(savedInstanceState);
    // Edge-to-edge: WebView usa a tela inteira; insets viram env(safe-area-inset-*) no front.
    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
    applyWebViewPerformanceTuning();
  }

  private void applyWebViewPerformanceTuning() {
    Bridge b = this.getBridge();
    if (b == null) return;
    android.webkit.WebView wv = b.getWebView();
    if (wv == null) return;
    wv.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    WebSettings s = wv.getSettings();
    s.setCacheMode(WebSettings.LOAD_DEFAULT);
  }
}
