import { Capacitor } from '@capacitor/core'

/**
 * Splash escuro, status bar e estilo nativo alinhados ao tema do app.
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
    await StatusBar.setBackgroundColor({ color: '#0a0a0a' })
  } catch {
    /* ignore em web ou se o plugin falhar */
  }

  try {
    await SplashScreen.hide()
  } catch {
    /* ignore */
  }
}
