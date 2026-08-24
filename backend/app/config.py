from __future__ import annotations

from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_name: str = "Appointment Care"
    mongodb_uri: str = "mongodb://localhost:27017"
    mongodb_database_name: str = "appointment_care"
    jwt_secret_key: str = Field(default="development-secret-key-at-least-32-chars", min_length=32)
    jwt_algorithm: str = "HS256"
    access_token_exp_minutes: int = 15
    refresh_token_exp_days: int = 30
    google_client_id: str = ""
    google_client_secret: str = ""
    google_redirect_uri: str = "http://127.0.0.1:8000/calendar/google/callback"
    google_auth_redirect_uri: str = "http://127.0.0.1:8000/auth/google/callback"
    frontend_url: str = "http://localhost:3000"
    google_token_encryption_secret: str = Field(default="development-encryption-secret-key-32+bytes", min_length=32)
    sendgrid_api_key: str = ""
    sendgrid_from_email: str = "noreply@appointmentcare.local"
    sendgrid_from_name: str = "Appointment Care"
    celery_broker_url: str = "redis://localhost:6379/0"
    celery_result_backend: str = "redis://localhost:6379/0"
    gemini_api_key: str = ""


@lru_cache
def get_settings() -> Settings:
    return Settings()
