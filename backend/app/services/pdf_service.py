"""PDF text extraction service for BidReady AI.

Uses PyMuPDF (imported as ``fitz``) to pull text from each page of a PDF.
Pages with fewer than 30 characters are flagged with ``needs_ocr=True``
so that a later OCR step can handle them.  This module does NOT perform
OCR itself.

Can also be run as a script from the project root:

    python -m backend.app.services.pdf_service <path_to_pdf>

It prints per page: page number, character count, needs_ocr flag, and
the first 150 characters of extracted text.
"""

import sys
from pathlib import Path
from typing import List

import pymupdf  # PyMuPDF (the "fitz" import name is deprecated)

from backend.app.models.schemas import PageText

# If a page yields fewer than this many characters, we assume
# it is a scanned image and needs OCR later.
_MIN_CHARS_FOR_TEXT = 30


def extract_pages(pdf_path: str | Path) -> List[PageText]:
    """Read every page of *pdf_path* and return a list of PageText objects.

    Args:
        pdf_path: File-system path to the PDF file.

    Returns:
        A list with one ``PageText`` per page.  Page numbers start at 1.

    Raises:
        FileNotFoundError: If *pdf_path* does not exist.
        RuntimeError:      If PyMuPDF cannot open the file.
    """
    pdf_path = Path(pdf_path)

    # Friendly error for missing files
    if not pdf_path.exists():
        raise FileNotFoundError(f"PDF not found: {pdf_path}")

    # Open the document with PyMuPDF
    doc = pymupdf.open(str(pdf_path))

    pages: List[PageText] = []
    for page_number in range(len(doc)):
        # Extract plain text from this page
        text = doc[page_number].get_text("text")

        # Flag pages that have almost no extractable text
        needs_ocr = len(text.strip()) < _MIN_CHARS_FOR_TEXT

        pages.append(
            PageText(
                page=page_number + 1,   # 1-based
                text=text,
                needs_ocr=needs_ocr,
            )
        )

    doc.close()
    return pages


# ── CLI entry point ────────────────────────────────────────────────────
def _main() -> None:
    """Print a quick summary of each page when run as a script."""
    if len(sys.argv) < 2:
        print("Usage: python -m backend.app.services.pdf_service <pdf_file>")
        sys.exit(1)

    pdf_path = sys.argv[1]
    pages = extract_pages(pdf_path)

    for p in pages:
        # Show the first 150 chars on one line, replacing newlines
        preview = p.text.replace("\n", " ").strip()[:150]
        print(
            f"Page {p.page}  |  chars={len(p.text):>5}  |  "
            f"needs_ocr={str(p.needs_ocr):<5}  |  {preview}"
        )


if __name__ == "__main__":
    _main()
