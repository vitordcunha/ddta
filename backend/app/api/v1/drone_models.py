"""CRUD de modelos de drone (padrão + custom por workspace)."""

from __future__ import annotations

import math
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.models.drone_model import DroneModelRow
from app.db.session import get_db
from app.schemas.drone_models import DroneModelCreate, DroneModelRead, DroneModelUpdate

router = APIRouter(prefix="/drone-models", tags=["drone-models"])


def _workspace_id(
    x_workspace_id: Annotated[str | None, Header(alias="X-Workspace-Id")] = None,
) -> str:
    w = (x_workspace_id or "default").strip()
    return w or "default"


def _fov_from_sensor(sw: float, sh: float, fl: float) -> tuple[float, float]:
    h = math.degrees(2 * math.atan(sw / (2 * fl)))
    v = math.degrees(2 * math.atan(sh / (2 * fl)))
    return h, v


@router.get("", response_model=list[DroneModelRead])
async def list_drone_models(
    db: AsyncSession = Depends(get_db),
    workspace_id: str = Depends(_workspace_id),
) -> list[DroneModelRow]:
    stmt = (
        select(DroneModelRow)
        .where(
            or_(
                DroneModelRow.workspace_id.is_(None),
                DroneModelRow.workspace_id == workspace_id,
            )
        )
        .order_by(DroneModelRow.is_default.desc(), DroneModelRow.is_custom.asc(), DroneModelRow.name)
    )
    res = await db.execute(stmt)
    return list(res.scalars().all())


@router.post("", response_model=DroneModelRead, status_code=201)
async def create_drone_model(
    body: DroneModelCreate,
    db: AsyncSession = Depends(get_db),
    workspace_id: str = Depends(_workspace_id),
) -> DroneModelRow:
    fh, fv = _fov_from_sensor(body.sensor_width_mm, body.sensor_height_mm, body.focal_length_mm)
    row = DroneModelRow(
        name=body.name.strip(),
        manufacturer=body.manufacturer.strip(),
        is_default=False,
        is_custom=True,
        workspace_id=workspace_id,
        sensor_width_mm=body.sensor_width_mm,
        sensor_height_mm=body.sensor_height_mm,
        focal_length_mm=body.focal_length_mm,
        image_width_px=body.image_width_px,
        image_height_px=body.image_height_px,
        fov_horizontal_deg=fh,
        fov_vertical_deg=fv,
        gimbal_pitch_min=body.gimbal_pitch_min,
        gimbal_pitch_max=body.gimbal_pitch_max,
        max_speed_ms=body.max_speed_ms,
        max_altitude_m=body.max_altitude_m,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return row


@router.put("/{model_id}", response_model=DroneModelRead)
async def update_drone_model(
    model_id: UUID,
    body: DroneModelUpdate,
    db: AsyncSession = Depends(get_db),
    workspace_id: str = Depends(_workspace_id),
) -> DroneModelRow:
    res = await db.execute(select(DroneModelRow).where(DroneModelRow.id == model_id))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Modelo não encontrado.")
    if not row.is_custom or row.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Apenas modelos custom deste workspace podem ser editados.")

    data = body.model_dump(exclude_unset=True)
    if "name" in data and data["name"] is not None:
        row.name = str(data["name"]).strip()
    if "manufacturer" in data and data["manufacturer"] is not None:
        row.manufacturer = str(data["manufacturer"]).strip()
    for key in (
        "sensor_width_mm",
        "sensor_height_mm",
        "focal_length_mm",
        "image_width_px",
        "image_height_px",
        "gimbal_pitch_min",
        "gimbal_pitch_max",
        "max_speed_ms",
        "max_altitude_m",
    ):
        if key in data and data[key] is not None:
            setattr(row, key, data[key])

    if any(k in data for k in ("sensor_width_mm", "sensor_height_mm", "focal_length_mm")):
        fh, fv = _fov_from_sensor(row.sensor_width_mm, row.sensor_height_mm, row.focal_length_mm)
        row.fov_horizontal_deg = fh
        row.fov_vertical_deg = fv

    await db.commit()
    await db.refresh(row)
    return row


@router.delete("/{model_id}", status_code=204)
async def delete_drone_model(
    model_id: UUID,
    db: AsyncSession = Depends(get_db),
    workspace_id: str = Depends(_workspace_id),
) -> None:
    res = await db.execute(select(DroneModelRow).where(DroneModelRow.id == model_id))
    row = res.scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Modelo não encontrado.")
    if not row.is_custom or row.workspace_id != workspace_id:
        raise HTTPException(status_code=403, detail="Apenas modelos custom deste workspace podem ser removidos.")
    await db.delete(row)
    await db.commit()
