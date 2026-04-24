import type { WeatherData, WeatherForecastHour } from '@/features/flight-planner/types'
import { wmoCodeToConditionPt } from '@/features/flight-planner/utils/weatherHelpers'

type OpenMeteoResponse = {
  current?: {
    wind_speed_10m?: number
    wind_direction_10m?: number
    wind_gusts_10m?: number
    weather_code?: number
    precipitation?: number
    rain?: number
    showers?: number
    temperature_2m?: number
    relative_humidity_2m?: number
    apparent_temperature?: number
    cloud_cover?: number
    pressure_msl?: number
    is_day?: number
  }
  hourly?: {
    time?: string[]
    temperature_2m?: number[]
    precipitation_probability?: number[]
    precipitation?: number[]
    weather_code?: number[]
  }
}

function weatherCodeToCloudCoverFallback(weatherCode: number): number {
  if (weatherCode === 0 || weatherCode === 1) return 10
  if (weatherCode === 2) return 35
  if (weatherCode === 3) return 75
  return 90
}

function isPrecipitatingNow(
  precipitation: number,
  rain: number,
  showers: number,
  code: number,
): boolean {
  if (precipitation > 0.02 || rain > 0.02 || showers > 0.02) return true
  if (code >= 51 && code <= 67) return true
  if (code >= 80 && code <= 82) return true
  if (code >= 95 && code <= 99) return true
  return false
}

function parseHourlyForecast(data: OpenMeteoResponse['hourly']): WeatherForecastHour[] {
  if (!data?.time?.length) return []
  const times = data.time
  const temps = data.temperature_2m ?? []
  const probs = data.precipitation_probability ?? []
  const precips = data.precipitation ?? []
  const codes = data.weather_code ?? []

  const out: WeatherForecastHour[] = []
  const limit = Math.min(24, times.length)
  for (let i = 0; i < limit; i += 1) {
    out.push({
      time: times[i]!,
      tempC: Number(temps[i] ?? 0),
      precipProbPct: Number(probs[i] ?? 0),
      precipMm: Number(precips[i] ?? 0),
      weatherCode: Number(codes[i] ?? 0),
    })
  }
  return out
}

export const weatherService = {
  async getCurrent(lat: number, lon: number): Promise<WeatherData> {
    const url = new URL('https://api.open-meteo.com/v1/forecast')
    url.searchParams.set('latitude', String(lat))
    url.searchParams.set('longitude', String(lon))
    url.searchParams.set('timezone', 'auto')
    url.searchParams.set('wind_speed_unit', 'ms')
    url.searchParams.set(
      'current',
      [
        'temperature_2m',
        'relative_humidity_2m',
        'apparent_temperature',
        'is_day',
        'precipitation',
        'rain',
        'showers',
        'weather_code',
        'cloud_cover',
        'pressure_msl',
        'wind_speed_10m',
        'wind_direction_10m',
        'wind_gusts_10m',
      ].join(','),
    )
    url.searchParams.set(
      'hourly',
      [
        'temperature_2m',
        'precipitation_probability',
        'precipitation',
        'weather_code',
      ].join(','),
    )
    url.searchParams.set('forecast_hours', '24')

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error('Falha ao consultar Open-Meteo.')
    }

    const data = (await response.json()) as OpenMeteoResponse
    const current = data.current
    if (!current) {
      throw new Error('Resposta de clima invalida.')
    }

    const weatherCode = Number(current.weather_code ?? 0)
    const cloudFromApi = current.cloud_cover
    const cloudCoveragePct = Number.isFinite(Number(cloudFromApi))
      ? Math.round(Number(cloudFromApi))
      : weatherCodeToCloudCoverFallback(weatherCode)

    const rain = Number(current.rain ?? 0)
    const showers = Number(current.showers ?? 0)
    const precipitation = Number(current.precipitation ?? 0)

    return {
      windSpeedMs: Number(current.wind_speed_10m ?? 0),
      windDirectionDeg: Number(current.wind_direction_10m ?? 0),
      windGustsMs: Number(current.wind_gusts_10m ?? current.wind_speed_10m ?? 0),
      temperatureC: Number(current.temperature_2m ?? 0),
      apparentTemperatureC: Number(
        current.apparent_temperature ?? current.temperature_2m ?? 0,
      ),
      relativeHumidityPct: Math.round(Number(current.relative_humidity_2m ?? 0)),
      pressureHpa: Number(Number(current.pressure_msl ?? 1013).toFixed(1)),
      cloudCoveragePct,
      rainMmH: precipitation,
      rainMmHRaw: rain,
      showersMmH: showers,
      weatherCode,
      conditionLabel: wmoCodeToConditionPt(weatherCode),
      isPrecipitatingNow: isPrecipitatingNow(precipitation, rain, showers, weatherCode),
      isDay: Number(current.is_day ?? 1) === 1,
      hourlyForecast: parseHourlyForecast(data.hourly),
    }
  },
}
