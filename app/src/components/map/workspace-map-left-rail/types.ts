import type { WeatherMapOverlayPreferences } from "@/components/map/weather/mapWeatherTypes";
import type { RadarOverlayStatus } from "@/components/map/PlannerWeatherMapLayers";

export type PlanRailProps = {
  variant: "plan";
  projectId: string | null;
  overlay: WeatherMapOverlayPreferences;
  setOverlay: (
    next:
      | WeatherMapOverlayPreferences
      | ((prev: WeatherMapOverlayPreferences) => WeatherMapOverlayPreferences),
  ) => void;
  openWeatherApiKey: string;
  radarStatus: RadarOverlayStatus;
  radarMessage?: string;
};

export type ResultsRailProps = { variant: "results" };

export type WorkspaceMapLeftRailProps = PlanRailProps | ResultsRailProps;
