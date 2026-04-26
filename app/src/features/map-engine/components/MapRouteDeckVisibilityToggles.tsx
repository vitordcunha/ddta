import { useMapEngine } from '@/features/map-engine/useMapEngine'
import { useFlightStore } from '@/features/flight-planner/stores/useFlightStore'

type Scope = 'plan' | 'results'

type MapRouteDeckVisibilityTogglesProps = {
  scope: Scope
  /** Texto curto para contexto (ex.: Mapbox 3D). */
  hint?: string
}

export function MapRouteDeckVisibilityToggles({
  scope,
  hint = 'No mapa Mapbox em modo 3D, a rota usa a altitude AMSL/AGL dos waypoints.',
}: MapRouteDeckVisibilityTogglesProps) {
  const vis = useFlightStore((s) => s.deckMapVisibility[scope])
  const setDeckMapVisibility = useFlightStore((s) => s.setDeckMapVisibility)
  const { provider, mode, deviceTier } = useMapEngine()
  const frustum3dInDeck = useFlightStore((s) => s.frustum3dInDeck)
  const setFrustum3dInDeck = useFlightStore((s) => s.setFrustum3dInDeck)
  const showFrustumToggle = (provider === 'mapbox' || provider === 'google') && mode === '3d'

  return (
    <div className="rounded-lg border border-white/10 bg-white/[0.02] p-3 space-y-2.5">
      <p className="text-xs font-medium text-neutral-200">
        {scope === 'plan' ? 'Mapa 3D' : 'Rota no mapa'}
      </p>
      <p className="text-[10px] leading-snug text-neutral-500">{hint}</p>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
        <input
          type="checkbox"
          className="size-4 shrink-0 cursor-pointer rounded border border-white/20 bg-white/[0.04] text-primary-500"
          checked={vis.showRoute}
          onChange={(e) =>
            setDeckMapVisibility(scope, { showRoute: e.target.checked })
          }
        />
        Mostrar rota
      </label>
      <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
        <input
          type="checkbox"
          className="size-4 shrink-0 cursor-pointer rounded border border-white/20 bg-white/[0.04] text-primary-500"
          checked={vis.showWaypoints}
          onChange={(e) =>
            setDeckMapVisibility(scope, { showWaypoints: e.target.checked })
          }
        />
        Mostrar waypoints
      </label>
      {showFrustumToggle ? (
        <label className="flex cursor-pointer items-center gap-2 text-xs text-neutral-300">
          <input
            type="checkbox"
            className="size-4 shrink-0 cursor-pointer rounded border border-white/20 bg-white/[0.04] text-primary-500"
            checked={frustum3dInDeck}
            onChange={(e) => setFrustum3dInDeck(e.target.checked)}
          />
          Campo de visão (frustum)
        </label>
      ) : null}
      {showFrustumToggle && deviceTier === 'low' ? (
        <p className="text-[10px] leading-snug text-amber-500/90">
          Em dispositivos de gama média, desligar o frustum reduz carga na GPU.
        </p>
      ) : null}
    </div>
  )
}
