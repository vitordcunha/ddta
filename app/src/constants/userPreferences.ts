export type ThemeMode = 'system' | 'dark' | 'light'
export type DistanceUnit = 'm' | 'ft'

export type UserPreferences = {
  theme: ThemeMode
  distanceUnit: DistanceUnit
  openWeatherApiKey: string
  /** ID do modelo no catálogo da API; null = usar o marcado como padrão na API (ou o primeiro). */
  defaultDroneModelId: string | null
}

export const USER_PREFERENCES_STORAGE_KEY = 'app:user-preferences'

export const USER_PREFERENCES_UPDATED_EVENT = 'dronedata:user-preferences-updated'

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  distanceUnit: 'm',
  openWeatherApiKey: '',
  defaultDroneModelId: null,
}

export function readUserPreferencesFromStorage(): UserPreferences {
  if (typeof window === 'undefined') {
    return DEFAULT_USER_PREFERENCES
  }
  try {
    const raw = window.localStorage.getItem(USER_PREFERENCES_STORAGE_KEY)
    if (!raw) return DEFAULT_USER_PREFERENCES
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    return { ...DEFAULT_USER_PREFERENCES, ...parsed }
  } catch {
    return DEFAULT_USER_PREFERENCES
  }
}
