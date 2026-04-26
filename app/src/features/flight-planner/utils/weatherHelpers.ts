import type { DroneSpec, FlightAssessment, WeatherData } from '@/features/flight-planner/types'

/** Mensagem quando Open-Meteo ou a rede falham (planeamento offline continua válido). */
export const WEATHER_UNAVAILABLE_HEADLINE = 'Clima indisponível'

export const WEATHER_UNAVAILABLE_DETAIL =
  'Não foi possível obter dados em tempo real. Cálculo de waypoints e exportação KMZ funcionam sem internet.'

export function isWeatherUnavailableCopy(text: string | null | undefined): boolean {
  return Boolean(text?.includes(WEATHER_UNAVAILABLE_HEADLINE))
}

/**
 * Cobertura nublada aproximada a partir do codigo WMO quando a API nao envia `cloud_cover` por hora.
 * Mesma heuristica usada em `weatherService` para o instante atual.
 */
export function wmoCodeToEstimatedCloudPct(code: number): number {
  if (code === 0 || code === 1) return 10
  if (code === 2) return 35
  if (code === 3) return 75
  return 90
}

/** Descricao curta do codigo WMO (Open-Meteo). */
export function wmoCodeToConditionPt(code: number): string {
  if (code === 0) return 'Ce limpo'
  if (code === 1) return 'Principalmente limpo'
  if (code === 2) return 'Parcialmente nublado'
  if (code === 3) return 'Nublado'
  if (code === 45 || code === 48) return 'Nevoeiro'
  if (code >= 51 && code <= 55) return 'Chuvisco'
  if (code === 56 || code === 57) return 'Chuvisco gelado'
  if (code >= 61 && code <= 65) return 'Chuva'
  if (code === 66 || code === 67) return 'Chuva gelada'
  if (code >= 71 && code <= 77) return 'Neve / gelo'
  if (code >= 80 && code <= 82) return 'Aguaceiros'
  if (code === 85 || code === 86) return 'Aguaceiros de neve'
  if (code === 95) return 'Trovoada'
  if (code >= 96 && code <= 99) return 'Trovoada com granizo'
  return 'Condicao desconhecida'
}

export function getMockWeather(lat: number, lon: number): WeatherData {
  const seed = Math.abs(Math.sin(lat * 0.31 + lon * 0.17))
  const wind = Number((2 + seed * 9).toFixed(1))
  const code = seed > 0.8 ? 61 : seed > 0.5 ? 3 : 1
  return {
    windSpeedMs: wind,
    windGustsMs: Number((wind * 1.3).toFixed(1)),
    windDirectionDeg: Math.round((seed * 360) % 360),
    temperatureC: Number((18 + seed * 14).toFixed(1)),
    apparentTemperatureC: Number((17 + seed * 13).toFixed(1)),
    relativeHumidityPct: Math.round(40 + seed * 45),
    pressureHpa: 1013,
    cloudCoveragePct: Math.round(seed * 95),
    rainMmH: Number((seed > 0.75 ? (seed - 0.72) * 10 : 0).toFixed(1)),
    rainMmHRaw: Number((seed > 0.75 ? (seed - 0.72) * 8 : 0).toFixed(1)),
    showersMmH: 0,
    weatherCode: code,
    conditionLabel: wmoCodeToConditionPt(code),
    isPrecipitatingNow: seed > 0.75,
    isDay: true,
    hourlyForecast: [],
  }
}

export function windDegToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'L', 'SE', 'S', 'SO', 'O', 'NO']
  const index = Math.round(((deg % 360) / 45)) % 8
  return dirs[index]
}

export function windSpeedToBeaufort(ms: number): number {
  if (ms < 0.3) return 0
  if (ms < 1.6) return 1
  if (ms < 3.4) return 2
  if (ms < 5.5) return 3
  if (ms < 8) return 4
  if (ms < 10.8) return 5
  if (ms < 13.9) return 6
  if (ms < 17.2) return 7
  if (ms < 20.8) return 8
  return 9
}

export function assessFlightConditions(
  weather: WeatherData,
  spec: Pick<DroneSpec, 'maxSpeedMs'>,
  altitudeM: number,
): FlightAssessment {
  const issues: string[] = []
  const warnings: string[] = []
  const tips: string[] = []

  const code = weather.weatherCode ?? 0
  const precipNow =
    weather.isPrecipitatingNow ?? weather.rainMmH > 0.08
  const gusts = weather.windGustsMs ?? weather.windSpeedMs

  if (weather.windSpeedMs > spec.maxSpeedMs * 0.6) {
    issues.push('Vento acima do recomendado para missão fotogramétrica de precisão.')
  } else if (weather.windSpeedMs > spec.maxSpeedMs * 0.45) {
    warnings.push('Vento moderado: considere reduzir altitude e aumentar sobreposição.')
  }

  if (gusts > spec.maxSpeedMs * 0.72) {
    issues.push('Rajadas de vento elevadas para o perfil deste drone.')
  } else if (gusts > spec.maxSpeedMs * 0.55) {
    warnings.push('Rajadas moderadas: monitore estabilidade e aborte se oscilar demais.')
  }

  if (code >= 95) {
    issues.push('Trovoadas na região — não voe.')
  } else if (weather.rainMmH > 0.2) {
    issues.push('Precipitação significativa — voo não recomendado.')
  } else if (precipNow && code >= 61) {
    issues.push('Chuva no momento — aguarde condições mais secas.')
  } else if (precipNow) {
    warnings.push('Precipitação leve (chuvisco); proteja o equipamento e avalie visibilidade.')
  }

  if (weather.cloudCoveragePct > 85) {
    warnings.push('Cobertura de nuvens alta pode reduzir contraste em superfícies homogêneas.')
  }

  const next = weather.hourlyForecast ?? []
  if (next.length > 0) {
    const soon = next.slice(0, 6)
    const maxProb = Math.max(...soon.map((h) => h.precipProbPct), 0)
    const maxPrecip = Math.max(...soon.map((h) => h.precipMm), 0)
    if (maxProb >= 70 && maxPrecip >= 0.3) {
      warnings.push('Alta probabilidade de chuva nas próximas horas — reveja a janela de voo.')
    } else if (maxProb >= 55) {
      tips.push('Probabilidade de precipitação moderada nas próximas horas; acompanhe o radar.')
    }
  }

  if (altitudeM > 120) {
    warnings.push('Altitude acima de 120m pode exigir autorização adicional.')
  }

  tips.push(`Nível Beaufort estimado: ${windSpeedToBeaufort(weather.windSpeedMs)}.`)
  tips.push('Confirme baterias e home point antes de iniciar a missão.')

  return {
    go: issues.length === 0,
    issues,
    warnings,
    tips,
  }
}
