"""Pydantic models (schemas) shared across the BidReady AI backend.

All data-transfer objects live here so that every service imports from
one place. Uses Pydantic **v2** syntax only.
"""

from enum import Enum
from typing import List, Optional
from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Enums from AGENTS.md (use these exact names)
# ---------------------------------------------------------------------------

class RequirementCategory(str, Enum):
    FINANCIAL_TURNOVER = "FINANCIAL_TURNOVER"
    EXPERIENCE = "EXPERIENCE"
    CERTIFICATE = "CERTIFICATE"
    REGISTRATION = "REGISTRATION"
    EMD = "EMD"
    TENDER_FEE = "TENDER_FEE"
    PERFORMANCE_SECURITY = "PERFORMANCE_SECURITY"
    DEADLINE = "DEADLINE"
    TECHNICAL = "TECHNICAL"
    OTHER = "OTHER"


class TurnoverBasis(str, Enum):
    AVERAGE_3Y = "AVERAGE_3Y"
    ANY_ONE_YEAR = "ANY_ONE_YEAR"
    LAST_FY = "LAST_FY"
    UNSPECIFIED = "UNSPECIFIED"


class ThresholdUnit(str, Enum):
    INR = "INR"
    PERCENT = "PERCENT"
    YEARS = "YEARS"
    COUNT = "COUNT"


class ComplianceStatus(str, Enum):
    SUPPORTED = "SUPPORTED"
    MISSING = "MISSING"
    FAILED = "FAILED"
    UNCERTAIN = "UNCERTAIN"


class Verdict(str, Enum):
    PROCEED = "PROCEED"
    INVESTIGATE = "INVESTIGATE"
    AVOID = "AVOID"


class CitationStatus(str, Enum):
    VERIFIED = "VERIFIED"
    FUZZY = "FUZZY"
    NOT_FOUND = "NOT_FOUND"


# ---------------------------------------------------------------------------
# PDF service models
# ---------------------------------------------------------------------------

class PageText(BaseModel):
    """Represents one page of extracted text from a PDF.

    Attributes:
        page:      1-based page number.
        text:      The text extracted from the page (may be empty).
        needs_ocr: True when the page has fewer than 30 characters of
                   extractable text – a sign the page is scanned / image-only.
    """
    page: int
    text: str
    needs_ocr: bool


# ---------------------------------------------------------------------------
# Extraction models
# ---------------------------------------------------------------------------

class Exemption(BaseModel):
    """An exemption or relaxation for a requirement (e.g. for MSME or Startup)."""
    applies_to: str  # "MSME", "STARTUP", "OTHER"
    effect: str      # "WAIVED", "RELAXED"
    relaxed_value: Optional[float] = None
    proof_document_type: Optional[str] = None
    condition_text: str
    source_quote: str
    source_page: int


class Requirement(BaseModel):
    """A single requirement extracted from the tender document."""
    id: str
    category: RequirementCategory
    description: str
    is_mandatory: bool = True
    is_ambiguous: bool = False
    threshold_value: Optional[float] = None
    threshold_unit: Optional[ThresholdUnit] = None
    turnover_basis: Optional[TurnoverBasis] = None
    lookback_years: Optional[int] = None
    document_type_needed: Optional[str] = None
    exemptions: List[Exemption] = Field(default_factory=list)
    source_quote: str
    source_page: int
    citation_status: Optional[CitationStatus] = None
    citation_note: Optional[str] = None


class ExtractionResult(BaseModel):
    """Full extraction result produced from reading a tender PDF."""
    tender_number: str
    title: str
    estimated_cost: Optional[float] = None
    bid_deadline: Optional[str] = None  # ISO format datetime string e.g. 2026-11-30T15:00:00
    requirements: List[Requirement] = Field(default_factory=list)
