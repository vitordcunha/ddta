package com.dronemapper.app;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsCompat;
import androidx.core.view.WindowInsetsControllerCompat;
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
    applyImmersiveSystemUi();
    applyWebViewPerformanceTuning();
  }

  @Override
  public void onResume() {
    super.onResume();
    applyImmersiveSystemUi();
  }

  @Override
  public void onWindowFocusChanged(boolean hasFocus) {
    super.onWindowFocusChanged(hasFocus);
    if (hasFocus) {
      applyImmersiveSystemUi();
    }
  }

  /**
   * Esconde status bar e navigation bar (sticky immersive). Reaplica após diálogos do SO ou
   * quando o plugin StatusBar roda, para manter tela cheia em landscape.
   */
  private void applyImmersiveSystemUi() {
    WindowInsetsControllerCompat c =
        WindowCompat.getInsetsController(getWindow(), getWindow().getDecorView());
    c.setSystemBarsBehavior(WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
    c.hide(WindowInsetsCompat.Type.statusBars() | WindowInsetsCompat.Type.navigationBars());
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
