import shutil
import uuid
from datetime import datetime, timezone
from pathlib import Path
from uuid import UUID

from botocore.client import Config as BotoConfig
import boto3

from app.config import settings


def get_project_dir(project_id: UUID) -> Path:
    project_dir = settings.storage_path / "projects" / str(project_id)
    project_dir.mkdir(parents=True, exist_ok=True)
    return project_dir


def get_calibration_session_dir(session_id: UUID) -> Path:
    path = settings.storage_path / "calibration-sessions" / str(session_id)
    path.mkdir(parents=True, exist_ok=True)
    return path


def delete_calibration_session_storage(session_id: UUID) -> None:
    """Remove pasta local da sessão (imagens, miniaturas). Ignora se não existir."""
    path = settings.storage_path / "calibration-sessions" / str(session_id)
    if path.is_dir():
        shutil.rmtree(path, ignore_errors=True)


def get_chunk_path(project_id: UUID, file_id: str, chunk_index: int) -> Path:
    chunk_dir = get_project_dir(project_id) / "temp" / file_id
    chunk_dir.mkdir(parents=True, exist_ok=True)
    return chunk_dir / f"{chunk_index:08d}.part"


def assemble_chunks(temp_dir: Path, output_path: Path, total_chunks: int) -> Path:
    output_path.parent.mkdir(parents=True, exist_ok=True)
    with output_path.open("wb") as output_file:
        for chunk_index in range(total_chunks):
            chunk_path = temp_dir / f"{chunk_index:08d}.part"
            if not chunk_path.exists():
                raise FileNotFoundError(f"Missing chunk {chunk_index}")
            with chunk_path.open("rb") as chunk_file:
                output_file.write(chunk_file.read())
    return output_path


def cleanup_temp(project_id: UUID, file_id: str) -> None:
    temp_dir = get_project_dir(project_id) / "temp" / file_id
    if not temp_dir.exists():
        return
    shutil.rmtree(temp_dir, ignore_errors=True)


def _project_storage_root(project_id: UUID) -> Path:
    """Project data root under storage (no mkdir)."""
    return settings.storage_path / "projects" / str(project_id)


def clear_project_temp(project_id: UUID) -> None:
    temp_root = _project_storage_root(project_id) / "temp"
    if temp_root.is_dir():
        shutil.rmtree(temp_root, ignore_errors=True)


def clear_project_image_files(project_id: UUID) -> None:
    images_dir = _project_storage_root(project_id) / "images"
    if images_dir.is_dir():
        for path in images_dir.iterdir():
            if path.is_file():
                path.unlink(missing_ok=True)


def clear_project_preview_results_disk(project_id: UUID) -> None:
    preview_dir = _project_storage_root(project_id) / "preview-results"
    if preview_dir.is_dir():
        shutil.rmtree(preview_dir, ignore_errors=True)


def clear_project_sparse_cloud_disk(project_id: UUID) -> None:
    root = _project_storage_root(project_id)
    sparse_cloud = root / "sparse_cloud.geojson"
    sparse_cloud.unlink(missing_ok=True)


def clear_project_results_disk(project_id: UUID) -> None:
    d = _project_storage_root(project_id) / "results"
    if d.is_dir():
        shutil.rmtree(d, ignore_errors=True)


def clear_project_processing_runs_disk(project_id: UUID) -> None:
    d = _project_storage_root(project_id) / "processing-runs"
    if d.is_dir():
        shutil.rmtree(d, ignore_errors=True)


def clear_project_preview_runs_disk(project_id: UUID) -> None:
    d = _project_storage_root(project_id) / "preview-runs"
    if d.is_dir():
        shutil.rmtree(d, ignore_errors=True)


def wipe_project_upload_scratch(project_id: UUID) -> None:
    """Remove chunk temp dirs, image files, preview-results, and sparse cloud file (does not touch DB)."""
    clear_project_temp(project_id)
    clear_project_image_files(project_id)
    clear_project_preview_results_disk(project_id)
    clear_project_sparse_cloud_disk(project_id)


def organize_results(project_id: UUID, odm_results_dir: Path, subdir: str = "results") -> dict[str, str]:
    destination = get_project_dir(project_id) / subdir
    destination.mkdir(parents=True, exist_ok=True)
    assets: dict[str, str] = {}
    if not odm_results_dir.exists():
        return assets
    for path in odm_results_dir.rglob("*"):
        if not path.is_file():
            continue
        relative = path.relative_to(odm_results_dir)
        target = destination / relative
        target.parent.mkdir(parents=True, exist_ok=True)
        if path.resolve() == target.resolve():
            assets[relative.as_posix()] = str(target)
            continue
        shutil.copy2(path, target)
        assets[relative.as_posix()] = str(target)
    return assets


def _remap_assets_under_dir(assets: dict[str, str], src_root: Path, dst_root: Path) -> dict[str, str]:
    src_resolved = src_root.resolve()
    dst_resolved = dst_root.resolve()
    out: dict[str, str] = {}
    for key, val in assets.items():
        if not val:
            continue
        p = Path(val).expanduser().resolve()
        try:
            rel = p.relative_to(src_resolved)
        except ValueError:
            out[key] = val
            continue
        out[key] = str((dst_resolved / rel).resolve())
    return out


def archive_project_processing_run(
    project_id: UUID,
    preset_label: str,
    stats: dict | None,
    assets: dict[str, str] | None,
) -> dict | None:
    """Copia ``results/`` para ``processing-runs/<id>/results/`` e devolve entrada de histórico."""
    if not assets:
        return None
    project_dir = get_project_dir(project_id)
    src = project_dir / "results"
    if not src.is_dir():
        return None
    run_id = str(uuid.uuid4())
    dst = project_dir / "processing-runs" / run_id / "results"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)
    new_assets = _remap_assets_under_dir(assets, src, dst)
    return {
        "run_id": run_id,
        "preset": preset_label,
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "stats": dict(stats) if stats else None,
        "assets": new_assets,
    }


def archive_project_preview_run(
    project_id: UUID,
    preview_assets: dict[str, str] | None,
) -> dict | None:
    """Copia ``preview-results/`` para ``preview-runs/<id>/preview-results/``."""
    if not preview_assets:
        return None
    project_dir = get_project_dir(project_id)
    src = project_dir / "preview-results"
    if not src.is_dir():
        return None
    run_id = str(uuid.uuid4())
    dst = project_dir / "preview-runs" / run_id / "preview-results"
    dst.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(src, dst)
    new_assets = _remap_assets_under_dir(preview_assets, src, dst)
    return {
        "run_id": run_id,
        "kind": "fast_preview",
        "completed_at": datetime.now(timezone.utc).isoformat(),
        "preview_assets": new_assets,
    }


def upload_to_storage(local_path: Path, bucket: str, key: str) -> str:
    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region_name,
        config=BotoConfig(signature_version="s3v4"),
    )
    s3_client.upload_file(str(local_path), bucket, key)
    return f"s3://{bucket}/{key}"


def load_bytes_from_storage_key(storage_key: str | None) -> bytes | None:
    """Load file contents from a local path or ``s3://bucket/key`` URI."""
    if not storage_key:
        return None
    if storage_key.startswith("s3://"):
        rest = storage_key[5:]
        bucket, _, object_key = rest.partition("/")
        if not bucket or not object_key:
            return None
        s3_client = boto3.client(
            "s3",
            endpoint_url=settings.s3_endpoint_url or None,
            aws_access_key_id=settings.s3_access_key_id,
            aws_secret_access_key=settings.s3_secret_access_key,
            region_name=settings.s3_region_name,
            config=BotoConfig(signature_version="s3v4"),
        )
        obj = s3_client.get_object(Bucket=bucket, Key=object_key)
        return obj["Body"].read()
    p = Path(storage_key)
    if p.is_file():
        return p.read_bytes()
    return None


def get_presigned_url(bucket: str, key: str, expires_in: int = 3600) -> str:
    s3_client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url or None,
        aws_access_key_id=settings.s3_access_key_id,
        aws_secret_access_key=settings.s3_secret_access_key,
        region_name=settings.s3_region_name,
        config=BotoConfig(signature_version="s3v4"),
    )
    return s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket, "Key": key},
        ExpiresIn=expires_in,
    )
