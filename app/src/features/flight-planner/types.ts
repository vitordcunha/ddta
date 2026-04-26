import type { Feature, Polygon } from "geojson";

/** Nome do modelo (catálogo API ou legado). */
export type DroneModel = string;

export type DroneSpec = {
  model: DroneModel;
  image?: string;
  sensorWidthMm: number;
  sensorHeightMm: number;
  focalLengthMm: number;
  imageWidthPx: number;
  imageHeightPx: number;
  maxSpeedMs: number;
  batteryTimeMin: number;
};

export type SelectOption = {
  label: string;
  value: DroneModel;
};

export type FlightParams = {
  /** UUID do modelo na API; null até sincronizar com o catálogo ou planos antigos. */
  droneModelId: string | null;
  droneModel: DroneModel;
  altitudeM: number;
  forwardOverlap: number;
  sideOverlap: number;
  rotationDeg: number;
  speedMs: number;
};

export type { PointOfInterest, Waypoint } from "@/features/flight-planner/types/waypoint";
export { migrateWaypoint, migrateWaypoints } from "@/features/flight-planner/types/waypoint";

export type Strip = {
  id: string;
  coordinates: [number, number][];
};

export type FlightStats = {
  gsdCm: number;
  areaHa: number;
  waypointCount: number;
  stripCount: number;
  estimatedPhotos: number;
  estimatedTimeMin: number;
  batteryCount: number;
  distanceKm: number;
};

export type WeatherForecastHour = {
  /** ISO local (Open-Meteo, timezone=auto) */
  time: string;
  tempC: number;
  precipProbPct: number;
  precipMm: number;
  weatherCode: number;
};

export type WeatherData = {
  windSpeedMs: number;
  windDirectionDeg: number;
  temperatureC: number;
  cloudCoveragePct: number;
  /** Precipitacao total atual (mm/h equivalente agregado) */
  rainMmH: number;
  /** Codigo WMO; ver interpretacao em weatherHelpers */
  weatherCode?: number;
  conditionLabel?: string;
  /** Precipitacao mensuravel agora (chuva/chuvisco, etc.) */
  isPrecipitatingNow?: boolean;
  relativeHumidityPct?: number;
  apparentTemperatureC?: number;
  pressureHpa?: number;
  windGustsMs?: number;
  isDay?: boolean;
  /** Chuva e aguaceiros separados (mm/h), quando disponiveis */
  rainMmHRaw?: number;
  showersMmH?: number;
  /** Proximas horas (tipicamente 24) */
  hourlyForecast?: WeatherForecastHour[];
};

export type FlightAssessment = {
  go: boolean;
  issues: string[];
  warnings: string[];
  tips: string[];
};

export type PlannerGeoPolygon = Feature<Polygon>;
