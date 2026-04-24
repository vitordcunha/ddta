import type { WeatherData } from '@/features/flight-planner/types'

type OpenMeteoResponse = {
  current?: {
    wind_speed_10m?: number
    wind_direction_10m?: number
    weather_code?: number
    precipitation?: number
    temperature_2m?: number
  }
}

function weatherCodeToCloudCover(weatherCode: number): number {
  if (weatherCode === 0 || weatherCode === 1) return 10
  if (weatherCode === 2) return 35
  if (weatherCode === 3) return 75
  return 90
}

export const weatherService = {
  async getCurrent(lat: number, lon: number): Promise<WeatherData> {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('current', 'temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,precipitation')
    url.searchParams.set('timezone', 'auto')

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Falha ao consultar Open-Meteo.')
    }

    const data = (await response.json()) as OpenMeteoResponse
    const current = data.current
    if (!current) {
      throw new Error('Resposta de clima invalida.')
    }

    return {
      windSpeedMs: Number(current.wind_speed_10m ?? 0),
      windDirectionDeg: Number(current.wind_direction_10m ?? 0),
      temperatureC: Number(current.temperature_2m ?? 0),
      cloudCoveragePct: weatherCodeToCloudCover(Number(current.weather_code ?? 0)),
      rainMmH: Number(current.precipitation ?? 0),
    }
  },
}
