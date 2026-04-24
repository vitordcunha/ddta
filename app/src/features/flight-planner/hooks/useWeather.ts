import { useCallback, useState } from 'react'
import { assessFlightConditions, getMockWeather } from '@/features/flight-planner/utils/weatherHelpers'
import type { DroneModel, FlightAssessment, WeatherData } from '@/features/flight-planner/types'

export function useWeather(droneModel: DroneModel, altitudeM: number) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [assessment, setAssessment] = useState<FlightAssessment | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchWeather = useCallback(async (lat: number, lon: number) => {
    try {
      setIsLoading(true)
      setError(null)
      await new Promise((resolve) => window.setTimeout(resolve, 550))
      const mock = getMockWeather(lat, lon)
      setWeather(mock)
      setAssessment(assessFlightConditions(mock, droneModel, altitudeM))
    } catch {
      setError('Falha ao carregar clima simulado.')
    } finally {
      setIsLoading(false)
    }
  }, [altitudeM, droneModel])

  return { fetchWeather, weather, assessment, isLoading, error }
}
