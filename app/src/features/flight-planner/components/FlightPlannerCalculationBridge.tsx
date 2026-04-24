import { useEffect } from "react"
import { useFlightCalculator } from "@/features/flight-planner/hooks/useFlightCalculator"
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore"

/**
 * Mantem waypoints/strips/estatisticas sincronizados com poligono + parametros
 * mesmo quando o painel de configuracao esta recolhido (e desmontado).
 */
export function FlightPlannerCalculationBridge() {
  const polygon = useFlightStore((s) => s.polygon)
  const params = useFlightStore((s) => s.params)
  const routeStartRef = useFlightStore((s) => s.routeStartRef)
  const setResult = useFlightStore((s) => s.setResult)
  const setIsCalculating = useFlightStore((s) => s.setIsCalculating)

  const { waypoints, stats, strips, isCalculating } = useFlightCalculator(
    polygon,
    params,
    routeStartRef,
  )

  useEffect(() => {
    setIsCalculating(isCalculating)
    setResult(waypoints, stats, strips)
  }, [isCalculating, setIsCalculating, setResult, stats, strips, waypoints])

  return null
}
