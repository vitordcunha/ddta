export const PLANNER_BASE_LAYER_IDS = [
  "dark",
  "satellite",
  "streets",
  "topo",
] as const

export type PlannerBaseLayerId = (typeof PLANNER_BASE_LAYER_IDS)[number]

type BaseLayerConfig = {
  label: string
  url: string
  attribution: string
}

const layers: Record<PlannerBaseLayerId, BaseLayerConfig> = {
  satellite: {
    label: "Satelite",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: "Tiles &copy; Esri, DigitalGlobe, GeoEye, i-cubed, USDA, USGS, AEX, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community",
  },
  streets: {
    label: "Ruas (OSM)",
    url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
  topo: {
    label: "Terreno",
    url: "https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attribution:
      "Map: &copy; OpenStreetMap contributors, SRTM | &copy; OpenTopoMap (CC-BY-SA)",
  },
  dark: {
    label: "Escuro (Carto)",
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap &copy; CARTO",
  },
}

export function getPlannerBaseLayerConfig(
  id: PlannerBaseLayerId,
): BaseLayerConfig {
  return layers[id]
}
