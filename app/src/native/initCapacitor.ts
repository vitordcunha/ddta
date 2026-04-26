import { Capacitor } from '@capacitor/core'

/**
 * Splash escuro, edge-to-edge no shell nativo (overlay + barras transparentes no Android
 * compatível), ícones da status bar claros para fundo escuro do mapa.
 * Teclado: `resize: none` em `capacitor.config.ts` (Android).
 */
export async function initCapacitorShell(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return

  const [{ SplashScreen }, { StatusBar, Style }] = await Promise.all([
    import('@capacitor/splash-screen'),
    import('@capacitor/status-bar'),
  ])

  try {
    await StatusBar.setStyle({ style: Style.Dark })
    // Android 14 e anteriores: conteúdo sob a status bar. Em Android 15+ o plugin pode ignorar;
    // o edge-to-edge fica a cargo do tema + `WindowCompat` em `MainActivity`.
    await StatusBar.setOverlaysWebView({ overlay: true })
  } catch {
    /* ignore em web ou se o plugin falhar */
  }

  try {
    // Com overlay ativo a cor de fundo da status bar não se aplica; em builds sem overlay não atrapalha.
    await StatusBar.setBackgroundColor({ color: '#00000000' })
  } catch {
    /* ignore */
  }

  try {
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }
}
