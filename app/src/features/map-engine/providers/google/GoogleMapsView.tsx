import { Link } from 'react-router-dom'
import type { WorkspacePanelId } from '@/constants/routes'
import { toWorkspace } from '@/constants/routes'
import type { WorkspaceMapWeatherTilesProps } from '@/components/map/useWorkspaceMapWeather'
import { useMapEngine } from '@/features/map-engine/useMapEngine'

type GoogleMapsViewProps = {
  panel: WorkspacePanelId
  projectId: string | null
  weatherTiles: WorkspaceMapWeatherTilesProps
}

/** Google Maps será integrado na Fase 10. */
export function GoogleMapsView(_props: GoogleMapsViewProps) {
  const { googleMapsApiKey, center, zoom, mode } = useMapEngine()
  const hasKey = googleMapsApiKey.length > 0

  return (
    <div className="absolute inset-0 z-0 flex flex-col items-center justify-center gap-3 bg-[#0f0f0f] px-6 text-center">
      <p className="text-sm font-medium text-neutral-200">Google Maps</p>
      <p className="max-w-sm text-xs text-neutral-500">
        {hasKey
          ? `Integração em desenvolvimento. Centro: ${center[0].toFixed(4)}, ${center[1].toFixed(4)} · zoom ${zoom} · modo ${mode}.`
          : 'Defina a chave da API Google Maps em Configuracoes para habilitar este provedor.'}
      </p>
      {!hasKey ? (
        <Link
          className="text-xs font-medium text-primary-400 underline-offset-2 hover:underline"
          to={toWorkspace('/', { panel: 'settings' })}
        >
          Abrir configuracoes
        </Link>
      ) : null}
    </div>
  )
}
