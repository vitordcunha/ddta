import { useCallback, useState } from 'react'
import { assessFlightConditions } from '@/features/flight-planner/utils/weatherHelpers'
import type { DroneModel, FlightAssessment, WeatherData } from '@/features/flight-planner/types'
import { weatherService } from '@/services/weatherService'

export function useWeather(droneModel: DroneModel, altitudeM: number) {
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
      setAssessment(assessFlightConditions(current, droneModel, altitudeM))
    } catch {
      setError('Falha ao carregar clima em tempo real.')
    } finally {
      setIsLoading(false)
    }
  }, [altitudeM, droneModel])

  return { fetchWeather, weather, assessment, isLoading, error }
}
