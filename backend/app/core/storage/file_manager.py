import shutil
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
    for path in temp_dir.glob("*.part"):
        path.unlink(missing_ok=True)
    temp_dir.rmdir()


def wipe_project_upload_scratch(project_id: UUID) -> None:
    """Remove chunk temp dirs and image files on disk for a project (does not touch DB)."""
    project_root = settings.storage_path / "projects" / str(project_id)
    temp_root = project_root / "temp"
    if temp_root.is_dir():
        shutil.rmtree(temp_root, ignore_errors=True)
    images_dir = project_root / "images"
    if images_dir.is_dir():
        for path in images_dir.iterdir():
            if path.is_file():
                path.unlink(missing_ok=True)


def organize_results(project_id: UUID, odm_results_dir: Path) -> dict[str, str]:
    destination = get_project_dir(project_id) / "results"
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
        target.write_bytes(path.read_bytes())
        assets[relative.as_posix()] = str(target)
    return assets


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
