from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # ClickHouse
    clickhouse_host: str = "216.48.180.4"
    clickhouse_port: int = 8123
    clickhouse_user: str = "ethics"
    clickhouse_password: str = "Ethics@2026$"
    clickhouse_database: str = "attendance_phase_1"
    cors_origins: str = "http://localhost:5173,http://localhost:3000,http://localhost:8080,http://216.48.180.4:5173,http://216.48.180.4,http://216.48.180.4:8080"

    # JWT Auth
    secret_key: str = "attendance-phase-1-super-secret-key-change-in-prod"
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 480

    # MinIO
    # We must use the public IP so your browser at home can load images from the server!
    minio_endpoint: str = "http://216.48.180.4:9010"

    def resolve_image_url(self, image_path: str):
        if not image_path:
            return None
        # If it's a MinIO path — route through backend proxy to avoid
        # Chrome's Private Network Access (PNA) CORS block on different ports
        if image_path.startswith("/totalfacedatabase") or image_path.startswith("totalfacedatabase"):
            # Strip leading slash if present
            clean_path = image_path.lstrip("/")
            # URL-encode to handle spaces (e.g. "73 East" → "73%20East")
            import urllib.parse
            encoded_path = urllib.parse.quote(clean_path, safe="/")
            # Return proxy URL — served from same origin as the API (port 8000)
            return f"/api/images/proxy/{encoded_path}"
        # Fallback to local static file serving
        return f"/api/images/detections/{image_path}"

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",")]

    class Config:
        env_file = ".env"


@lru_cache()
def get_settings() -> Settings:
    return Settings()
