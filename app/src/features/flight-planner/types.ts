import type { Feature, Polygon } from "geojson";

export type DroneModel =
  | "Mini 4 Pro"
  | "Mini 5 Pro"
  | "Air 3"
  | "Mavic 3"
  | "Phantom 4";

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
  droneModel: DroneModel;
  altitudeM: number;
  forwardOverlap: number;
  sideOverlap: number;
  rotationDeg: number;
  speedMs: number;
};

export type Waypoint = {
  id: string;
  lat: number;
  lon: number;
  altitudeM: number;
  stripIndex: number;
};

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
