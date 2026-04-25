import { memo, useEffect, useMemo } from 'react'
import * as turf from '@turf/turf'
import type { Feature, Polygon } from 'geojson'
import { MapContainer, Polygon as LeafletPolygon, TileLayer, Tooltip, useMap } from 'react-leaflet'
import type { PlannerBaseLayerId } from '@/features/flight-planner/constants/mapBaseLayers'
import { getPlannerBaseLayerConfig } from '@/features/flight-planner/constants/mapBaseLayers'
import type { CalibrationGridSlot, CalibrationSlotReport } from '@/services/projectsService'
import 'leaflet/dist/leaflet.css'

function FitBounds({
  calibration,
  slots,
  photoRings,
}: {
  calibration: Feature<Polygon>
  slots: CalibrationGridSlot[]
  photoRings: [number, number][][]
}) {
  const map = useMap()
  useEffect(() => {
    const feats: Feature<Polygon>[] = [calibration]
    for (const s of slots) {
      const fp = s.footprint_polygon
      if (fp?.type === 'Polygon' && fp.coordinates?.[0]?.length) {
        feats.push({ type: 'Feature', properties: {}, geometry: fp })
      }
    }
    for (const ring of photoRings) {
      if (ring.length >= 3) {
        feats.push({
          type: 'Feature',
          properties: {},
          geometry: { type: 'Polygon', coordinates: [ring.map(([la, ln]) => [ln, la])] },
        })
      }
    }
    const combined = turf.featureCollection(feats)
    const b = turf.bbox(combined)
    map.invalidateSize()
    map.fitBounds(
      [
        [b[1]!, b[0]!],
        [b[3]!, b[2]!],
      ],
      { padding: [12, 12], maxZoom: 19, animate: false },
    )
  }, [map, calibration, slots, photoRings])
  return null
}

function slotStyle(
  status: string,
  highlighted: boolean,
): { color: string; weight: number; fillColor: string; fillOpacity: number } {
  const base = highlighted ? 2.5 : 1.2
  switch (status) {
    case 'covered':
      return { color: '#15803d', weight: base, fillColor: '#22c55e', fillOpacity: highlighted ? 0.55 : 0.4 }
    case 'gap':
      return { color: '#991b1b', weight: base, fillColor: '#ef4444', fillOpacity: highlighted ? 0.55 : 0.45 }
    case 'warning':
      return { color: '#b45309', weight: base, fillColor: '#f59e0b', fillOpacity: 0.45 }
    case 'critical':
      return { color: '#7f1d1d', weight: base, fillColor: '#991b1b', fillOpacity: 0.5 }
    case 'best':
      return { color: '#14532d', weight: base, fillColor: '#15803d', fillOpacity: 0.5 }
    default:
      return { color: '#6b7280', weight: base, fillColor: '#9ca3af', fillOpacity: highlighted ? 0.4 : 0.28 }
  }
}

function formatTooltip(
  slot: { id: string; status: string },
  report?: CalibrationSlotReport,
): string {
  const lines = [`Slot ${slot.id.slice(0, 8)}…`, `Estado: ${slot.status}`]
  if (report) {
    if (report.n_photos_covering != null) lines.push(`Fotos no slot: ${report.n_photos_covering}`)
    if (report.blur_score != null) lines.push(`Laplaciano (nitidez): ${report.blur_score}`)
    if (report.clipping_ratio != null) lines.push(`Clipping máx.: ${(report.clipping_ratio * 100).toFixed(1)}%`)
    if (report.feature_overlap_with_neighbors != null) {
      lines.push(`ORB vizinhos (mín.): ${(report.feature_overlap_with_neighbors * 100).toFixed(1)}%`)
    }
  }
  return lines.join('\n')
}

type SlotLayerProps = {
  slotId: string
  ring: [number, number][]
  status: string
  /** Slot está selecionado via click (inspector lateral). */
  highlighted: boolean
  /** Slot está destacado via recomendação ativa. */
  recHighlighted: boolean
  tooltip: string
  onSlotClick?: (slotId: string) => void
}

const SlotLayer = memo(function SlotLayer({
  slotId,
  ring,
  status,
  highlighted,
  recHighlighted,
  tooltip,
  onSlotClick,
}: SlotLayerProps) {
  const base = slotStyle(status, highlighted)
  const pathOptions = recHighlighted
    ? { ...base, weight: 3.5, fillOpacity: Math.min(0.75, base.fillOpacity + 0.25), color: '#f97316' }
    : base
  return (
    <LeafletPolygon
      positions={ring}
      pathOptions={pathOptions}
      eventHandlers={
        onSlotClick
          ? {
              click: () => onSlotClick(slotId),
            }
          : undefined
      }
    >
      <Tooltip direction="top" sticky className="!rounded-md !border !border-neutral-700 !bg-neutral-900 !px-2 !py-1.5 !text-[11px] !leading-snug !text-neutral-100 !shadow-lg whitespace-pre">
        {tooltip}
      </Tooltip>
    </LeafletPolygon>
  )
})

export type PhotoFootprintLayer = {
  imageId: string
  ring: [number, number][]
}

export type CalibrationGridMapProps = {
  baseLayerId: PlannerBaseLayerId
  calibrationPolygon: Feature<Polygon>
  slots: CalibrationGridSlot[]
  /** Tailwind height class for the map box (default h-44). */
  heightClass?: string
  onSlotClick?: (slotId: string) => void
  /** Slot clicado (inspector lateral) — destaque com borda mais grossa. */
  highlightSlotId?: string | null
  /**
   * Slots destacados por uma recomendação ativa (Fase 5).
   * Exibidos com borda pulsante e fillOpacity aumentado.
   */
  highlightedSlotIds?: string[]
  /** Métricas por slot (relatório de píxeis) para tooltip rico. */
  slotReportsById?: Record<string, CalibrationSlotReport>
  /** Footprints aproximados por foto (EXIF + params), quando o toggle está ligado. */
  photoFootprints?: PhotoFootprintLayer[]
  showPhotoFootprints?: boolean
}

/**
 * Grade teórica de calibração (Fases 3b / 3-A / 4): slots, tooltips, footprints opcionais.
 */
export function CalibrationGridMap({
  baseLayerId,
  calibrationPolygon,
  slots,
  heightClass = 'h-44',
  onSlotClick,
  highlightSlotId,
  highlightedSlotIds,
  slotReportsById,
  photoFootprints = [],
  showPhotoFootprints = false,
}: CalibrationGridMapProps) {
  const highlightedSet = useMemo(
    () => new Set(highlightedSlotIds ?? []),
    [highlightedSlotIds],
  )
  const center = turf.centerOfMass(calibrationPolygon).geometry.coordinates
  const lat = center[1]!
  const lon = center[0]!
  const { url, attribution } = getPlannerBaseLayerConfig(baseLayerId)

  const calRing = calibrationPolygon.geometry.coordinates[0].map(
    ([lng, la]) => [la, lng] as [number, number],
  )

  const slotLayers = useMemo(() => {
    return slots
      .map((s) => {
        const fp = s.footprint_polygon
        if (fp?.type !== 'Polygon' || !fp.coordinates?.[0]?.length) return null
        const ring = fp.coordinates[0].map(([lng, la]) => [la, lng] as [number, number])
        const rep = slotReportsById?.[s.id]
        return {
          id: s.id,
          ring,
          status: String(s.status || 'empty'),
          tooltip: formatTooltip({ id: s.id, status: String(s.status) }, rep),
        }
      })
      .filter(Boolean) as { id: string; ring: [number, number][]; status: string; tooltip: string }[]
  }, [slots, slotReportsById])



  const photoRingsForBounds = useMemo(
    () => (showPhotoFootprints ? photoFootprints.map((p) => p.ring) : []),
    [showPhotoFootprints, photoFootprints],
  )

  return (
    <div className={`w-full overflow-hidden rounded-lg border border-white/10 ${heightClass}`}>
      <MapContainer
        center={[lat, lon]}
        zoom={17}
        className="h-full w-full bg-neutral-950"
        zoomControl={false}
        dragging
        scrollWheelZoom={false}
        doubleClickZoom={false}
        attributionControl
      >
        <TileLayer key={baseLayerId} url={url} attribution={attribution} maxZoom={19} />
        <FitBounds calibration={calibrationPolygon} slots={slots} photoRings={photoRingsForBounds} />
        <LeafletPolygon
          positions={calRing}
          pathOptions={{ color: '#38bdf8', weight: 2, fillColor: '#0ea5e9', fillOpacity: 0.12 }}
        />
        {slotLayers.map((sl) => (
          <SlotLayer
            key={sl.id}
            slotId={sl.id}
            ring={sl.ring}
            status={sl.status}
            highlighted={highlightSlotId === sl.id}
            recHighlighted={highlightedSet.has(sl.id)}
            tooltip={sl.tooltip}
            onSlotClick={onSlotClick}
          />
        ))}
        {showPhotoFootprints
          ? photoFootprints.map((p) => (
              <LeafletPolygon
                key={`fp-${p.imageId}`}
                positions={p.ring}
                pathOptions={{
                  color: '#a78bfa',
                  weight: 1,
                  dashArray: '4 6',
                  fillColor: '#8b5cf6',
                  fillOpacity: 0.12,
                }}
              />
            ))
          : null}
      </MapContainer>
    </div>
  )
}
