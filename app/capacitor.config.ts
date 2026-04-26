import type { CapacitorConfig } from '@capacitor/cli'

const devServerUrl = process.env.CAP_SERVER_URL

const config: CapacitorConfig = {
  appId: 'com.dronemapper.app',
  appName: 'DroneMapper',
  webDir: 'dist',
  ...(devServerUrl
    ? {
        server: {
          url: devServerUrl,
          cleartext: true,
        },
      }
    : {}),
  android: {
    allowMixedContent: true,
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 1000,
      backgroundColor: '#0a0a0a',
      showSpinner: false,
    },
    StatusBar: {
      style: 'DARK',
      /** Conteúdo sob a status bar onde o plugin suporta; alinhado a `initCapacitorShell`. */
      overlaysWebView: true,
    },
    Keyboard: {
      resize: 'none',
    },
  },
}

export default config
