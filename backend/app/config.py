from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "DroneMapper API"
    database_url: str
    sync_database_url: str
    redis_url: str
    secret_key: str
    access_token_expire_minutes: int = 60
    jwt_algorithm: str = "HS256"
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
    rate_limit_upload: str = "120/minute"
    rate_limit_processing: str = "20/minute"
    cors_origins: str = "http://localhost:5173,http://localhost:3000"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    @property
    def cors_origins_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]


settings = Settings()
