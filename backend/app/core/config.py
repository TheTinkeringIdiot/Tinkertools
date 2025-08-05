from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    DATABASE_URL: str
    CORS_ORIGINS: str = "http://localhost:5173"
    APP_ENV: str = "development"
    LOG_LEVEL: str = "INFO"
    REDIS_URL: str = "redis://localhost:6379/0"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")


settings = Settings()