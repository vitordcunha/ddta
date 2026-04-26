"""Aggregate Celery worker state, NodeODM tasks, and DB pipeline rows for the ops monitor."""

from __future__ import annotations

import json
import logging
from datetime import datetime, timezone
from typing import Any
from urllib.error import URLError
from urllib.request import Request, urlopen
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.processing.odm_client import ODMClient, TaskInfo
from app.db.models.project import Project
from app.schemas.processing_queue import (
    CeleryTaskItem,
    OdmTaskItem,
    ProcessingMonitorResponse,
    ProjectPipelineItem,
)
from app.tasks.celery_app import celery_app

logger = logging.getLogger(__name__)

MAX_ODM_TASK_DETAILS = 48


def _fetch_nodeodm_task_uuids(host: str, port: int, timeout: float = 6.0) -> tuple[list[str], str | None]:
    url = f"http://{host}:{port}/task/list"
    try:
        req = Request(url, headers={"Accept": "application/json"})
        with urlopen(req, timeout=timeout) as resp:
            raw = json.loads(resp.read().decode())
    except URLError as exc:
        return [], f"NodeODM unreachable: {exc!s}"
    except TimeoutError:
        return [], "NodeODM list timed out"
    except Exception as exc:  # noqa: BLE001
        return [], f"NodeODM list failed: {exc}"

    if not isinstance(raw, list):
        return [], "NodeODM /task/list returned unexpected JSON"

    out: list[str] = []
    for item in raw:
        if isinstance(item, str):
            out.append(item)
        elif isinstance(item, dict) and item.get("uuid"):
            out.append(str(item["uuid"]))
    return out, None


def _normalize_celery_entry(worker: str, bucket: str, item: Any) -> CeleryTaskItem | None:
    """Turn inspect() payload into CeleryTaskItem."""
    if item is None:
        return None
    body: dict[str, Any]
    if isinstance(item, dict) and "request" in item and isinstance(item["request"], dict):
        body = item["request"]
    elif isinstance(item, dict):
        body = item
    else:
        return CeleryTaskItem(
            worker=worker,
            bucket=bucket,
            task_id=None,
            task_name=None,
            args_preview=str(item)[:400],
        )

    tid = body.get("id")
    name = body.get("name")
    args = body.get("args")
    kwargs = body.get("kwargs")
    preview_parts: list[str] = []
    if args is not None:
        preview_parts.append(f"args={str(args)[:320]}")
    if kwargs is not None:
        preview_parts.append(f"kwargs={str(kwargs)[:160]}")
    return CeleryTaskItem(
        worker=worker,
        bucket=bucket,
        task_id=str(tid) if tid else None,
        task_name=str(name) if name else None,
        args_preview=" | ".join(preview_parts) if preview_parts else None,
    )


def _gather_celery_tasks() -> tuple[bool, str | None, list[CeleryTaskItem]]:
    try:
        insp = celery_app.control.inspect(timeout=2.0)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Celery inspect failed: %s", exc)
        return False, str(exc), []

    if insp is None:
        return False, "No Celery workers responded to inspect (workers offline?)", []

    seen: set[str] = set()
    ordered: list[CeleryTaskItem] = []

    def ingest(bucket: str, payload: dict[str, list[Any]] | None) -> None:
        if not payload:
            return
        for worker, items in payload.items():
            for raw in items or []:
                row = _normalize_celery_entry(worker, bucket, raw)
                if row is None:
                    continue
                key = row.task_id or f"{worker}:{bucket}:{row.task_name}:{row.args_preview}"
                if key in seen:
                    continue
                seen.add(key)
                ordered.append(row)

    ingest("active", insp.active())
    ingest("reserved", insp.reserved())

    scheduled = insp.scheduled() or {}
    for worker, entries in scheduled.items():
        for entry in entries or []:
            if isinstance(entry, (list, tuple)) and len(entry) >= 2:
                req = entry[1]
                row = _normalize_celery_entry(worker, "scheduled", req)
            elif isinstance(entry, dict):
                row = _normalize_celery_entry(worker, "scheduled", entry)
            else:
                row = CeleryTaskItem(
                    worker=worker,
                    bucket="scheduled",
                    args_preview=str(entry)[:400],
                )
            if row is None:
                continue
            key = row.task_id or f"{worker}:scheduled:{row.task_name}:{row.args_preview}"
            if key in seen:
                continue
            seen.add(key)
            ordered.append(row)

    return True, None, ordered


def _odm_task_details(uuids: list[str]) -> list[TaskInfo]:
    if not uuids:
        return []
    client: ODMClient | None = None
    try:
        client = ODMClient(settings.odm_node_host, settings.odm_node_port)
    except Exception as exc:  # noqa: BLE001
        logger.warning("ODMClient init failed: %s", exc)
        return [TaskInfo(uuid=u, status="unavailable", progress=0.0) for u in uuids]

    out: list[TaskInfo] = []
    for u in uuids[:MAX_ODM_TASK_DETAILS]:
        try:
            out.append(client.get_task_info(u))
        except Exception:  # noqa: BLE001
            out.append(TaskInfo(uuid=u, status="unknown", progress=0.0))
    return out


def _link_maps(
    projects: list[ProjectPipelineItem],
) -> dict[str, tuple[str, str]]:
    """ODM task uuid -> (project_id, main|preview)."""
    m: dict[str, tuple[str, str]] = {}
    for p in projects:
        if p.odm_main_task_id:
            m[p.odm_main_task_id] = (p.id, "main")
        if p.odm_preview_task_id:
            m[p.odm_preview_task_id] = (p.id, "preview")
    return m


async def load_pipeline_projects(db: AsyncSession) -> list[ProjectPipelineItem]:
    stmt = (
        select(Project)
        .where(
            or_(
                Project.status.in_(["queued", "processing"]),
                Project.preview_status.in_(["queued", "processing"]),
            )
        )
        .order_by(Project.updated_at.desc())
        .limit(80)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    out: list[ProjectPipelineItem] = []
    for pr in rows:
        out.append(
            ProjectPipelineItem(
                id=str(pr.id),
                name=pr.name,
                status=pr.status,
                progress=int(pr.progress or 0),
                preview_status=pr.preview_status,
                preview_progress=int(pr.preview_progress or 0),
                celery_main_task_id=pr.processing_task_uuid,
                celery_preview_task_id=pr.preview_task_uuid,
                odm_main_task_id=pr.odm_task_uuid,
                odm_preview_task_id=pr.preview_odm_task_uuid,
            )
        )
    return out


async def build_processing_monitor(db: AsyncSession) -> ProcessingMonitorResponse:
    generated_at = datetime.now(timezone.utc)

    celery_ok, celery_err, celery_tasks = _gather_celery_tasks()

    uuids, odm_list_err = _fetch_nodeodm_task_uuids(settings.odm_node_host, settings.odm_node_port)
    odm_reachable = odm_list_err is None

    pipeline_projects = await load_pipeline_projects(db)
    link = _link_maps(pipeline_projects)

    odm_items: list[OdmTaskItem] = []
    if uuids:
        for info in _odm_task_details(uuids):
            pid_branch = link.get(info.uuid)
            odm_items.append(
                OdmTaskItem(
                    uuid=info.uuid,
                    status=info.status,
                    progress=info.progress,
                    linked_project_id=pid_branch[0] if pid_branch else None,
                    pipeline=pid_branch[1] if pid_branch else None,
                )
            )
    return ProcessingMonitorResponse(
        generated_at=generated_at,
        celery_workers_reached=celery_ok,
        celery_error=celery_err,
        celery_tasks=celery_tasks,
        odm_node_reachable=odm_reachable,
        odm_error=odm_list_err,
        odm_host=settings.odm_node_host,
        odm_port=settings.odm_node_port,
        odm_tasks=odm_items,
        pipeline_projects=pipeline_projects,
    )
