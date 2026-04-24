import { PlannerMapZoomControl } from "@/features/flight-planner/components/PlannerMapZoomControl"
import {
  MapUserLocationLayers,
  MapUserLocationToolbar,
  type MapUserLocationProps,
} from "@/components/map/MapUserLocation"

type MapBottomLeftControlsProps = MapUserLocationProps

/**
 * Zoom +/-, localizacao e marcadores do usuario no canto inferior esquerdo.
 */
export function MapBottomLeftControls(props: MapBottomLeftControlsProps) {
  const { position, error, phase, locate } = props

  return (
    <>
      <MapUserLocationLayers position={position} />

      <div
        className="pointer-events-none absolute z-[2000] flex flex-col gap-2"
        style={{
          left: "max(0.75rem, env(safe-area-inset-left, 0px))",
          bottom:
            "max(6rem, calc(0.75rem + var(--safe-area-bottom, 0px)))",
        }}
      >
        <PlannerMapZoomControl />
        <MapUserLocationToolbar
          error={error}
          phase={phase}
          locate={locate}
        />
      </div>
    </>
  )
}
