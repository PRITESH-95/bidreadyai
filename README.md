# BidReady AI

**From tender PDF to a clearer bidding decision.**

BidReady AI is a hackathon project that helps teams turn lengthy tender documents into structured, reviewable information. It combines a React dashboard with a FastAPI backend for PDF processing and requirement extraction.

> **Project status:** Active hackathon prototype. Extracted information should always be checked against the original tender document. This tool does not replace professional procurement, legal, or financial review.

## What it does

- **Tender PDF upload:** Submit a tender document for processing.
- **Structured extraction:** Review tender details and extracted requirements returned by the backend.
- **Requirement review:** Inspect categories, mandatory flags, document requirements, thresholds, exemptions and source references when present in the extraction result.
- **Modern dashboard:** A light-themed interface for reviewing tender information.
- **Backend extensibility:** Provider abstraction and tests support continued development of the extraction pipeline.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | React, Vite, Tailwind CSS |
| Backend | Python, FastAPI |
| Data storage | SQLite (local development) |
| Document processing | Python PDF-processing services |
| LLM integration | Configurable provider adapters (see `backend/app/services/llm/`) |

## Getting started (Windows PowerShell)

### 1. Clone

```powershell
git clone https://github.com/PRITESH-95/bidreadyai.git
cd bidreadyai
```

### 2. Start the backend

```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
pip install -r backend\requirements.txt
Copy-Item backend\.env.example backend\.env
python -m uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Set the necessary provider configuration in `backend/.env` according to `backend/.env.example`. Never commit credentials.

Backend API documentation: **http://127.0.0.1:8000/docs**

### 3. Start the frontend

In a second terminal:

```powershell
cd bidreadyai\frontend
npm install
npm run dev
```

Open the local URL printed by Vite (typically **http://localhost:5173**).

> If the frontend is hosted on a different port, verify that the frontend API URL and backend CORS configuration are compatible.

## Project layout

```text
bidreadyai/
├── backend/
│   ├── app/
│   │   ├── main.py              # API entry point
│   │   ├── models/              # Request / response schemas
│   │   └── services/            # PDF and extraction services
│   ├── tests/                   # Backend tests and fixtures
│   └── requirements.txt
├── frontend/
│   └── src/                     # React interface
├── AGENTS.md                    # Agent development guidance
└── README.md
```

## Demo walkthrough

1. Open the dashboard and check the backend connection.
2. Upload a sample tender PDF.
3. Start extraction and review the returned tender summary.
4. Inspect requirements, mandatory conditions, evidence documents and source pages where available.
5. Validate the extracted information against the original PDF.

## Agent37 hackathon contribution

Agent37 Hermes was used in a separate development environment to work on a frontend redesign and a two-tender comparison feature. This work was recorded as local commits `8e46f05` and `95579ee` in that environment. **Do not assume these features are included in `main` until the corresponding code has been transferred, reviewed, tested and pushed.**

The primary project branch remains focused on the working BidReady application. Agent experiments and feature development should be kept on dedicated branches until reviewed.

## Testing

Backend:

```powershell
python -m pytest backend/tests -q
```

Frontend:

```powershell
cd frontend
npm run build
```

A successful build does not by itself guarantee that the entire PDF workflow works end to end; test the workflow with a real sample document.

## Security and limitations

- Never upload real API keys, `.env` files or private supplier/tender data to the public repository.
- Treat model-produced extraction results as suggestions requiring verification.
- This repository is a prototype and is not a certified compliance or bidding decision system.

## Repository

**Maintainer:** [PRITESH-95](https://github.com/PRITESH-95)  
**Source:** [PRITESH-95/bidreadyai](https://github.com/PRITESH-95/bidreadyai)
