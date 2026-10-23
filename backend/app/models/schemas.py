"""Pydantic models (schemas) shared across the BidReady AI backend.

All data-transfer objects live here so that every service imports from
one place.  Uses Pydantic **v2** syntax only.
"""

from pydantic import BaseModel


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

