"""Unit tests for the requirement extraction service.

Uses FakeProvider exclusively to verify:
1. Valid JSON gives 7 requirements.
2. Invalid JSON followed by valid JSON succeeds via the retry mechanism.
3. Two consecutive invalid responses raise ExtractionError.
4. A cache hit does not call the LLM provider a second time.
"""

import json
from pathlib import Path
import pytest

from backend.app.models.schemas import PageText, RequirementCategory
from backend.app.services.extraction_service import (
    ExtractionError,
    extract_requirements,
)
from backend.app.services.llm.fake import FakeProvider
from backend.app.services.pdf_service import extract_pages
from backend.tests.fixtures.make_fixtures import make_all as make_fixtures

_FIXTURES_DIR = Path(__file__).resolve().parent / "fixtures"
_TENDER_PDF = _FIXTURES_DIR / "synthetic_tender.pdf"
_FIXTURE_JSON_PATH = _FIXTURES_DIR / "extraction_synthetic_tender.json"


@pytest.fixture(scope="module")
def sample_pages() -> list[PageText]:
    """Ensure fixture PDFs exist and return extracted pages."""
    if not _TENDER_PDF.exists():
        make_fixtures()
    return extract_pages(_TENDER_PDF)


@pytest.fixture()
def valid_fixture_dict() -> dict:
    """Load valid ground truth JSON fixture."""
    with open(_FIXTURE_JSON_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def test_valid_json_gives_7_requirements(sample_pages, valid_fixture_dict):
    """FakeProvider returns valid extraction JSON and yields 7 requirements."""
    provider = FakeProvider(fixture_path=_FIXTURE_JSON_PATH)
    result = extract_requirements(sample_pages, provider, use_cache=False)

    assert result.tender_number == "SYN/2026/001"
    assert result.title == "Supply of Office Furniture to District Office"
    assert result.estimated_cost == 4000000.0
    assert result.bid_deadline == "2026-11-30T15:00:00"
    assert len(result.requirements) == 7

    categories = [r.category for r in result.requirements]
    assert RequirementCategory.EMD in categories
    assert RequirementCategory.TENDER_FEE in categories
    assert RequirementCategory.FINANCIAL_TURNOVER in categories
    assert RequirementCategory.REGISTRATION in categories
    assert RequirementCategory.CERTIFICATE in categories
    assert RequirementCategory.EXPERIENCE in categories
    assert RequirementCategory.PERFORMANCE_SECURITY in categories

    # Check turnover has 1 exemption
    turnover_req = next(
        r for r in result.requirements if r.category == RequirementCategory.FINANCIAL_TURNOVER
    )
    assert len(turnover_req.exemptions) == 1
    assert turnover_req.exemptions[0].applies_to == "MSME"
    assert turnover_req.exemptions[0].effect == "WAIVED"
    assert turnover_req.exemptions[0].proof_document_type == "Udyam Registration"


def test_invalid_json_then_valid_succeeds_via_retry(sample_pages, valid_fixture_dict):
    """If the first response fails validation, retry with error message succeeds."""
    provider = FakeProvider()
    # 1st call returns schema-invalid dict (missing required tender_number and title)
    provider.queue_response({"invalid_payload": True, "requirements": "not-a-list"})
    # 2nd call returns valid fixture dict
    provider.queue_response(valid_fixture_dict)

    result = extract_requirements(sample_pages, provider, use_cache=False)

    assert provider.call_count == 2
    assert len(result.requirements) == 7
    assert result.tender_number == "SYN/2026/001"


def test_two_invalid_responses_raise_extraction_error(sample_pages):
    """Two consecutive schema-invalid responses must raise ExtractionError."""
    provider = FakeProvider()
    provider.queue_response({"bad_field_1": "invalid"})
    provider.queue_response({"bad_field_2": "still_invalid"})

    with pytest.raises(ExtractionError) as exc_info:
        extract_requirements(sample_pages, provider, use_cache=False)

    assert provider.call_count == 2
    assert "Extraction validation failed after retry" in str(exc_info.value)


def test_cache_hit_does_not_call_provider_twice(sample_pages, tmp_path):
    """When a cached result is present, the LLM provider is not invoked."""
    provider = FakeProvider()

    # First call: cache miss -> provider invoked once
    result_first = extract_requirements(
        sample_pages, provider, use_cache=True, cache_dir=tmp_path
    )
    assert provider.call_count == 1
    assert len(result_first.requirements) == 7

    # Second call: cache hit -> provider is NOT invoked
    result_second = extract_requirements(
        sample_pages, provider, use_cache=True, cache_dir=tmp_path
    )
    assert provider.call_count == 1
    assert len(result_second.requirements) == 7
    assert result_second.tender_number == result_first.tender_number

