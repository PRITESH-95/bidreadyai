import pytest
from fastapi.testclient import TestClient
from pathlib import Path

# Import the FastAPI app from the backend package
from backend.app.main import app

client = TestClient(app)

def test_health_endpoint():
    """The /health endpoint should return status ok and app name."""
    response = client.get("/health")
    assert response.status_code == 200
    json_data = response.json()
    assert json_data["status"] == "ok"
    assert json_data["app"] == "BidReady AI"

def test_database_file_created(tmp_path: Path, monkeypatch):
    """On startup the init_db should create the SQLite file at the configured path.
    We monkeypatch the SETTINGS DB_PATH to a temporary location.
    """
    from backend.app import config, db

    # Redirect DB_PATH to a temp file
    temp_db = tmp_path / "test.db"
    monkeypatch.setattr(config.settings, "DB_PATH", str(temp_db))

    # Call init_db directly (startup event would also call it)
    db.init_db()
    assert temp_db.exists()

