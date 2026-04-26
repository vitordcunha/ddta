from typing import Annotated

from fastapi import APIRouter, Depends, Header
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.workspace_map_api_keys import WorkspaceMapApiKeys
from app.dependencies import get_db
from app.schemas.map_api_keys import MapApiKeysResponse, MapApiKeysUpdate

router = APIRouter(prefix="/settings", tags=["settings"])


def _workspace_id(
    x_workspace_id: Annotated[str | None, Header(alias="X-Workspace-Id")] = None,
) -> str:
    w = (x_workspace_id or "default").strip()
    return w or "default"


@router.get("/api-keys", response_model=MapApiKeysResponse)
async def get_map_api_keys(
    db: AsyncSession = Depends(get_db),
    workspace_id: str = Depends(_workspace_id),
) -> MapApiKeysResponse:
    row = await db.execute(
        select(WorkspaceMapApiKeys).where(WorkspaceMapApiKeys.workspace_id == workspace_id),
    )
    obj = row.scalar_one_or_none()
    if obj is None:
        return MapApiKeysResponse()
    return MapApiKeysResponse(
        mapbox_api_key=obj.mapbox_api_key,
        google_maps_api_key=obj.google_maps_api_key,
    )


@router.put("/api-keys", response_model=MapApiKeysResponse)
async def put_map_api_keys(
    body: MapApiKeysUpdate,
    db: AsyncSession = Depends(get_db),
    workspace_id: str = Depends(_workspace_id),
) -> MapApiKeysResponse:
    row = await db.execute(
        select(WorkspaceMapApiKeys).where(WorkspaceMapApiKeys.workspace_id == workspace_id),
    )
    obj = row.scalar_one_or_none()
    if obj is None:
        obj = WorkspaceMapApiKeys(
            workspace_id=workspace_id,
            mapbox_api_key=None,
            google_maps_api_key=None,
        )
        db.add(obj)

    if body.mapbox_api_key is not None:
        obj.mapbox_api_key = body.mapbox_api_key or None
    if body.google_maps_api_key is not None:
        obj.google_maps_api_key = body.google_maps_api_key or None

    await db.commit()
    await db.refresh(obj)
    return MapApiKeysResponse(
        mapbox_api_key=obj.mapbox_api_key,
        google_maps_api_key=obj.google_maps_api_key,
    )
