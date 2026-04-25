import { Capacitor } from '@capacitor/core'
import { useMemo } from 'react'

export function usePlatform() {
  return useMemo(() => {
    const isNative = Capacitor.isNativePlatform()
    const platform = Capacitor.getPlatform()
    return {
      isNative,
      isAndroid: platform === 'android',
      isIOS: platform === 'ios',
      isWeb: !isNative,
      platform,
    }
  }, [])
}
