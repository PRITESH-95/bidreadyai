# BidReady AI

A minimal **hackathon** starter for the BidReady AI project.

## Project structure
```
bidready/
├─ backend/               # FastAPI backend
│   ├─ app/
│   │   ├─ __init__.py
│   │   ├─ main.py        # FastAPI entry point with /health
│   │   ├─ config.py      # Loads .env variables (pydantic Settings)
│   │   └─ db.py          # Creates SQLite file on startup
│   ├─ requirements.txt
│   ├─ .env.example
│   └─ tests/
│       └─ test_health.py
├─ frontend/              # React + Vite + Tailwind
│   ├─ src/
│   │   ├─ App.jsx
│   │   ├─ main.jsx
│   │   └─ index.css
│   ├─ index.html
│   ├─ vite.config.ts
│   ├─ tailwind.config.cjs
│   └─ package.json
├─ .gitignore
└─ README.md               # **You are reading it**
```

## Prerequisites
- **Windows PowerShell**
- **Python 3.11** (add to PATH)
- **Node.js** (>=18) and **npm** (or **pnpm** if you prefer)
- **Git** (optional, for version control)

## Backend – FastAPI
1. Open a PowerShell terminal in the project root (`c:\hackathon\bidready`).
2. Create a virtual environment and activate it:
   ```powershell
   python -m venv venv
   .\venv\Scripts\Activate.ps1
   ```
3. Install Python dependencies:
   ```powershell
   pip install -r backend\requirements.txt
   ```
4. Copy the example env file and edit if needed:
   ```powershell
   cp backend\.env.example backend\.env
   # (Edit backend\.env to set real values – for now the defaults work.)
   ```
5. Run the API (uvicorn will watch for changes):
   ```powershell
   uvicorn backend.app.main:app --reload --port 8000
   ```
   The service will be reachable at `http://localhost:8000`.
6. Verify the health endpoint:
   ```powershell
   Invoke-RestMethod http://localhost:8000/health
   ```
   Expected output: `{ "status": "ok", "app": "BidReady AI" }`

### Running the backend tests
```powershell
pip install pytest
pytest backend\tests
```
All tests should pass.

## Frontend – React + Vite + Tailwind
1. In a **new** PowerShell window (still in the project root):
   ```powershell
   cd frontend
   npm install   # or "pnpm install" if you have pnpm
   ```
2. Start the dev server:
   ```powershell
   npm run dev   # Vite will serve on http://localhost:5173
   ```
   The page shows **BidReady AI** and reports **Backend: connected** (or *offline* if the backend is not reachable).
3. To build a production bundle:
   ```powershell
   npm run build
   ```
   The compiled files appear in `frontend/dist/`.

## Notes & assumptions
- The backend only exposes `/health`; no other routes or LLM logic are added yet (as requested).
- CORS is limited to `http://localhost:5173` to match the Vite dev server.
- The SQLite database file is created under `backend/data/bidready.db` on first startup.
- Tests use FastAPI's `TestClient` and monkey‑patch the `DB_PATH` to a temporary location.
- The frontend reads the base URL from the Vite environment variable `VITE_API_URL`. If you change the backend port, set it accordingly, e.g. `"VITE_API_URL=http://localhost:8001"` in a `.env` file at `frontend/.env`.

Happy hacking!

