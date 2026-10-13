"""Configuration module for ZenFit AI Engine.
Staff Engineer Grade: Pydantic v2 settings, fail-closed validation, and env inheritance.
"""

from typing import List, Optional
import os
import sys
from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration for ZenFit AI Engine."""

    # Server Info
    PROJECT_NAME: str = "ZenFit AI Engine"
    VERSION: str = "1.0.0"
    API_V1_STR: str = "/v1"
    PORT: int = Field(default=8000, alias="PORT")
    ENVIRONMENT: str = Field(default="development", alias="ENVIRONMENT")
    NODE_ENV: str = Field(default="development", alias="NODE_ENV")
    LOG_LEVEL: str = Field(default="INFO", alias="LOG_LEVEL")
    CORS_ORIGINS: List[str] = ["*"]

    # AI Model Providers
    MISTRAL_API_KEY: Optional[str] = Field(default=None, alias="MISTRAL_API_KEY")
    MISTRAL_MODEL: str = Field(default="mistral-small-latest", alias="MISTRAL_MODEL")
    GEMINI_API_KEY: Optional[str] = Field(default=None, alias="GEMINI_API_KEY")
    GEMINI_MODEL: str = Field(default="gemini-2.5-flash", alias="GEMINI_MODEL")
    NANOBANANA_API_KEY: Optional[str] = Field(default=None, alias="NANOBANANA_API_KEY")
    POLLINATIONS_API_KEY: Optional[str] = Field(default=None, alias="POLLINATIONS_API_KEY")
    POLLINATIONS_IMAGE_MODEL: str = Field(default="turbo", alias="POLLINATIONS_IMAGE_MODEL")

    # Infrastructure & Databases
    REDIS_URL: str = Field(default="redis://localhost:6379", alias="REDIS_URL")
    REDIS_PASSWORD: Optional[str] = Field(default=None, alias="REDIS_PASSWORD")
    RABBITMQ_URL: str = Field(default="amqp://guest:guest@localhost:5672/", alias="RABBITMQ_URL")
    MONGODB_URI: str = Field(default="mongodb://localhost:27017/zenfit", alias="MONGODB_URI")
    MONGODB_DB_NAME: str = Field(default="zenfit", alias="MONGODB_DB_NAME")

    # ChromaDB Vector Store
    CHROMA_HOST: str = Field(default="localhost", alias="CHROMA_HOST")
    CHROMA_PORT: int = Field(default=8000, alias="CHROMA_PORT")
    CHROMA_AUTH_TOKEN: Optional[str] = Field(default=None, alias="CHROMA_SERVER_AUTH_CREDENTIALS")
    CHROMA_GLOBAL_COLLECTION: str = "fitness_global_knowledge"

    # Redis VSS Semantic Retrieval Cache
    REDIS_VSS_INDEX: str = "idx:rag_cache"
    REDIS_VSS_DIM: int = 768
    REDIS_VSS_DISTANCE_THRESHOLD: float = 0.08  # Cosine distance <= 0.08 -> Similarity >= 0.92
    REDIS_VSS_TTL_SEC: int = 604800  # 7 days

    # FlashRank Multilingual Cross-Encoder
    FLASHRANK_MODEL: str = "ms-marco-MultiBERT-L-12"
    FLASHRANK_CONFIDENCE_THRESHOLD: float = 0.65
    FLASHRANK_MAX_LENGTH: int = 128
    FLASHRANK_CACHE_DIR: str = "/tmp/models"

    # Latency & Retrieval SLA
    RETRIEVAL_SLA_TIMEOUT_SEC: float = 0.220  # 220ms hard timeout

    # Go Speech Service
    SPEECH_SERVICE_URL: str = Field(default="http://localhost:8081", alias="SPEECH_SERVICE_URL")

    # Queue Configurations
    PLAN_QUEUE: str = "q.plans"
    PLAN_DLQ: str = "q.plans.dlq"
    PLAN_EXCHANGE: str = "zenfit.exchange"
    PREFETCH_COUNT: int = Field(default=5, alias="PREFETCH_COUNT")
    MAX_RETRIES: int = Field(default=3, alias="MAX_RETRIES")

    # Circuit Breaker Configuration
    CIRCUIT_BREAKER_FAILURE_THRESHOLD: int = 5
    CIRCUIT_BREAKER_RECOVERY_TIMEOUT_SEC: float = 60.0

    model_config = SettingsConfigDict(
        env_file=(".env", "../.env", "../../.env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @field_validator("ENVIRONMENT", mode="before")
    @classmethod
    def normalize_env(cls, v: str) -> str:
        return (v or "development").lower()

    @property
    def is_production(self) -> bool:
        return self.ENVIRONMENT == "production" or self.NODE_ENV == "production"

    def validate_production_secrets(self) -> None:
        """Enforces P0 Pre-Production Hardening: fail-closed if production secrets missing."""
        if self.is_production:
            missing = []
            if not self.MISTRAL_API_KEY:
                missing.append("MISTRAL_API_KEY")
            if not self.MONGODB_URI or "localhost" in self.MONGODB_URI:
                missing.append("MONGODB_URI")
            if missing:
                sys.stderr.write(
                    f"FATAL: Production mode requires non-empty secrets: {', '.join(missing)}\n"
                )
                raise RuntimeError(f"Missing required production configuration: {missing}")


# Singleton instance
settings = Settings()
