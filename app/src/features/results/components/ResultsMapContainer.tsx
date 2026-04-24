import { useMemo, useState } from 'react'
import * as turf from '@turf/turf'
import { Crosshair, Maximize2, Minimize2, Ruler, Square, Trash2 } from 'lucide-react'
import { CircleMarker, GeoJSON, MapContainer, Polygon, Polyline, TileLayer, useMap, useMapEvents } from 'react-leaflet'
import { Button } from '@/components/ui'
import { sampleContours } from '@/features/results/mocks/completedProject'
import type { ResultLayerId } from '@/features/results/types'
import 'leaflet/dist/leaflet.css'

interface ResultsMapContainerProps {
  activeLayer: ResultLayerId
  opacity: number
  onOpacityChange: (value: number) => void
}

type ToolId = 'none' | 'distance' | 'area' | 'elevation'

const bounds: [[number, number], [number, number]] = [
  [-15.7965, -47.886],
  [-15.7912, -47.8798],
]

export function ResultsMapContainer({ activeLayer, opacity, onOpacityChange }: ResultsMapContainerProps) {
  const [isFullscreen, setIsFullscreen] = useState(false)
  const [tool, setTool] = useState<ToolId>('none')
  const [distancePoints, setDistancePoints] = useState<[number, number][]>([])
  const [areaPoints, setAreaPoints] = useState<[number, number][]>([])
  const [elevationPoint, setElevationPoint] = useState<[number, number] | null>(null)

  const distanceResult = useMemo(() => {
    if (distancePoints.length < 2) return null
    const line = turf.lineString(distancePoints.map(([lat, lon]) => [lon, lat]))
    const km = turf.length(line, { units: 'kilometers' })
    return km >= 1 ? `${km.toFixed(3).replace('.', ',')} km` : `${(km * 1000).toFixed(2).replace('.', ',')} m`
  }, [distancePoints])

  const areaResult = useMemo(() => {
    if (areaPoints.length < 3) return null
    const ring = [...areaPoints, areaPoints[0]].map(([lat, lon]) => [lon, lat])
    const polygon = turf.polygon([ring])
    const squareMeters = turf.area(polygon)
    const hectares = squareMeters / 10000
    return `${squareMeters.toFixed(1).replace('.', ',')} m2 (${hectares.toFixed(2).replace('.', ',')} ha)`
  }, [areaPoints])

  return (
    <div className={isFullscreen ? 'fixed inset-0 z-[80] bg-neutral-950' : 'relative h-[58vh] min-h-[420px] overflow-hidden rounded-xl border border-neutral-800'}>
      <MapContainer center={[-15.793889, -47.882778]} zoom={16} className="h-full w-full">
        <TileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
          attribution="Tiles © Esri"
        />
        {activeLayer === 'orthophoto' ? (
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            opacity={opacity / 100}
            attribution="&copy; OpenStreetMap contributors"
          />
        ) : null}
        {activeLayer === 'dsm' ? (
          <TileLayer
            url="https://stamen-tiles.a.ssl.fastly.net/terrain/{z}/{x}/{y}.jpg"
            opacity={opacity / 100}
            attribution="Map tiles by Stamen Design"
          />
        ) : null}
        {activeLayer === 'dtm' ? (
          <TileLayer
            url="https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png"
            opacity={opacity / 100}
            attribution="&copy; OpenTopoMap contributors"
          />
        ) : null}
        {activeLayer === 'contours' ? (
          <GeoJSON
            data={sampleContours as GeoJSON.GeoJsonObject}
            style={() => ({ color: '#7dd3fc', weight: 1, opacity: opacity / 100 })}
            onEachFeature={(feature, layer) => {
              const elevation = feature.properties?.elevation
              if (elevation) layer.bindTooltip(`${elevation} m`)
            }}
          />
        ) : null}

        {distancePoints.length > 1 ? <Polyline positions={distancePoints} pathOptions={{ color: '#22d3ee', weight: 2 }} /> : null}
        {areaPoints.length > 2 ? <Polygon positions={areaPoints} pathOptions={{ color: '#60a5fa', dashArray: '4 4', fillOpacity: 0.25 }} /> : null}
        {distancePoints.map((point, index) => (
          <CircleMarker key={`d-${index}`} center={point} radius={4} pathOptions={{ color: '#22d3ee' }} />
        ))}
        {areaPoints.map((point, index) => (
          <CircleMarker key={`a-${index}`} center={point} radius={4} pathOptions={{ color: '#60a5fa' }} />
        ))}
        {elevationPoint ? <CircleMarker center={elevationPoint} radius={5} pathOptions={{ color: '#fbbf24' }} /> : null}

        <MapToolEvents
          tool={tool}
          onAddDistancePoint={(point) => setDistancePoints((prev) => [...prev, point])}
          onAddAreaPoint={(point) => setAreaPoints((prev) => [...prev, point])}
          onPickElevation={setElevationPoint}
        />
        <FitBoundsControl />
      </MapContainer>

      <div className="absolute left-3 top-3 z-[600] flex rounded-lg border border-neutral-700 bg-neutral-950/90 p-1">
        {(['orthophoto', 'dsm', 'dtm', 'contours'] as ResultLayerId[]).map((id) => (
          <span key={id} className={['rounded-md px-2 py-1 text-xs', activeLayer === id ? 'bg-primary-500/20 text-primary-300' : 'text-neutral-400'].join(' ')}>
            {id === 'orthophoto' ? 'Ortomosaico' : id === 'dsm' ? 'MDS' : id === 'dtm' ? 'MDT' : 'Curvas'}
          </span>
        ))}
      </div>

      <div className="absolute right-3 top-3 z-[600] flex flex-col gap-2">
        <Button size="sm" variant="outline" onClick={() => setIsFullscreen((prev) => !prev)}>
          {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        </Button>
      </div>

      <div className="absolute right-3 top-20 z-[600] rounded-xl border border-neutral-700 bg-neutral-950/90 p-2">
        <input
          type="range"
          min={0}
          max={100}
          value={opacity}
          onChange={(event) => onOpacityChange(Number(event.target.value))}
          className="h-28 [writing-mode:vertical-lr]"
          aria-label="Opacidade da camada"
        />
      </div>

      <div className="absolute bottom-3 left-3 z-[600] flex gap-2 rounded-xl border border-neutral-700 bg-neutral-950/90 p-2">
        <Button size="sm" variant={tool === 'distance' ? 'primary' : 'outline'} onClick={() => setTool('distance')}>
          <Ruler className="mr-1 h-4 w-4" />
          Distancia
        </Button>
        <Button size="sm" variant={tool === 'area' ? 'primary' : 'outline'} onClick={() => setTool('area')}>
          <Square className="mr-1 h-4 w-4" />
          Area
        </Button>
        <Button size="sm" variant={tool === 'elevation' ? 'primary' : 'outline'} onClick={() => setTool('elevation')}>
          <Crosshair className="mr-1 h-4 w-4" />
          Cota
        </Button>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            setDistancePoints([])
            setAreaPoints([])
            setElevationPoint(null)
            setTool('none')
          }}
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {(distanceResult || areaResult || elevationPoint) && (
        <div className="absolute bottom-3 right-3 z-[600] rounded-xl border border-neutral-700 bg-neutral-950/90 p-3 text-xs text-neutral-200">
          {distanceResult ? <p>Distancia: {distanceResult}</p> : null}
          {areaResult ? <p>Area: {areaResult}</p> : null}
          {elevationPoint ? <p>Cota: 1.024,3 m (datum WGS84)</p> : null}
        </div>
      )}
    </div>
  )
}

function FitBoundsControl() {
  const map = useMap()
  return (
    <button
      type="button"
      className="leaflet-top leaflet-right z-[650] mr-2 mt-20 rounded-md border border-neutral-700 bg-neutral-950 px-2 py-1 text-xs text-neutral-100"
      onClick={() => map.fitBounds(bounds)}
    >
      Fit
    </button>
  )
}

function MapToolEvents({
  tool,
  onAddDistancePoint,
  onAddAreaPoint,
  onPickElevation,
}: {
  tool: ToolId
  onAddDistancePoint: (point: [number, number]) => void
  onAddAreaPoint: (point: [number, number]) => void
  onPickElevation: (point: [number, number]) => void
}) {
  useMapEvents({
    click(event) {
      const point: [number, number] = [event.latlng.lat, event.latlng.lng]
      if (tool === 'distance') onAddDistancePoint(point)
      if (tool === 'area') onAddAreaPoint(point)
      if (tool === 'elevation') onPickElevation(point)
    },
    contextmenu(event) {
      event.originalEvent.preventDefault()
    },
  })
  return null
}
