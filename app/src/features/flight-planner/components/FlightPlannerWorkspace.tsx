import { type ReactNode, useEffect, useMemo, useState } from "react";
import * as turf from "@turf/turf";
import {
  Check,
  CloudRain,
  Compass,
  Download,
  Loader2,
  Thermometer,
  TriangleAlert,
  Wind,
} from "lucide-react";
import {
  CircleMarker,
  MapContainer,
  Polygon,
  Polyline,
  TileLayer,
  Tooltip,
  useMapEvents,
} from "react-leaflet";
import { Badge, Button, Card } from "@/components/ui";
import { useFlightCalculator } from "@/features/flight-planner/hooks/useFlightCalculator";
import { useKmzExport } from "@/features/flight-planner/hooks/useKmzExport";
import { useWeather } from "@/features/flight-planner/hooks/useWeather";
import { getDroneOptions } from "@/features/flight-planner/utils/droneSpecs";
import { windDegToCompass } from "@/features/flight-planner/utils/weatherHelpers";
import { useFlightStore } from "@/features/flight-planner/stores/useFlightStore";
import type { PersistedFlightPlan } from "@/features/flight-planner/stores/useFlightStore";

import "leaflet/dist/leaflet.css";

type Props = {
  projectName: string;
  initialPlan: PersistedFlightPlan | null;
  onSavePlan: (plan: PersistedFlightPlan) => void;
};

const format = {
  number: (value: number, digits = 1) =>
    value.toFixed(digits).replace(".", ","),
};

export function FlightPlannerWorkspace({
  projectName,
  initialPlan,
  onSavePlan,
}: Props) {
  const [draftPoints, setDraftPoints] = useState<[number, number][]>([]);
  const {
    polygon,
    params,
    waypoints,
    stats,
    weather,
    assessment,
    setPolygon,
    setParams,
    setResult,
    setWeather,
    loadPlan,
    setIsCalculating,
  } = useFlightStore();

  const {
    strips,
    waypoints: calcWaypoints,
    stats: calcStats,
    isCalculating,
  } = useFlightCalculator(polygon, params);
  const weatherQuery = useWeather(params.droneModel, params.altitudeM);
  const kmzExport = useKmzExport(projectName);
  const {
    fetchWeather,
    weather: currentWeather,
    assessment: currentAssessment,
    isLoading: isWeatherLoading,
    error: weatherError,
  } = weatherQuery;

  useEffect(() => {
    if (initialPlan) loadPlan(initialPlan);
  }, [initialPlan, loadPlan]);

  useEffect(() => {
    setIsCalculating(isCalculating);
    setResult(calcWaypoints, calcStats);
  }, [calcStats, calcWaypoints, isCalculating, setIsCalculating, setResult]);

  useEffect(() => {
    if (!polygon) return;
    const center = turf.centerOfMass(polygon).geometry.coordinates;
    fetchWeather(center[1], center[0]);
  }, [fetchWeather, polygon]);

  useEffect(() => {
    setWeather(currentWeather, currentAssessment);
  }, [currentAssessment, currentWeather, setWeather]);

  const polygonCoords = useMemo(
    () =>
      polygon?.geometry.coordinates[0].map(
        ([lon, lat]) => [lat, lon] as [number, number],
      ) ?? [],
    [polygon],
  );
  const hasPlan = Boolean(polygon && waypoints.length > 0 && stats);

  const saveCurrentPlan = () => {
    onSavePlan({
      polygon,
      params,
      waypoints,
      stats,
      weather,
      assessment,
    });
  };

  return (
    <div className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
      <Card className="relative h-[65vh] min-h-[440px] overflow-hidden p-0">
        <MapContainer
          center={[-15.793889, -47.882778]}
          zoom={15}
          className="h-full w-full"
        >
          <TileLayer
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            attribution="&copy; OpenStreetMap contributors"
          />
          <MapClickCapture
            onAdd={(point) => setDraftPoints((current) => [...current, point])}
          />

          {draftPoints.length > 1 && (
            <Polyline
              positions={draftPoints}
              pathOptions={{ color: "#60A5FA", dashArray: "4 4" }}
            />
          )}

          {polygonCoords.length > 0 && (
            <Polygon
              positions={polygonCoords}
              pathOptions={{ color: "#60A5FA", fillOpacity: 0.2 }}
            />
          )}
          {strips.map((strip) => (
            <Polyline
              key={strip.id}
              positions={strip.coordinates.map(([lon, lat]) => [lat, lon])}
              pathOptions={{ color: "#00c573", weight: 2, opacity: 0.75 }}
            />
          ))}
          {waypoints.map((waypoint) => (
            <CircleMarker
              key={waypoint.id}
              center={[waypoint.lat, waypoint.lon]}
              radius={3}
              pathOptions={{ color: "#fafafa" }}
            >
              <Tooltip>
                {waypoint.lat.toFixed(6)}, {waypoint.lon.toFixed(6)} |{" "}
                {waypoint.altitudeM}m
              </Tooltip>
            </CircleMarker>
          ))}
        </MapContainer>
        <div className="absolute left-4 top-4 z-[600] flex gap-2">
          <Button
            size="sm"
            variant="secondary"
            disabled={draftPoints.length < 3}
            onClick={() => {
              if (draftPoints.length < 3) return;
              const ring = draftPoints.map(
                ([lat, lon]) => [lon, lat] as [number, number],
              );
              setPolygon({
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Polygon",
                  coordinates: [[...ring, ring[0]]],
                },
              });
              setDraftPoints([]);
            }}
          >
            Fechar poligono
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraftPoints([]);
              setPolygon(null);
            }}
          >
            Limpar
          </Button>
        </div>
      </Card>

      <div className="space-y-4">
        <Card className="space-y-3">
          <h3 className="text-sm font-medium text-neutral-200">
            Parametros de voo
          </h3>
          <label className="grid gap-1 text-xs text-neutral-400">
            Drone
            <select
              className="input-base"
              value={params.droneModel}
              onChange={(event) =>
                setParams({
                  droneModel: event.target.value as typeof params.droneModel,
                })
              }
            >
              {getDroneOptions().map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <Range
            label="Altitude"
            value={params.altitudeM}
            min={30}
            max={300}
            step={5}
            onChange={(value) => setParams({ altitudeM: value })}
          />
          <Range
            label="Sobreposicao frontal"
            value={params.forwardOverlap}
            min={60}
            max={95}
            step={1}
            onChange={(value) => setParams({ forwardOverlap: value })}
          />
          <Range
            label="Sobreposicao lateral"
            value={params.sideOverlap}
            min={60}
            max={90}
            step={1}
            onChange={(value) => setParams({ sideOverlap: value })}
          />
          <Range
            label="Rotacao"
            value={params.rotationDeg}
            min={0}
            max={180}
            step={1}
            onChange={(value) => setParams({ rotationDeg: value })}
          />
          <Range
            label="Velocidade"
            value={params.speedMs}
            min={3}
            max={15}
            step={1}
            onChange={(value) => setParams({ speedMs: value })}
          />
        </Card>

        <Card className="space-y-2">
          <h3 className="text-sm font-medium text-neutral-200">Estatisticas</h3>
          {stats ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <Stat
                label="GSD"
                value={`${format.number(stats.gsdCm, 2)} cm/px`}
              />
              <Stat
                label="Area"
                value={`${format.number(stats.areaHa, 2)} ha`}
              />
              <Stat label="Waypoints" value={String(stats.waypointCount)} />
              <Stat label="Faixas" value={String(stats.stripCount)} />
              <Stat label="Fotos" value={String(stats.estimatedPhotos)} />
              <Stat
                label="Tempo"
                value={`${format.number(stats.estimatedTimeMin, 0)} min`}
              />
              <Stat label="Baterias" value={String(stats.batteryCount)} />
              <Stat
                label="Distancia"
                value={`${format.number(stats.distanceKm, 2)} km`}
              />
            </div>
          ) : (
            <p className="text-sm text-neutral-400">
              Desenhe uma area para calcular o plano.
            </p>
          )}
          {isCalculating && (
            <div className="inline-flex items-center gap-2 text-xs text-neutral-300">
              <Loader2 className="size-3 animate-spin" /> Recalculando...
            </div>
          )}
        </Card>

        <Card className="space-y-3">
          <h3 className="text-sm font-medium text-neutral-200">Clima (mock)</h3>
          {isWeatherLoading ? (
            <p className="text-sm text-neutral-400">Carregando clima...</p>
          ) : currentWeather ? (
            <>
              {assessment && (
                <Badge
                  variant={assessment.go ? "success" : "error"}
                  className="inline-flex items-center gap-1"
                >
                  {assessment.go ? (
                    <Check className="size-3" />
                  ) : (
                    <TriangleAlert className="size-3" />
                  )}
                  {assessment.go
                    ? "Condicoes adequadas"
                    : "Voo nao recomendado"}
                </Badge>
              )}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <Stat
                  icon={<Wind className="size-3" />}
                  label="Vento"
                  value={`${currentWeather.windSpeedMs} m/s`}
                />
                <Stat
                  icon={<Compass className="size-3" />}
                  label="Direcao"
                  value={`${windDegToCompass(currentWeather.windDirectionDeg)} (${currentWeather.windDirectionDeg}º)`}
                />
                <Stat
                  icon={<Thermometer className="size-3" />}
                  label="Temperatura"
                  value={`${currentWeather.temperatureC} ºC`}
                />
                <Stat
                  icon={<CloudRain className="size-3" />}
                  label="Chuva"
                  value={`${currentWeather.rainMmH} mm/h`}
                />
              </div>
            </>
          ) : (
            <p className="text-sm text-neutral-400">
              O clima aparece apos desenhar a area.
            </p>
          )}
        </Card>

        <Card className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Button onClick={saveCurrentPlan} disabled={!hasPlan}>
              Salvar plano
            </Button>
            <Button
              variant="outline"
              onClick={() => kmzExport.generateAndDownload(waypoints, params)}
              disabled={!hasPlan || kmzExport.status === "generating"}
            >
              <Download className="mr-1 size-4" />
              {kmzExport.status === "generating" ? "Gerando..." : "Baixar KMZ"}
            </Button>
          </div>
          {weatherError && (
            <p className="text-xs text-red-400">{weatherError}</p>
          )}
        </Card>
      </div>
    </div>
  );
}

function MapClickCapture({
  onAdd,
}: {
  onAdd: (point: [number, number]) => void;
}) {
  useMapEvents({
    click: (event) => onAdd([event.latlng.lat, event.latlng.lng]),
  });

  return null;
}

function Range({
  label,
  value,
  min,
  max,
  step,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="grid gap-1 text-xs text-neutral-400">
      <div className="flex items-center justify-between">
        <span>{label}</span>
        <span className="font-mono text-neutral-200">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}

function Stat({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900 px-2 py-1.5">
      <p className="mb-1 inline-flex items-center gap-1 text-[11px] uppercase tracking-wide text-neutral-500">
        {icon}
        {label}
      </p>
      <p className="text-sm font-medium text-neutral-100">{value}</p>
    </div>
  );
}
