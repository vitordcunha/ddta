import { useEffect } from "react";
import turfBbox from "@turf/bbox";
import centerOfMass from "@turf/center-of-mass";
import { featureCollection } from "@turf/helpers";
import type { Feature, Polygon } from "geojson";
import {
  MapContainer,
  Polygon as LeafletPolygon,
  TileLayer,
  useMap,
} from "react-leaflet";
import type { PlannerBaseLayerId } from "@/features/flight-planner/constants/mapBaseLayers";
import { getPlannerBaseLayerConfig } from "@/features/flight-planner/constants/mapBaseLayers";
import "leaflet/dist/leaflet.css";

function FitBounds({
  calibration,
  missionOutline,
}: {
  calibration: Feature<Polygon>;
  missionOutline: Feature<Polygon> | null;
}) {
  const map = useMap();
  useEffect(() => {
    const combined = missionOutline
      ? featureCollection([calibration, missionOutline])
      : calibration;
    const b = turfBbox(combined);
    map.invalidateSize();
    map.fitBounds(
      [
        [b[1]!, b[0]!],
        [b[3]!, b[2]!],
      ],
      { padding: [14, 14], maxZoom: 19, animate: false },
    );
  }, [map, calibration, missionOutline]);
  return null;
}

export type PreFlightCalibrationMapPreviewProps = {
  /** Mesma camada de fundo do planejador principal. */
  baseLayerId: PlannerBaseLayerId;
  calibrationPolygon: Feature<Polygon>;
  /** Contorno da área completa (opcional), desenhado mais discreto. */
  missionPolygon?: Feature<Polygon> | null;
};

/**
 * Mapa compacto para o modal pré-voo: área de calibração sobre a mesma base de tiles do planejador.
 */
export function PreFlightCalibrationMapPreview({
  baseLayerId,
  calibrationPolygon,
  missionPolygon,
}: PreFlightCalibrationMapPreviewProps) {
  const center = centerOfMass(calibrationPolygon).geometry.coordinates;
  const lat = center[1]!;
  const lon = center[0]!;
  const { url, attribution } = getPlannerBaseLayerConfig(baseLayerId);

  const calRing = calibrationPolygon.geometry.coordinates[0].map(
    ([lng, la]) => [la, lng] as [number, number],
  );
  const missionRing =
    missionPolygon?.geometry.coordinates[0].map(
      ([lng, la]) => [la, lng] as [number, number],
    ) ?? [];

  return (
    <div className="h-40 w-full overflow-hidden rounded-lg border border-white/10">
      <MapContainer
        center={[lat, lon]}
        zoom={16}
        className="h-full w-full bg-neutral-950"
        zoomControl={false}
        dragging
        scrollWheelZoom={false}
        doubleClickZoom={false}
        attributionControl
      >
        <TileLayer
          key={baseLayerId}
          url={url}
          attribution={attribution}
          maxZoom={19}
        />
        <FitBounds
          calibration={calibrationPolygon}
          missionOutline={missionPolygon ?? null}
        />
        {missionRing.length > 2 ? (
          <LeafletPolygon
            positions={missionRing}
            pathOptions={{ color: "#64748b", weight: 1.5, fillOpacity: 0.06 }}
          />
        ) : null}
        <LeafletPolygon
          positions={calRing}
          pathOptions={{
            color: "#38bdf8",
            weight: 2,
            fillColor: "#0ea5e9",
            fillOpacity: 0.22,
          }}
        />
      </MapContainer>
    </div>
  );
}
