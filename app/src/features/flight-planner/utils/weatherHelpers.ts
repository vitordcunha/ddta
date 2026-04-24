import { getDroneSpec } from '@/features/flight-planner/utils/droneSpecs'
import type { DroneModel, FlightAssessment, WeatherData } from '@/features/flight-planner/types'

export function getMockWeather(lat: number, lon: number): WeatherData {
  const seed = Math.abs(Math.sin(lat * 0.31 + lon * 0.17))
  return {
    windSpeedMs: Number((2 + seed * 9).toFixed(1)),
    windDirectionDeg: Math.round((seed * 360) % 360),
    temperatureC: Number((18 + seed * 14).toFixed(1)),
    cloudCoveragePct: Math.round(seed * 95),
    rainMmH: Number((seed > 0.75 ? (seed - 0.72) * 10 : 0).toFixed(1)),
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

export function assessFlightConditions(weather: WeatherData, droneModel: DroneModel, altitudeM: number): FlightAssessment {
  const spec = getDroneSpec(droneModel)
  const issues: string[] = []
  const warnings: string[] = []
  const tips: string[] = []

  if (weather.windSpeedMs > spec.maxSpeedMs * 0.6) {
    issues.push('Vento acima do recomendado para missão fotogramétrica de precisão.')
  } else if (weather.windSpeedMs > spec.maxSpeedMs * 0.45) {
    warnings.push('Vento moderado: considere reduzir altitude e aumentar sobreposição.')
  }

  if (weather.rainMmH > 0.2) {
    issues.push('Risco de chuva durante o voo.')
  }

  if (weather.cloudCoveragePct > 85) {
    warnings.push('Cobertura de nuvens alta pode reduzir contraste em superfícies homogêneas.')
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
