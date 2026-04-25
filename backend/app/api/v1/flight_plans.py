from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.db.models.calibration_session import CalibrationSession
from app.db.models.project import Project
from app.dependencies import get_db
from app.core.storage.file_manager import delete_calibration_session_storage
from app.schemas.calibration import (
    CalibrationSessionCreate,
    CalibrationSessionListItem,
    CalibrationSessionStartResponse,
)
from app.services.calibration.calibration_grid import compute_theoretical_grid

router = APIRouter(prefix="/flight-plans", tags=["flight-plans"])


def _upload_url_for_session(request: Request, session_id: UUID) -> str:
    base = str(request.base_url).rstrip("/")
    return f"{base}/api/v1/calibration-sessions/{session_id}/images"


@router.post(
    "/{flight_plan_id}/calibration-session",
    response_model=CalibrationSessionStartResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_calibration_session(
    flight_plan_id: UUID,
    body: CalibrationSessionCreate,
    request: Request,
    db: AsyncSession = Depends(get_db),
) -> CalibrationSessionStartResponse:
    """
    Cria uma sessão de calibração vazia para correlacionar KMZ reduzido com upload (Fase 3).

    Neste produto, `flight_plan_id` corresponde ao **id do projeto** (plano persistido em `projects.planner_data`).
    """
    result = await db.execute(select(Project).where(Project.id == flight_plan_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight plan / project not found")

    grid = compute_theoretical_grid(body.polygon_snapshot, dict(body.params_snapshot or {}))
    session = CalibrationSession(
        project_id=flight_plan_id,
        params_snapshot=body.params_snapshot,
        polygon_snapshot=body.polygon_snapshot,
        status="pending",
        theoretical_grid=grid,
    )
    db.add(session)
    await db.commit()
    await db.refresh(session)

    return CalibrationSessionStartResponse(
        session_id=session.id,
        upload_url=_upload_url_for_session(request, session.id),
        theoretical_grid=grid,
    )


@router.get("/{flight_plan_id}/calibration-sessions", response_model=list[CalibrationSessionListItem])
async def list_calibration_sessions(
    flight_plan_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> list[CalibrationSessionListItem]:
    """Histórico de voos de calibração vinculados ao projeto."""
    result = await db.execute(select(Project).where(Project.id == flight_plan_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight plan / project not found")

    q = await db.execute(
        select(CalibrationSession)
        .where(CalibrationSession.project_id == flight_plan_id)
        .order_by(CalibrationSession.created_at.desc())
    )
    rows = q.scalars().all()
    return [CalibrationSessionListItem.model_validate(s) for s in rows]


@router.delete(
    "/{flight_plan_id}/calibration-sessions/{session_id}",
    status_code=status.HTTP_204_NO_CONTENT,
)
async def delete_calibration_session(
    flight_plan_id: UUID,
    session_id: UUID,
    db: AsyncSession = Depends(get_db),
) -> None:
    """Remove sessão de calibração do projeto (BD + pasta local de ficheiros)."""
    result = await db.execute(select(Project).where(Project.id == flight_plan_id))
    project = result.scalar_one_or_none()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Flight plan / project not found")

    row = await db.get(CalibrationSession, session_id)
    if not row or row.project_id != flight_plan_id:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Calibration session not found")

    await db.delete(row)
    await db.commit()
    delete_calibration_session_storage(session_id)
