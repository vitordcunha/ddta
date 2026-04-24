import {
  CircleMarker,
  GeoJSON,
  Polygon,
  Polyline,
  TileLayer,
  useMap,
  useMapEvents,
} from 'react-leaflet'
import { sampleContours } from '@/features/results/mocks/completedProject'
import { useResultsViewStore } from '@/features/results/stores/useResultsViewStore'
import 'leaflet/dist/leaflet.css'

const BOUNDS: [[number, number], [number, number]] = [
  [-15.7965, -47.886],
  [-15.7912, -47.8798],
]

export function ResultsMapInnerLayers() {
  const activeLayer = useResultsViewStore((s) => s.activeLayer)
  const opacity = useResultsViewStore((s) => s.opacity)
  const tool = useResultsViewStore((s) => s.tool)
  const distancePoints = useResultsViewStore((s) => s.distancePoints)
  const areaPoints = useResultsViewStore((s) => s.areaPoints)
  const elevationPoint = useResultsViewStore((s) => s.elevationPoint)
  const addDistancePoint = useResultsViewStore((s) => s.addDistancePoint)
  const addAreaPoint = useResultsViewStore((s) => s.addAreaPoint)
  const setElevationPoint = useResultsViewStore((s) => s.setElevationPoint)

  return (
    <>
      <TileLayer
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        attribution="Tiles &copy; Esri"
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
            const e = feature.properties?.elevation
            if (e) layer.bindTooltip(`${e} m`)
          }}
        />
      ) : null}

      {distancePoints.length > 1 ? (
        <Polyline
          positions={distancePoints}
          pathOptions={{ color: '#22d3ee', weight: 2 }}
        />
      ) : null}
      {areaPoints.length > 2 ? (
        <Polygon
          positions={areaPoints}
          pathOptions={{ color: '#60a5fa', dashArray: '4 4', fillOpacity: 0.25 }}
        />
      ) : null}
      {distancePoints.map((point, index) => (
        <CircleMarker
          key={`d-${String(index)}`}
          center={point}
          radius={4}
          pathOptions={{ color: '#22d3ee' }}
        />
      ))}
      {areaPoints.map((point, index) => (
        <CircleMarker
          key={`a-${String(index)}`}
          center={point}
          radius={4}
          pathOptions={{ color: '#60a5fa' }}
        />
      ))}
      {elevationPoint ? (
        <CircleMarker
          center={elevationPoint}
          radius={5}
          pathOptions={{ color: '#fbbf24' }}
        />
      ) : null}

      <MapToolEvents
        tool={tool}
        onAddDistance={addDistancePoint}
        onAddArea={addAreaPoint}
        onPickElevation={setElevationPoint}
      />
      <FitBoundsControl />
    </>
  )
}

function FitBoundsControl() {
  const map = useMap()
  return (
    <button
      type="button"
      className="leaflet-top leaflet-right z-[650] mr-2 mt-20 rounded-md border border-[#2e2e2e] bg-[#0f0f0f]/95 px-2 py-1 text-xs text-[#fafafa] backdrop-blur"
      onClick={() => map.fitBounds(BOUNDS)}
    >
      Ajustar
    </button>
  )
}

function MapToolEvents({
  tool,
  onAddDistance,
  onAddArea,
  onPickElevation,
}: {
  tool: 'none' | 'distance' | 'area' | 'elevation'
  onAddDistance: (p: [number, number]) => void
  onAddArea: (p: [number, number]) => void
  onPickElevation: (p: [number, number] | null) => void
}) {
  useMapEvents({
    click(event) {
      const point: [number, number] = [event.latlng.lat, event.latlng.lng]
      if (tool === 'distance') onAddDistance(point)
      if (tool === 'area') onAddArea(point)
      if (tool === 'elevation') onPickElevation(point)
    },
    contextmenu(event) {
      event.originalEvent.preventDefault()
    },
  })
  return null
}
