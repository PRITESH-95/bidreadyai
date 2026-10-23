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
