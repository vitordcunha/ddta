import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics'
import { Capacitor } from '@capacitor/core'

const isNative = Capacitor.isNativePlatform()

export const haptic = {
  light: () => isNative && Haptics.impact({ style: ImpactStyle.Light }),
  medium: () => isNative && Haptics.impact({ style: ImpactStyle.Medium }),
  heavy: () => isNative && Haptics.impact({ style: ImpactStyle.Heavy }),
  success: () => isNative && Haptics.notification({ type: NotificationType.Success }),
  error: () => isNative && Haptics.notification({ type: NotificationType.Error }),
}
