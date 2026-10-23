"""Generate synthetic PDF test fixtures for BidReady AI.

Creates three PDFs inside ``backend/tests/fixtures/``:

1. **synthetic_tender.pdf** – a 4-page tender document.
2. **synthetic_corrigendum.pdf** – a 1-page corrigendum to that tender.
3. **scanned_like.pdf** – a 1-page PDF that contains an image of text
   with NO text layer (simulates a scanned document).

Run from the project root:

    python -m backend.tests.fixtures.make_fixtures

Every page carries the header "SYNTHETIC DOCUMENT - FOR TESTING ONLY".
"""

import os
from pathlib import Path

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm
from reportlab.pdfgen.canvas import Canvas

# We need PIL (Pillow) to create the image for the scanned-like PDF
from PIL import Image, ImageDraw, ImageFont

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

# Directory where the PDFs are written
_FIXTURES_DIR = Path(__file__).resolve().parent  # backend/tests/fixtures/

# Standard header on every page
_HEADER = "SYNTHETIC DOCUMENT - FOR TESTING ONLY"

# Page dimensions (A4)
_PAGE_W, _PAGE_H = A4  # width, height in points


def _add_header(c: Canvas) -> None:
    """Draw the standard header at the top of the current page."""
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(_PAGE_W / 2, _PAGE_H - 1.5 * cm, _HEADER)


def _draw_text_block(c: Canvas, lines: list[str], start_y: float) -> None:
    """Draw a list of text lines starting at *start_y*, wrapping if needed.

    Each string in *lines* is drawn as one paragraph.  Very long lines are
    NOT auto-wrapped (the synthetic content is short enough).
    """
    c.setFont("Helvetica", 11)
    y = start_y
    for line in lines:
        c.drawString(2 * cm, y, line)
        y -= 0.6 * cm


# ---------------------------------------------------------------------------
# 1. synthetic_tender.pdf  (4 pages)
# ---------------------------------------------------------------------------

def _create_tender(path: Path) -> None:
    """Build the synthetic tender PDF."""
    c = Canvas(str(path), pagesize=A4)

    # ── Page 1 ─────────────────────────────────────────────────────────
    _add_header(c)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(_PAGE_W / 2, _PAGE_H - 3 * cm, "NOTICE INVITING TENDER")
    _draw_text_block(c, [
        "Tender No: SYN/2026/001",
        "",
        "Title: Supply of Office Furniture to District Office",
        "",
        "Estimated cost: Rs. 40,00,000/-",
        "",
        "Last date and time for bid submission: 30-Nov-2026 15:00",
        "",
        "Earnest Money Deposit (EMD): Rs. 2,00,000/-",
        "",
        "Tender document fee: Rs. 1,000/-",
    ], _PAGE_H - 5 * cm)
    c.showPage()

    # ── Page 2 ─────────────────────────────────────────────────────────
    _add_header(c)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(_PAGE_W / 2, _PAGE_H - 3 * cm, "ELIGIBILITY CRITERIA")
    _draw_text_block(c, [
        "2.1 The bidder must have an average annual turnover of not less than",
        "Rs. 5 Crore during the last three financial years.",
        "",
        "2.2 The bidder must have a valid GST registration.",
        "",
        "2.3 The bidder must hold a valid ISO 9001 certification.",
    ], _PAGE_H - 5 * cm)
    c.showPage()

    # ── Page 3 ─────────────────────────────────────────────────────────
    _add_header(c)
    _draw_text_block(c, [
        "2.4 The bidder must have successfully completed at least one similar",
        "supply order of value not less than Rs. 20 lakh in the last five years.",
        "",
        "",
        "EXEMPTIONS",
        "",
        "3.1 Micro and Small Enterprises registered under Udyam are exempted",
        "from the turnover requirement in clause 2.1 and from payment of EMD,",
        "on submission of a valid Udyam registration certificate.",
    ], _PAGE_H - 3 * cm)
    c.showPage()

    # ── Page 4 ─────────────────────────────────────────────────────────
    _add_header(c)
    _draw_text_block(c, [
        "4.1 The successful bidder shall furnish a performance security of",
        "5% of the contract value.",
        "",
        "4.2 Bids must be submitted online as a single PDF file.",
    ], _PAGE_H - 3 * cm)
    c.showPage()

    c.save()


# ---------------------------------------------------------------------------
# 2. synthetic_corrigendum.pdf  (1 page)
# ---------------------------------------------------------------------------

def _create_corrigendum(path: Path) -> None:
    """Build the synthetic corrigendum PDF."""
    c = Canvas(str(path), pagesize=A4)

    _add_header(c)
    c.setFont("Helvetica-Bold", 14)
    c.drawCentredString(
        _PAGE_W / 2, _PAGE_H - 3 * cm,
        "CORRIGENDUM No. 1 to Tender SYN/2026/001",
    )
    _draw_text_block(c, [
        "Dated: 05-Nov-2026",
        "",
        "1. Clause 2.3 (ISO 9001 certification) is deleted.",
        "",
        "2. The last date for bid submission is extended to 10-Dec-2026 15:00.",
    ], _PAGE_H - 5 * cm)
    c.showPage()
    c.save()


# ---------------------------------------------------------------------------
# 3. scanned_like.pdf  (1 page, image only, NO text layer)
# ---------------------------------------------------------------------------

def _create_scanned_like(path: Path) -> None:
    """Build a PDF whose only page is an image – no extractable text.

    We draw text onto a PIL image, save it as a temporary PNG, then
    embed that PNG into a PDF page so there is no text layer at all.
    """
    # Create a white image with text drawn on it
    img_w, img_h = 1200, 1600  # pixels
    img = Image.new("RGB", (img_w, img_h), "white")
    draw = ImageDraw.Draw(img)

    # Use a basic built-in font (always available, no extra install)
    try:
        font = ImageFont.truetype("arial.ttf", 28)
    except OSError:
        # Fallback if Arial is not available on this machine
        font = ImageFont.load_default()

    # Draw the header and some body text onto the image
    draw.text((100, 60), _HEADER, fill="black", font=font)
    draw.text((100, 160), "This page is an image – it has NO text layer.", fill="black", font=font)
    draw.text((100, 220), "OCR would be needed to read this content.", fill="black", font=font)

    # Save the image to a temporary PNG file next to the output PDF
    tmp_png = path.with_suffix(".png")
    img.save(str(tmp_png))

    # Build a PDF that contains ONLY this image (no text objects)
    c = Canvas(str(path), pagesize=A4)
    c.drawImage(str(tmp_png), 0, 0, width=_PAGE_W, height=_PAGE_H)
    c.showPage()
    c.save()

    # Clean up the temporary PNG
    tmp_png.unlink(missing_ok=True)


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def make_all() -> list[Path]:
    """Generate all fixture PDFs and return their paths.

    Safe to call multiple times – existing files are overwritten.
    """
    # Make sure the fixtures directory exists
    _FIXTURES_DIR.mkdir(parents=True, exist_ok=True)

    tender_path = _FIXTURES_DIR / "synthetic_tender.pdf"
    corrigendum_path = _FIXTURES_DIR / "synthetic_corrigendum.pdf"
    scanned_path = _FIXTURES_DIR / "scanned_like.pdf"

    _create_tender(tender_path)
    _create_corrigendum(corrigendum_path)
    _create_scanned_like(scanned_path)

    return [tender_path, corrigendum_path, scanned_path]


# ── CLI entry point ────────────────────────────────────────────────────
if __name__ == "__main__":
    paths = make_all()
    for p in paths:
        size_kb = os.path.getsize(p) / 1024
        print(f"  Created: {p}  ({size_kb:.1f} KB)")
    print("Done.")

