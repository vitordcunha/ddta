from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from app.core.flight.calculator import (
    calculate_footprint,
    calculate_gsd,
    calculate_spacings,
    calculate_stats,
    generate_flight_grid,
    generate_waypoints,
)
from app.core.flight.drone_specs import get_specs
from app.core.flight.kmz_generator import generate_dji_kmz
from app.schemas.flightplan import (
    FlightPlanRequest,
    FlightStatsResponse,
    WaypointItem,
    WaypointResponse,
)

router = APIRouter(prefix="/flightplan", tags=["flightplan"])


def _compute_flightplan(payload: FlightPlanRequest):
    specs = get_specs(payload.drone_model)
    gsd = calculate_gsd(payload.altitude_m, specs)
    footprint = calculate_footprint(gsd, specs)
    spacings = calculate_spacings(footprint, payload.forward_overlap, payload.side_overlap)
    strips = generate_flight_grid(payload.polygon_geojson, spacings, payload.rotation_angle)
    waypoints = generate_waypoints(strips, payload.altitude_m)
    stats = calculate_stats(waypoints, payload.polygon_geojson, specs, payload.speed_ms)
    return strips, waypoints, stats


@router.post("/calculate", response_model=WaypointResponse)
async def calculate(payload: FlightPlanRequest) -> WaypointResponse:
    try:
        strips, waypoints, stats = _compute_flightplan(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    strip_responses: list[list[WaypointItem]] = []
    for strip in strips:
        strip_responses.append(
            [
                WaypointItem(order=index + 1, lon=point[0], lat=point[1], altitude_m=payload.altitude_m)
                for index, point in enumerate(strip)
            ]
        )

    return WaypointResponse(
        waypoints=[
            WaypointItem(order=wp.order, lon=wp.lon, lat=wp.lat, altitude_m=wp.altitude_m)
            for wp in waypoints
        ],
        waylines=strip_responses,
        stats=FlightStatsResponse(
            area_m2=stats.area_m2,
            distance_m=stats.distance_m,
            estimated_duration_s=stats.estimated_duration_s,
            strip_count=stats.strip_count,
            waypoint_count=stats.waypoint_count,
        ),
    )


@router.post("/export-kmz")
async def export_kmz(payload: FlightPlanRequest) -> StreamingResponse:
    try:
        _, waypoints, _ = _compute_flightplan(payload)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    kmz_data = generate_dji_kmz(
        waypoints=waypoints,
        altitude=payload.altitude_m,
        speed=payload.speed_ms,
        drone_model=payload.drone_model,
    )

    return StreamingResponse(
        iter([kmz_data]),
        media_type="application/vnd.google-earth.kmz",
        headers={"Content-Disposition": 'attachment; filename="flightplan.kmz"'},
    )
