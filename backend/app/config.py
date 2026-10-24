from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    # Reads values from backend/.env. Defaults are used if a value is missing.
    LLM_PROVIDER: str = "fake"
    
    GEMINI_API_KEY: str = ""    
    GEMINI_MODEL: str = "gemini-2.5-flash"
    DB_PATH: str = "backend/data/bidready.db"
    DEMO_MODE: str = "live"

    model_config = SettingsConfigDict(env_file="backend/.env", extra="ignore")


settings = Settings()
