from typing import Optional
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: Optional[str] = None
    CORS_ORIGINS: str = "http://localhost:5173"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    REDIS_URL: str = "redis://localhost:6379/0"
    # Game version served when a request carries no version segment and the
    # registry has no row flagged is_default.
    DEFAULT_GAME_VERSION: str = "ao"
    # Seconds the in-process game version registry is cached before re-reading
    # public.game_versions.
    GAME_VERSION_REGISTRY_TTL: int = 60
    # PostgreSQL schema of the content-addressed store the API reads.
    CAS_SCHEMA: str = "cas"
    # Most memory the response cache may hold, in bytes (app/core/cache.py).
    # 0 turns the cache off. The process takes more than this: its size when
    # ready (130 MB) plus up to 150 MB that building responses leaves with the
    # allocator, 550 MB in all with the default (measured, see cache.py).
    RESPONSE_CACHE_MAX_BYTES: int = 256 * 1024 * 1024

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()
