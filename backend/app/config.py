from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DroneMapper API"
    database_url: str
    sync_database_url: str
    redis_url: str
    odm_node_host: str = "localhost"
    odm_node_port: int = 3000
    storage_path: Path = Path("/data")
    use_s3: bool = False
    s3_endpoint_url: str | None = None
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    s3_region_name: str = "us-east-1"
    s3_bucket: str = "dronedata"
    max_upload_file_size_mb: int = 1024
    calibration_min_images: int = 5
    calibration_max_images: int = 30
    calibration_max_jpeg_mb: int = 40
    calibration_pixel_thumb_max_px: int = 1280
    calibration_pixel_jpeg_quality: int = 82
    rate_limit_upload: str = "120/minute"
    rate_limit_processing: str = "20/minute"
    # Use "*" to allow any Origin (reflected in responses; works with credentials).
    cors_origins: str = "*"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
