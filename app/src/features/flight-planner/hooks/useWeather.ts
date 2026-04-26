import { useCallback, useState } from 'react'
import {
  assessFlightConditions,
  WEATHER_UNAVAILABLE_DETAIL,
  WEATHER_UNAVAILABLE_HEADLINE,
} from '@/features/flight-planner/utils/weatherHelpers'
import type { DroneSpec, FlightAssessment, WeatherData } from '@/features/flight-planner/types'
import { weatherService } from '@/services/weatherService'

export function useWeather(spec: Pick<DroneSpec, 'maxSpeedMs'>, altitudeM: number) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [assessment, setAssessment] = useState<FlightAssessment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setIsLoading(true)
      setError(null)
      const current = await weatherService.getCurrent(lat, lon)
      setWeather(current)
      setAssessment(assessFlightConditions(current, spec, altitudeM))
    } catch {
      setWeather(null)
      setAssessment(null)
      setError(`${WEATHER_UNAVAILABLE_HEADLINE}. ${WEATHER_UNAVAILABLE_DETAIL}`)
    } finally {
      setIsLoading(false)
    }
  }, [altitudeM, spec.maxSpeedMs])

  return { fetchWeather, weather, assessment, isLoading, error }
}
