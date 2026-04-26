from fastapi import APIRouter

from app.api.v1 import (
    calibration_sessions,
    drone_models,
    flight_plans,
    flightplan,
    processing,
    processing_queue,
    projects,
    settings_api_keys,
    sse,
    tiles,
)

api_router = APIRouter()
api_router.include_router(projects.router)
api_router.include_router(settings_api_keys.router)
api_router.include_router(drone_models.router)
api_router.include_router(flightplan.router)
api_router.include_router(flight_plans.router)
api_router.include_router(calibration_sessions.router)
api_router.include_router(processing.router)
api_router.include_router(processing_queue.router)
api_router.include_router(sse.router)
api_router.include_router(tiles.router)
