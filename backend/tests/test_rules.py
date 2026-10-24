import pytest

from backend.app.models.schemas import (
    ExtractionResult,
    Requirement,
    RequirementCategory,
    ThresholdUnit,
    Verdict,
)
from backend.app.services.rules_service import SupplierProfile, evaluate_requirements, final_recommendation


@pytest.fixture
def sample_extraction() -> ExtractionResult:
    """Create a minimal ExtractionResult with three different requirement types."""
    turnover_req = Requirement(
        id="R1",
        category=RequirementCategory.FINANCIAL_TURNOVER,
        description="Turnover must be at least INR 1,000,000",
        threshold_value=1_000_000,
        threshold_unit=ThresholdUnit.INR,
        source_quote="",
        source_page=1,
    )
    experience_req = Requirement(
        id="R2",
        category=RequirementCategory.EXPERIENCE,
        description="Supplier must have at least 5 years in business",
        lookback_years=5,
        source_quote="",
        source_page=2,
    )
    certificate_req = Requirement(
        id="R3",
        category=RequirementCategory.CERTIFICATE,
        description="ISO 9001 certification required",
        document_type_needed="ISO9001",
        source_quote="",
        source_page=3,
    )
    return ExtractionResult(
        tender_number="TN-001",
        title="Sample Tender",
        requirements=[turnover_req, experience_req, certificate_req],
    )


def test_evaluate_requirements_all_pass(sample_extraction):
    supplier = SupplierProfile(
        turnover=2_000_000,
        years_in_business=10,
        past_projects=15,
        certifications=["ISO9001", "ISO14001"],
        is_msme=False,
        is_startup=False,
    )
    checks = evaluate_requirements(sample_extraction, supplier)

    assert len(checks) == 3
    # All should be "pass"
    assert all(chk["status"] == "pass" for chk in checks)
    assert final_recommendation(checks) == Verdict.PROCEED


def test_evaluate_requirements_some_fail(sample_extraction):
    supplier = SupplierProfile(
        turnover=500_000,          # below turnover threshold
        years_in_business=6,       # meets experience
        past_projects=5,
        certifications=[],        # missing ISO9001
        is_msme=False,
        is_startup=False,
    )
    checks = evaluate_requirements(sample_extraction, supplier)

    # Expect: R1 fail, R2 pass, R3 fail
    status_by_id = {chk["name"]: chk["status"] for chk in checks}
    assert status_by_id["R1"] == "fail"
    assert status_by_id["R2"] == "pass"
    assert status_by_id["R3"] == "fail"

    assert final_recommendation(checks) == Verdict.AVOID


def test_evaluate_requirements_unknown_category():
    # Requirement with a category that we don't explicitly handle
    unknown_req = Requirement(
        id="R4",
        category=RequirementCategory.OTHER,
        description="Some miscellaneous clause",
        source_quote="",
        source_page=4,
    )
    extraction = ExtractionResult(
        tender_number="TN-002",
        title="Tender with unknown clause",
        requirements=[unknown_req],
    )
    supplier = SupplierProfile(
        turnover=1_000_000,
        years_in_business=5,
        past_projects=3,
        certifications=[],
    )
    checks = evaluate_requirements(extraction, supplier)

    assert len(checks) == 1
    assert checks[0]["status"] == "unknown"
    assert final_recommendation(checks) == Verdict.INVESTIGATE
