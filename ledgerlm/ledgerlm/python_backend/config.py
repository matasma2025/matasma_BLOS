"""Configuration settings for LedgerLM Python Backend"""
import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    # Server
    API_HOST: str = "0.0.0.0"
    API_PORT: int = 8000
    
    # Database — legacy URL (used when DB_AUTH_MODE is not set)
    DATABASE_URL: str = os.environ.get("NEON_DATABASE_URL", os.environ.get("DATABASE_URL", ""))

    # Database — auth mode selector
    # Values: "" / "neon" (default), "postgres-azure", "entra", "hybrid"
    # When "entra" or "hybrid": DB_HOST + DB_USER + DB_NAME are used; password
    # is fetched automatically from Azure IMDS (no DB_PASSWORD needed).
    # When "postgres-azure": DB_HOST + DB_USER + DB_NAME + DB_PASSWORD are used.
    DB_AUTH_MODE: str = os.environ.get("DB_AUTH_MODE", "")
    DB_HOST: str = os.environ.get("DB_HOST", "")
    DB_USER: str = os.environ.get("DB_USER", "")
    DB_NAME: str = os.environ.get("DB_NAME", "")
    DB_PASSWORD: str = os.environ.get("DB_PASSWORD", "")
    
    # Ollama (OpenAI Compatible)
    OLLAMA_BASE_URL: str = os.environ.get("OLLAMA_BASE_URL", "https://ollama.ledgerlm.ai").replace("/v1", "").rstrip("/")
    OLLAMA_API_KEY: str = os.environ.get("OLLAMA_API_KEY", "ledgerlm-secret-key")
    OLLAMA_CHAT_MODEL: str = os.environ.get("OLLAMA_CHAT_MODEL", "qwen2.5:32b")
    OLLAMA_EMBEDDING_MODEL: str = os.environ.get("OLLAMA_EMBEDDING_MODEL", "mxbai-embed-large")
    
    # Azure OpenAI — takes priority over Ollama when AZURE_OPENAI_ENDPOINT is set
    AZURE_OPENAI_ENDPOINT: str = os.environ.get("AZURE_OPENAI_ENDPOINT", "")
    AZURE_OPENAI_KEY: str = os.environ.get("AZURE_OPENAI_KEY", "")
    AZURE_OPENAI_CHAT_MODEL: str = os.environ.get("AZURE_OPENAI_CHAT_MODEL", "")
    AZURE_OPENAI_EMBED_MODEL: str = os.environ.get("AZURE_OPENAI_EMBED_MODEL", "")
    AZURE_OPENAI_CHAT_API_VERSION: str = os.environ.get("AZURE_OPENAI_CHAT_API_VERSION", "2024-12-01-preview")
    AZURE_OPENAI_EMBED_API_VERSION: str = os.environ.get("AZURE_OPENAI_EMBED_API_VERSION", "2024-02-01")

    # Legacy OpenAI placeholders (to avoid breaking imports)
    OPENAI_API_KEY: str = OLLAMA_API_KEY
    OPENAI_CHAT_MODEL: str = OLLAMA_CHAT_MODEL
    OPENAI_EMBEDDING_MODEL: str = OLLAMA_EMBEDDING_MODEL
    
    # Google Search
    GOOGLE_API_KEY: str = os.environ.get("GOOGLE_API_KEY", "")
    GOOGLE_CSE_ID: str = os.environ.get("GOOGLE_CSE_ID", "")
    
    # Document Processing
    MAX_FILE_SIZE: int = 2000 * 1024 * 1024  # 2GB for very large financial files
    CHUNK_SIZE: int = 8000
    CHUNK_OVERLAP: int = 1000
    
    # Timeouts for large file processing
    UPLOAD_TIMEOUT: int = 1800  # 30 minutes for large uploads
    PROCESSING_TIMEOUT: int = 3600  # 60 minutes for processing
    
    # Storage
    UPLOAD_DIR: str = "./uploads"
    
    class Config:
        env_file = ".env"
        extra = "ignore"  # Ignore extra environment variables

settings = Settings()

def get_default_ai_config() -> dict | None:
    """Return Azure OpenAI ai_config when env vars are set, else None (Ollama fallback)."""
    if settings.AZURE_OPENAI_ENDPOINT and settings.AZURE_OPENAI_KEY and settings.AZURE_OPENAI_CHAT_MODEL:
        return {
            "provider": "azure_openai",
            "endpoint": settings.AZURE_OPENAI_ENDPOINT,
            "api_key": settings.AZURE_OPENAI_KEY,
            "chat_model": settings.AZURE_OPENAI_CHAT_MODEL,
            "chat_api_version": settings.AZURE_OPENAI_CHAT_API_VERSION,
            "embedding_model": settings.AZURE_OPENAI_EMBED_MODEL,
            "embedding_api_version": settings.AZURE_OPENAI_EMBED_API_VERSION,
        }
    return None
