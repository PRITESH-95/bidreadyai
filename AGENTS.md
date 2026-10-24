# BidReady AI - Agents & Master Plan

You are helping me build "BidReady AI", a hackathon project. I am a beginner in Python, so keep code simple and well commented.

PRODUCT
BidReady AI checks whether a small business (MSME) can bid on a government tender. It reads a tender PDF, extracts the requirements, compares them with the supplier's stored profile and documents, and returns a verdict: PROCEED, INVESTIGATE or AVOID. Every finding must point to the tender clause (quote + page number) and to the supplier document that supports it.

CORE PRINCIPLE
The LLM only reads and extracts. Plain Python code verifies, calculates and decides. The LLM must NEVER output a compliance status or the final verdict.

TECH STACK (free tools only)
- Backend: Python 3.12, FastAPI, Pydantic v2 (+ pydantic-settings), SQLite, PyMuPDF, rapidfuzz, pytest
- LLM: Google Gemini via the official google-genai SDK, behind a small provider interface, plus a FakeProvider for tests
- Frontend: React + Vite + Tailwind CSS
- OCR: Tesseract only as a late fallback
- OS: Windows. Never give bash-only instructions.

FOLDER LAYOUT
bidready/
  AGENTS.md
  README.md
  backend/
    requirements.txt, .env.example
    app/ main.py, config.py, db.py
    app/models/schemas.py
    app/services/ (pdf_service, extraction_service, citation_service, units, profile_service, matcher, rules_engine, pipeline, corrigendum_service)
    app/services/llm/ (base, gemini, fake, factory)
    app/routers/
    app/scripts/
    app/eval/
    tests/ and tests/fixtures/
    data/ (uploads, cache, gold, real_tenders; gitignored)
  frontend/

DATA RULES
- Money is stored as float rupees. 1 lakh = 100,000. 1 crore = 10,000,000.
- Dates are ISO strings in JSON.
- Any function that depends on today's date takes "today" as a parameter. Never call date.today() inside rule logic.

ENUMS (use these exact names)
- RequirementCategory: FINANCIAL_TURNOVER, EXPERIENCE, CERTIFICATE, REGISTRATION, EMD, TENDER_FEE, PERFORMANCE_SECURITY, DEADLINE, TECHNICAL, OTHER
- TurnoverBasis: AVERAGE_3Y, ANY_ONE_YEAR, LAST_FY, UNSPECIFIED
- ThresholdUnit: INR, PERCENT, YEARS, COUNT
- ComplianceStatus:
  SUPPORTED = valid evidence satisfies it, or a valid exemption applies and its proof exists
  MISSING = evidence absent or expired; fixable by getting or renewing a document
  FAILED = proven not met and not fixable by a document (example: turnover too low with no exemption)
  UNCERTAIN = ambiguous clause, or evidence insufficient to decide
- Verdict: PROCEED, INVESTIGATE, AVOID
- CitationStatus: VERIFIED, FUZZY, NOT_FOUND

MODELS (Pydantic v2)
Requirement: id, category, description, is_mandatory, is_ambiguous, threshold_value (float or None), threshold_unit, turnover_basis, lookback_years (int or None), document_type_needed (str or None), exemptions (list of Exemption), source_quote, source_page, citation_status (set by code), citation_note (set by code)
Exemption: applies_to (MSME, STARTUP, OTHER), effect (WAIVED or RELAXED), relaxed_value (float or None), proof_document_type (str or None), condition_text, source_quote, source_page
ExtractionResult: tender_number, title, estimated_cost, bid_deadline (ISO datetime), requirements (list)
SupplierDocument: id, doc_type, title, issue_date, expiry_date, completion_date, value (float or None), file_path, notes
SupplierProfile: id, name, is_msme, is_startup, state, business_keywords (list of str), turnover_by_fy (dict like {"2023-24": 25000000}), max_upfront_cash_budget (float or None), documents (list)

VERDICT RULES (implemented only in Python)
1. AVOID if the bid deadline has passed, or any mandatory requirement is FAILED.
2. Else INVESTIGATE if any mandatory requirement is MISSING or UNCERTAIN, or any citation is NOT_FOUND, or financial_summary.within_budget is False.
3. Else PROCEED.
Problems with non-mandatory requirements never change the verdict, but must appear as warnings.
NEVER return PROCEED unless every mandatory requirement is SUPPORTED and every citation is VERIFIED or FUZZY.

WORKING RULES
1. Do only the chunk I give you. Do not build features from later chunks.
2. Small functions, type hints, simple comments written for a beginner.
3. No authentication, no Docker, no cloud services, no paid services.
4. No real company data. All demo data is synthetic and labeled SYNTHETIC.
5. Tests must never call the internet. Use FakeProvider with JSON fixtures.
6. Read secrets from .env through config.py. Never hardcode keys. Keep .env in .gitignore.
7. If my instruction is ambiguous, pick the simplest option and state your assumption.
8. When finished, reply with: files created or changed, how to run it, how to run the tests, and anything you were unsure about. Do not add extra features.

