from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from uuid import UUID

from celery import shared_task
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker

from app.config import settings
from app.core.processing.cog_converter import convert_to_cog
from app.core.processing.contour_generator import generate_contours
from app.core.processing.odm_client import ODMClient, TaskInfo
from app.core.processing.presets import FAST_PREVIEW_OPTIONS
from app.core.processing.sparse_cloud_converter import reconstruction_to_geojson
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


def _update_project_preview_status(
    db: Session,
    project_id: UUID,
    status: str,
    progress: int,
    preview_task_uuid: str | None = None,
    preview_odm_task_uuid: str | None = None,
    preview_assets: dict | None = None,
) -> None:
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return
    project.preview_status = status
    project.preview_progress = progress
    if preview_task_uuid is not None:
        project.preview_task_uuid = preview_task_uuid
    if preview_odm_task_uuid is not None:
        project.preview_odm_task_uuid = preview_odm_task_uuid
    if preview_assets is not None:
        project.preview_assets = preview_assets
    db.commit()


def _ensure_sparse_cloud_geojson(project_id: UUID, odm_results_dir: Path) -> None:
    """
    If OpenSfM reconstruction exists on disk, build sparse_cloud.geojson and persist sparse_cloud_path.
    Call after download_assets (and from finalize when odm-results already exist).
    """
    recon = odm_results_dir / "opensfm" / "reconstruction.json"
    if not recon.exists():
        return

    project_dir = get_project_dir(project_id)
    geojson_out = project_dir / "sparse_cloud.geojson"

    try:
        if geojson_out.exists():
            try:
                if geojson_out.stat().st_mtime >= recon.stat().st_mtime:
                    with SyncSessionLocal() as db:
                        row = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
                        if row is not None and row.sparse_cloud_path is None:
                            row.sparse_cloud_path = str(geojson_out)
                            db.commit()
                    return
            except OSError:
                pass
        reconstruction_to_geojson(recon, geojson_out)
    except Exception:
        return

    with SyncSessionLocal() as db:
        row = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
        if row is None:
            return
        row.sparse_cloud_path = str(geojson_out)
        db.commit()


def main_orthophoto_path(project_uuid: UUID) -> Path:
    return get_project_dir(project_uuid) / "odm-results" / "odm_orthophoto" / "odm_orthophoto.tif"


def preview_orthophoto_path(project_uuid: UUID) -> Path:
    return get_project_dir(project_uuid) / "preview-results" / "odm_orthophoto" / "odm_orthophoto.tif"


def run_main_post_download_steps(project_uuid: UUID, fast: bool = False) -> dict[str, str]:
    """COG, contornos, cópia para results/ — executado após download ODM ou na task finalize."""
    project_dir = get_project_dir(project_uuid)
    odm_results_dir = project_dir / "odm-results"
    ortho_tif = odm_results_dir / "odm_orthophoto" / "odm_orthophoto.tif"
    dtm_tif = odm_results_dir / "odm_dem" / "dtm.tif"
    dsm_tif = odm_results_dir / "odm_dem" / "dsm.tif"
    elevation_tif = dtm_tif if dtm_tif.exists() else dsm_tif
    contour_output = project_dir / "results" / "contours.geojson"
    compression = "lzw" if fast else "deflate"

    contour_path: str | None = None

    def _run_cog() -> None:
        if ortho_tif.exists():
            convert_to_cog(ortho_tif, compression=compression)

    def _run_contours() -> None:
        nonlocal contour_path
        if elevation_tif.exists():
            contour_path = generate_contours(elevation_tif, contour_output, interval_m=1.0)

    with ThreadPoolExecutor(max_workers=2) as pool:
        cog_future = pool.submit(_run_cog)
        contour_future = pool.submit(_run_contours)
        cog_future.result()
        contour_future.result()

    assets = organize_results(project_uuid, odm_results_dir)
    if contour_path:
        assets["contours"] = contour_path
    return assets


def run_preview_post_download_steps(project_uuid: UUID) -> dict[str, str]:
    preview_dir = get_project_dir(project_uuid) / "preview-results"
    ortho = preview_dir / "odm_orthophoto" / "odm_orthophoto.tif"
    if ortho.exists():
        convert_to_cog(ortho)
    return organize_results(project_uuid, preview_dir, subdir="preview-results")


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

    project_dir = get_project_dir(project_uuid)
    odm_results_dir = project_dir / "odm-results"
    sparse_cloud_detected = False

    try:
        def on_progress(info: TaskInfo) -> None:
            nonlocal sparse_cloud_detected
            progress = max(5, min(95, int(info.progress)))
            with SyncSessionLocal() as db_inner:
                _update_project_status(
                    db_inner,
                    project_uuid,
                    status="processing",
                    progress=progress,
                    odm_task_uuid=info.uuid,
                )

            # If results are already mirrored locally (e.g. shared storage), pick up SfM early.
            if not sparse_cloud_detected and progress >= 15:
                sparse_recon = odm_results_dir / "opensfm" / "reconstruction.json"
                if sparse_recon.exists():
                    sparse_cloud_detected = True
                    try:
                        _ensure_sparse_cloud_geojson(project_uuid, odm_results_dir)
                    except Exception:
                        pass  # Must not block main processing

        client.wait_for_completion(odm_task_uuid, on_progress=on_progress, poll_interval_s=5)
        info = client.get_task_info(odm_task_uuid)
        if info.status != "completed":
            raise RuntimeError(f"ODM task finished with status '{info.status}'")

        # Fetch reconstruction.json early (before the full asset download) so that
        # sparse_cloud_path is set in the DB while the heavier assets are still downloading.
        # This is the only reliable path for remote ODM nodes that don't share a filesystem.
        if not sparse_cloud_detected:
            try:
                if client.fetch_reconstruction_json(odm_task_uuid, odm_results_dir):
                    _ensure_sparse_cloud_geojson(project_uuid, odm_results_dir)
            except Exception:  # noqa: BLE001
                pass  # full download fallback below will cover it

        client.download_assets(odm_task_uuid, odm_results_dir)
        _ensure_sparse_cloud_geojson(project_uuid, odm_results_dir)

        assets = run_main_post_download_steps(project_uuid, fast=bool(options.get("fast-orthophoto")))

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


@shared_task(bind=True, acks_late=True)
def process_preview_task(self, project_id: str, image_paths: list[str]) -> dict:
    """
    Celery task for fast preview processing.
    Runs in parallel with process_images_task.
    Saves results in preview_assets on completion.
    """
    project_uuid = UUID(project_id)

    with SyncSessionLocal() as db:
        _update_project_preview_status(
            db,
            project_uuid,
            status="processing",
            progress=0,
            preview_task_uuid=self.request.id,
        )

    client = ODMClient(settings.odm_node_host, settings.odm_node_port)
    preview_odm_uuid = client.create_task(
        f"{project_id}-preview",
        [Path(p) for p in image_paths],
        FAST_PREVIEW_OPTIONS,
    )

    with SyncSessionLocal() as db:
        _update_project_preview_status(
            db,
            project_uuid,
            status="processing",
            progress=5,
            preview_odm_task_uuid=preview_odm_uuid,
        )

    try:
        def on_preview_progress(info: TaskInfo) -> None:
            progress = max(5, min(95, int(info.progress)))
            with SyncSessionLocal() as db_inner:
                _update_project_preview_status(
                    db_inner,
                    project_uuid,
                    status="processing",
                    progress=progress,
                )

        client.wait_for_completion(
            preview_odm_uuid,
            on_progress=on_preview_progress,
            poll_interval_s=5,
        )

        info = client.get_task_info(preview_odm_uuid)
        if info.status != "completed":
            raise RuntimeError(f"Preview ODM task failed with status '{info.status}'")

        preview_dir = get_project_dir(project_uuid) / "preview-results"
        client.download_assets(preview_odm_uuid, preview_dir)

        preview_assets = run_preview_post_download_steps(project_uuid)

        with SyncSessionLocal() as db:
            _update_project_preview_status(
                db,
                project_uuid,
                status="completed",
                progress=100,
                preview_assets=preview_assets,
            )

        return {"status": "completed", "type": "preview"}

    except Exception as exc:
        with SyncSessionLocal() as db:
            _update_project_preview_status(
                db,
                project_uuid,
                status="failed",
                progress=0,
            )
        raise exc


@shared_task(bind=True, acks_late=True)
def finalize_main_processing_task(self, project_id: str) -> dict:
    """
    Retoma após ODM + download: COG, contornos, organize_results, completed.
    Usado quando o worker morreu (ex. SIGSEGV) antes de gravar o estado final.
    """
    project_uuid = UUID(project_id)
    if not main_orthophoto_path(project_uuid).exists():
        raise RuntimeError("Orthophoto not found under odm-results; cannot finalize")

    project_dir = get_project_dir(project_uuid)
    _ensure_sparse_cloud_geojson(project_uuid, project_dir / "odm-results")

    with SyncSessionLocal() as db:
        _update_project_status(
            db,
            project_uuid,
            status="processing",
            progress=96,
            processing_task_uuid=self.request.id,
        )

    try:
        assets = run_main_post_download_steps(project_uuid)
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


@shared_task(bind=True, acks_late=True)
def finalize_preview_processing_task(self, project_id: str) -> dict:
    project_uuid = UUID(project_id)
    if not preview_orthophoto_path(project_uuid).exists():
        raise RuntimeError("Preview orthophoto not found; cannot finalize")

    with SyncSessionLocal() as db:
        _update_project_preview_status(
            db,
            project_uuid,
            status="processing",
            progress=96,
            preview_task_uuid=self.request.id,
        )

    try:
        preview_assets = run_preview_post_download_steps(project_uuid)
        with SyncSessionLocal() as db:
            _update_project_preview_status(
                db,
                project_uuid,
                status="completed",
                progress=100,
                preview_assets=preview_assets,
            )
        return {"status": "completed", "type": "preview", "project_id": project_id, "task_uuid": self.request.id}
    except Exception as exc:
        with SyncSessionLocal() as db:
            _update_project_preview_status(
                db,
                project_uuid,
                status="failed",
                progress=0,
            )
        raise exc
