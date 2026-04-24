import { TileLayer } from 'react-leaflet'
import { getPlannerBaseLayerConfig } from '@/features/flight-planner/constants/mapBaseLayers'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'

/**
 * Camada de fundo do mapa (satelite, ruas, etc.) lida a partir do store do planejador.
 */
export function PlannerMapBaseLayer() {
  const id = useFlightStore((s) => s.plannerBaseLayer)
  const { url, attribution } = getPlannerBaseLayerConfig(id)
  return <TileLayer key={id} url={url} attribution={attribution} maxZoom={19} />
}
