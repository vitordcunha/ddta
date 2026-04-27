import { useLayoutEffect } from "react";
import type { WeatherMapOverlayPreferences } from "@/components/map/weather/mapWeatherTypes";
import { clampMapZoomToWeatherMapLayer } from "@/components/map/weather/weatherMapLayerZoomBounds";
import { useMapEngine } from "@/features/map-engine/useMapEngine";

/**
 * Ao ativar (ou trocar) camada de clima, alinha o zoom do mapa à faixa de
 * tiles suportada (p.ex. RainViewer z≤7, OWM z≤9) sem alterar o centro.
 * Também corrige sessão restaurada do localStorage (overlay + zoom gravados).
 */
export function useWeatherMapLayerZoomClamp(overlay: WeatherMapOverlayPreferences) {
  const { layerId } = overlay;
  const { zoom, setCenterZoom, getMapCenter } = useMapEngine();

  useLayoutEffect(() => {
    if (layerId === "none") return;
    const target = clampMapZoomToWeatherMapLayer(layerId, zoom);
    if (target !== zoom) {
      setCenterZoom(getMapCenter(), target);
    }
    // Só ao mudar a camada (ou montagem com overlay ativo), não a cada pan/zoom.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layerId]);
}
