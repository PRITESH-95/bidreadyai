"""Main FastAPI application entry point for BidReady AI.

Provides a simple health check endpoint used by the frontend to verify the
backend is running. The application also configures CORS so that the React
frontend (served from http://localhost:5173) can make requests.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from . import db
from .config import settings

app = FastAPI(title="BidReady AI Backend")

# CORS configuration – only allow the local Vite dev server.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def startup_event():
    """Initialize resources when the application starts.
    Currently we only initialise the SQLite database file.
    """
    db.init_db()


@app.get("/health")
async def health_check():
    """Simple health endpoint.

    Returns a JSON payload that the frontend can use to confirm the service is
    alive. No authentication is needed.
    """
    return {"status": "ok", "app": "BidReady AI"}


# ---- Upload endpoint: PDF in, extracted requirements out ----
import os
import tempfile
from pathlib import Path

from fastapi import File, HTTPException, UploadFile

from .services.extraction_service import ExtractionError, extract_requirements
from .services.llm.factory import get_provider
from .services.pdf_service import extract_pages


@app.post("/api/extract")
def extract_endpoint(file: UploadFile = File(...)):
    if not (file.filename or "").lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Please upload a PDF")
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".pdf")
    try:
        tmp.write(file.file.read())
        tmp.close()
        pages = extract_pages(Path(tmp.name))
        result = extract_requirements(pages, get_provider())
    except ExtractionError as e:
        raise HTTPException(status_code=502, detail=str(e))
    finally:
        os.unlink(tmp.name)
    if hasattr(result, "model_dump"):
        return result.model_dump(mode="json")
    return result.dict()
