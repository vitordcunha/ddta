export type ThemeMode = 'system' | 'dark' | 'light'
export type DistanceUnit = 'm' | 'ft'

export type UserPreferences = {
  theme: ThemeMode
  distanceUnit: DistanceUnit
  openWeatherApiKey: string
}

export const USER_PREFERENCES_STORAGE_KEY = 'app:user-preferences'

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  theme: 'system',
  distanceUnit: 'm',
  openWeatherApiKey: '',
}
