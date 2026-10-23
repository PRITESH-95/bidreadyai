"""Tests for the PDF extraction service.

Verifies that ``extract_pages`` correctly reads synthetic PDFs and
flags scanned-image pages with ``needs_ocr=True``.

The tests auto-generate fixture PDFs if they do not already exist.
"""

from pathlib import Path

import pytest

from backend.app.services.pdf_service import extract_pages
from backend.tests.fixtures.make_fixtures import make_all as make_fixtures

# ---------------------------------------------------------------------------
# Fixture: ensure PDFs exist before any test runs
# ---------------------------------------------------------------------------

_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"


@pytest.fixture(autouse=True, scope="module")
def ensure_fixture_pdfs():
    """Generate the synthetic PDFs once per test module, if missing."""
    tender = _FIXTURES_DIR / "synthetic_tender.pdf"
    if not tender.exists():
        make_fixtures()


# ---------------------------------------------------------------------------
# Tests for synthetic_tender.pdf
# ---------------------------------------------------------------------------

class TestSyntheticTender:
    """Tests against the 4-page synthetic tender document."""

    @pytest.fixture()
    def pages(self):
        """Extract pages from the synthetic tender."""
        return extract_pages(_FIXTURES_DIR / "synthetic_tender.pdf")

    def test_page_count(self, pages):
        """The tender PDF must have exactly 4 pages."""
        assert len(pages) == 4

    def test_pages_are_one_based(self, pages):
        """Page numbers should start at 1 and go to 4."""
        page_numbers = [p.page for p in pages]
        assert page_numbers == [1, 2, 3, 4]

    def test_page2_contains_turnover(self, pages):
        """Page 2 (eligibility criteria) must contain the turnover clause."""
        page2_text = pages[1].text  # 0-indexed list, page number 2
        assert "average annual turnover" in page2_text.lower()

    def test_no_page_needs_ocr(self, pages):
        """All pages in the tender PDF have real text – none need OCR."""
        for p in pages:
            assert p.needs_ocr is False, (
                f"Page {p.page} incorrectly flagged as needs_ocr"
            )

    def test_page1_has_tender_number(self, pages):
        """Page 1 should contain the tender number."""
        assert "SYN/2026/001" in pages[0].text

    def test_page3_has_exemptions(self, pages):
        """Page 3 should mention the Udyam exemption."""
        assert "Udyam" in pages[2].text


# ---------------------------------------------------------------------------
# Tests for scanned_like.pdf
# ---------------------------------------------------------------------------

class TestScannedLike:
    """Tests against the image-only (scanned-like) PDF."""

    @pytest.fixture()
    def pages(self):
        """Extract pages from the scanned-like PDF."""
        return extract_pages(_FIXTURES_DIR / "scanned_like.pdf")

    def test_page_count(self, pages):
        """The scanned PDF has exactly 1 page."""
        assert len(pages) == 1

    def test_needs_ocr_is_true(self, pages):
        """The page is image-only, so needs_ocr must be True."""
        assert pages[0].needs_ocr is True


# ---------------------------------------------------------------------------
# Tests for synthetic_corrigendum.pdf
# ---------------------------------------------------------------------------

class TestSyntheticCorrigendum:
    """Tests against the 1-page corrigendum document."""

    @pytest.fixture()
    def pages(self):
        """Extract pages from the corrigendum PDF."""
        return extract_pages(_FIXTURES_DIR / "synthetic_corrigendum.pdf")

    def test_page_count(self, pages):
        """The corrigendum PDF has exactly 1 page."""
        assert len(pages) == 1

    def test_contains_corrigendum_text(self, pages):
        """The page should mention the corrigendum title."""
        assert "CORRIGENDUM" in pages[0].text

    def test_needs_ocr_is_false(self, pages):
        """The corrigendum page has real text – it should not need OCR."""
        assert pages[0].needs_ocr is False


# ---------------------------------------------------------------------------
# Edge-case tests
# ---------------------------------------------------------------------------

class TestEdgeCases:
    """Miscellaneous edge-case tests for pdf_service."""

    def test_missing_file_raises(self):
        """extract_pages should raise FileNotFoundError for missing files."""
        with pytest.raises(FileNotFoundError):
            extract_pages("this_file_does_not_exist.pdf")

