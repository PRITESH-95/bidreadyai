"""Business rule evaluation service.

This module provides plain‑Python functions that evaluate the extracted
tender data (see :pymod:`backend.app.models.schemas`) against a supplier
profile and produce a list of checks.  A final recommendation (Proceed,
Investigate or Avoid) is derived from those checks.
"""

from __future__ import annotations

from dataclasses import dataclass
from typing import List, Literal

from backend.app.models.schemas import (
    ExtractionResult,
    Requirement,
    RequirementCategory,
    Verdict,
)


# ---------------------------------------------------------------------------
# Supplier profile model
# ---------------------------------------------------------------------------


@dataclass
class SupplierProfile:
    """Simple representation of a supplier's capabilities."""

    turnover: float  # total turnover (same currency as tender thresholds)
    years_in_business: int
    past_projects: int
    certifications: List[str]  # e.g. ["ISO9001", "ISO14001"]
    is_msme: bool = False
    is_startup: bool = False


# ---------------------------------------------------------------------------
# Check model (plain dict is sufficient, but we keep a Typed alias)
# ---------------------------------------------------------------------------

CheckStatus = Literal["pass", "fail", "unknown"]


def _evaluate_turnover(req: Requirement, supplier: SupplierProfile) -> CheckStatus:
    """Evaluate a FINANCIAL_TURNOVER requirement."""
    if req.threshold_value is None:
        return "unknown"
    return "pass" if supplier.turnover >= req.threshold_value else "fail"


def _evaluate_experience(req: Requirement, supplier: SupplierProfile) -> CheckStatus:
    """Evaluate an EXPERIENCE requirement."""
    if req.lookback_years is None:
        return "unknown"
    return "pass" if supplier.years_in_business >= req.lookback_years else "fail"


def _evaluate_certificate(req: Requirement, supplier: SupplierProfile) -> CheckStatus:
    """Evaluate a CERTIFICATE requirement."""
    needed = req.document_type_needed
    if not needed:
        return "unknown"
    return "pass" if needed in supplier.certifications else "fail"


def _apply_exemptions(req: Requirement, supplier: SupplierProfile) -> bool:
    """
    Return ``True`` if any exemption applies to the supplier, meaning the
    requirement can be considered satisfied regardless of the normal check.
    """
    for exc in req.exemptions:
        # Very simple exemption handling – only looks at the ``applies_to`` field.
        if exc.applies_to == "MSME" and supplier.is_msme:
            return True
        if exc.applies_to == "STARTUP" and supplier.is_startup:
            return True
        if exc.applies_to == "OTHER":
            return True
    return False


def evaluate_requirements(
    extraction: ExtractionResult, supplier: SupplierProfile
) -> List[dict]:
    """
    Evaluate each requirement in ``extraction`` against ``supplier``.

    Returns a list of dictionaries, each containing:
        - ``name``   : the requirement ``id`` (unique identifier)
        - ``status`` : ``"pass"``, ``"fail"`` or ``"unknown"``
        - ``clause`` : the requirement description (the tender clause)
    """
    checks: List[dict] = []

    for req in extraction.requirements:
        # If an exemption applies, automatically pass the check.
        if _apply_exemptions(req, supplier):
            status: CheckStatus = "pass"
        elif req.category == RequirementCategory.FINANCIAL_TURNOVER:
            status = _evaluate_turnover(req, supplier)
        elif req.category == RequirementCategory.EXPERIENCE:
            status = _evaluate_experience(req, supplier)
        elif req.category == RequirementCategory.CERTIFICATE:
            status = _evaluate_certificate(req, supplier)
        else:
            status = "unknown"

        checks.append(
            {
                "name": req.id,
                "status": status,
                "clause": req.description,
            }
        )

    return checks


def final_recommendation(checks: List[dict]) -> Verdict:
    """
    Derive a final recommendation from a list of checks.

    * If any check has status ``"fail"``, the recommendation is ``AVOID``.
    * Else if any check has status ``"unknown"``, the recommendation is
      ``INVESTIGATE``.
    * Otherwise all checks passed and the recommendation is ``PROCEED``.
    """
    has_fail = any(chk["status"] == "fail" for chk in checks)
    if has_fail:
        return Verdict.AVOID

    has_unknown = any(chk["status"] == "unknown" for chk in checks)
    if has_unknown:
        return Verdict.INVESTIGATE

    return Verdict.PROCEED
