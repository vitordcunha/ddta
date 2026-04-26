import { useCallback } from 'react'
import { Crosshair, Loader2, Minus, Plus, ScanSearch } from 'lucide-react'
import { useGeolocation } from '@/hooks/useGeolocation'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import { cn } from '@/lib/utils'

const LOCATE_ZOOM = 16

const BTN =
  'touch-target flex h-12 w-12 items-center justify-center text-[#e8e8e8] transition hover:bg-white/10 active:bg-white/15 disabled:cursor-not-allowed disabled:opacity-50'

type Props = {
  map: google.maps.Map | null
  showResults: boolean
}

export function GoogleMapsBottomLeft({ map, showResults }: Props) {
  const { error, phase, locate } = useGeolocation()
  const autoFitBounds = useResultsViewStore((s) => s.autoFitBounds)

  const onZoomIn = useCallback(() => {
    if (!map) return
    const z = map.getZoom() ?? 15
    map.setZoom(z + 1)
  }, [map])

  const onZoomOut = useCallback(() => {
    if (!map) return
    const z = map.getZoom() ?? 15
    map.setZoom(z - 1)
  }, [map])

  const onLocate = useCallback(() => {
    if (!map) return
    void locate().then((coords) => {
      const targetZoom = Math.max(map.getZoom() ?? LOCATE_ZOOM, LOCATE_ZOOM)
      map.panTo({ lat: coords.lat, lng: coords.lng })
      map.setZoom(targetZoom)
    })
  }, [locate, map])

  const onFitProject = useCallback(() => {
    if (!map || !autoFitBounds) return
    const [[south, west], [north, east]] = autoFitBounds
    const bounds = new google.maps.LatLngBounds(
      { lat: south, lng: west },
      { lat: north, lng: east },
    )
    map.fitBounds(bounds, 32)
  }, [autoFitBounds, map])

  return (
    <div
      className="pointer-events-none absolute z-10 flex flex-col gap-2"
      style={{
        left: 'max(0.75rem, env(safe-area-inset-left, 0px))',
        bottom: 'max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))',
      }}
    >
      <div className="pointer-events-auto flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 shadow-lg backdrop-blur-md">
        <button type="button" className={cn(BTN, 'border-b border-white/10')} onClick={onZoomIn} title="Aproximar">
          <Plus className="size-5" />
        </button>
        <button type="button" className={BTN} onClick={onZoomOut} title="Afastar">
          <Minus className="size-5" />
        </button>
      </div>

      <div className="pointer-events-auto flex flex-col items-stretch gap-2">
        {error ? (
          <p
            className="max-w-[min(18rem,calc(100vw-2rem))] rounded-lg border border-red-500/30 bg-[#121212]/95 px-3 py-2 text-xs text-red-200 shadow-lg backdrop-blur-md"
            role="alert"
          >
            {error}
          </p>
        ) : null}
        <div
          className="flex flex-col overflow-hidden rounded-xl border border-white/15 bg-[#121212]/90 shadow-lg backdrop-blur-md"
          aria-live="polite"
        >
          {showResults && autoFitBounds ? (
            <>
              <button
                type="button"
                className={BTN}
                onClick={onFitProject}
                title="Ir para area do projeto"
                aria-label="Centralizar o mapa na area do projeto"
              >
                <ScanSearch className="size-5" aria-hidden />
              </button>
              <div className="mx-3 h-px bg-white/10" />
            </>
          ) : null}
          <button
            type="button"
            className={BTN}
            onClick={onLocate}
            disabled={phase === 'loading' || !map}
            title="Minha localizacao"
            aria-label="Centralizar o mapa na minha localizacao"
          >
            {phase === 'loading' ? (
              <Loader2 className="size-5 animate-spin" aria-hidden />
            ) : (
              <Crosshair className="size-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
