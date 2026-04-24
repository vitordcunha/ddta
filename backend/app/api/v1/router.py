from fastapi import APIRouter

from app.api.v1 import flightplan, processing, projects, sse

api_router = APIRouter()
api_router.include_router(projects.router)
api_router.include_router(flightplan.router)
api_router.include_router(processing.router)
api_router.include_router(sse.router)
