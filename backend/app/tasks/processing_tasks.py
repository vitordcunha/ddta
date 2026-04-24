from pathlib import Path
from uuid import UUID

from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.core.processing.cog_converter import convert_to_cog
from app.core.processing.contour_generator import generate_contours
from app.core.processing.odm_client import ODMClient, TaskInfo
from app.core.storage.file_manager import get_project_dir, organize_results
from app.db.models.project import Project

sync_engine = create_engine(settings.sync_database_url, future=True)
SyncSessionLocal = sessionmaker(bind=sync_engine, autoflush=False, autocommit=False, class_=Session)


def _update_project_status(
    db: Session,
    project_id: UUID,
    status: str,
    progress: int,
    odm_task_uuid: str | None = None,
    processing_task_uuid: str | None = None,
    assets: dict | None = None,
) -> None:
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return
    project.status = status
    project.progress = progress
    if odm_task_uuid is not None:
        project.odm_task_uuid = odm_task_uuid
    if processing_task_uuid is not None:
        project.processing_task_uuid = processing_task_uuid
    if assets is not None:
        project.assets = assets
    db.commit()


@shared_task(bind=True, acks_late=True)
def process_images_task(self, project_id: str, image_paths: list[str], options: dict) -> dict:
    project_uuid = UUID(project_id)
    with SyncSessionLocal() as db:
        _update_project_status(
            db,
            project_uuid,
            status="processing",
            progress=0,
            processing_task_uuid=self.request.id,
        )

    client = ODMClient(settings.odm_node_host, settings.odm_node_port)
    odm_task_uuid = client.create_task(project_id, [Path(path) for path in image_paths], options)

    with SyncSessionLocal() as db:
        _update_project_status(
            db,
            project_uuid,
            status="processing",
            progress=5,
            odm_task_uuid=odm_task_uuid,
        )

    try:
        def on_progress(info: TaskInfo) -> None:
            progress = max(5, min(95, int(info.progress)))
            with SyncSessionLocal() as db_inner:
                _update_project_status(
                    db_inner,
                    project_uuid,
                    status="processing",
                    progress=progress,
                    odm_task_uuid=info.uuid,
                )

        client.wait_for_completion(odm_task_uuid, on_progress=on_progress, poll_interval_s=5)
        info = client.get_task_info(odm_task_uuid)
        if info.status != "completed":
            raise RuntimeError(f"ODM task finished with status '{info.status}'")

        project_dir = get_project_dir(project_uuid)
        odm_results_dir = project_dir / "odm-results"
        client.download_assets(odm_task_uuid, odm_results_dir)

        ortho_tif = odm_results_dir / "odm_orthophoto" / "odm_orthophoto.tif"
        dtm_tif = odm_results_dir / "odm_dem" / "dsm.tif"
        if ortho_tif.exists():
            convert_to_cog(ortho_tif)

        contour_output = project_dir / "results" / "contours.geojson"
        contour_path = generate_contours(dtm_tif, contour_output, interval_m=1.0) if dtm_tif.exists() else None

        assets = organize_results(project_uuid, odm_results_dir)
        if contour_path:
            assets["contours"] = contour_path

        with SyncSessionLocal() as db:
            _update_project_status(
                db,
                project_uuid,
                status="completed",
                progress=100,
                assets=assets,
            )

        return {"status": "completed", "project_id": project_id, "task_uuid": self.request.id}
    except Exception as exc:
        with SyncSessionLocal() as db:
            _update_project_status(
                db,
                project_uuid,
                status="failed",
                progress=0,
            )
        raise exc
