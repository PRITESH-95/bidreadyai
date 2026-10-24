"""Requirement extraction service for tender documents.

Uses an LLMProvider to extract tender metadata, eligibility criteria, financial
requirements, and applicable exemptions from page-tagged text. Validates outputs
with Pydantic v2 and caches results to disk.
"""

import hashlib
import json
import logging
from pathlib import Path
from typing import List, Optional

from backend.app.models.schemas import ExtractionResult, PageText
from backend.app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)

PROMPT_VERSION = "v1.0"
CACHE_DIR = Path("backend/data/cache")


class ExtractionError(Exception):
    """Raised when extraction fails or schema validation fails after retry."""
    pass


SYSTEM_PROMPT = """You are an expert procurement and tender analysis assistant for BidReady AI.
Your sole job is to extract requirements and metadata from tender documents with extreme precision.

CORE PRINCIPLES:
1. Extract and copy `source_quote` EXACTLY as it appears in the text, preserving wording.
2. Record `source_page` using the integer from the `[PAGE n]` header where the quote was found.
3. Convert all monetary amounts to raw float Indian Rupees (INR):
   - 1 lakh = 100,000 INR
   - 1 crore = 10,000,000 INR
   - Remove commas, currency symbols, and trailing '/-'.
4. Attach exemptions directly to the requirement they affect, even if the exemption clause appears on a different page. For example, if clause 3.1 on Page 3 exempts MSEs from the turnover requirement in clause 2.1 on Page 2 and from EMD on Page 1, add that Exemption to both the Turnover and EMD requirements.
5. NEVER evaluate supplier eligibility or compliance. Only extract what the tender requires.
6. Set `is_ambiguous = true` if a clause is vague, subjective, or open to interpretation.
7. Return valid JSON only, conforming strictly to the requested schema.

SCHEMA REFERENCE:
{
  "tender_number": string,
  "title": string,
  "estimated_cost": float or null,
  "bid_deadline": string (ISO 8601 datetime like "2026-11-30T15:00:00") or null,
  "requirements": [
    {
      "id": string (e.g. "req-emd", "req-turnover", etc.),
      "category": string (one of: "FINANCIAL_TURNOVER", "EXPERIENCE", "CERTIFICATE", "REGISTRATION", "EMD", "TENDER_FEE", "PERFORMANCE_SECURITY", "DEADLINE", "TECHNICAL", "OTHER"),
      "description": string,
      "is_mandatory": boolean,
      "is_ambiguous": boolean,
      "threshold_value": float or null,
      "threshold_unit": string or null (one of: "INR", "PERCENT", "YEARS", "COUNT"),
      "turnover_basis": string or null (one of: "AVERAGE_3Y", "ANY_ONE_YEAR", "LAST_FY", "UNSPECIFIED"),
      "lookback_years": integer or null,
      "document_type_needed": string or null (e.g. "GST Registration", "ISO 9001 Certificate", "Work Completion Certificate", etc.),
      "exemptions": [
        {
          "applies_to": string (e.g. "MSME", "STARTUP", "OTHER"),
          "effect": string ("WAIVED" or "RELAXED"),
          "relaxed_value": float or null,
          "proof_document_type": string or null (e.g. "Udyam Registration"),
          "condition_text": string,
          "source_quote": string,
          "source_page": integer
        }
      ],
      "source_quote": string,
      "source_page": integer
    }
  ]
}
"""


def _build_user_prompt(pages: List[PageText]) -> str:
    """Format extracted pages into tagged text blocks for the LLM prompt."""
    parts: List[str] = []
    for p in pages:
        parts.append(f"[PAGE {p.page}]\n{p.text.strip()}\n")
    return "\n".join(parts)


def _get_cache_key(all_page_text: str, model_name: str) -> str:
    """Compute sha256 digest of page text, model name, and prompt version."""
    payload = f"{all_page_text}|{model_name}|{PROMPT_VERSION}".encode("utf-8")
    return hashlib.sha256(payload).hexdigest()


def extract_requirements(
    pages: List[PageText],
    provider: LLMProvider,
    use_cache: bool = True,
    cache_dir: Optional[Path] = None,
) -> ExtractionResult:
    """Extract tender requirements using the given LLM provider.

    Args:
        pages: List of PageText objects from pdf_service.
        provider: An initialized LLMProvider (e.g. GeminiProvider or FakeProvider).
        use_cache: If True, check and populate disk cache.
        cache_dir: Optional directory to store cache files (defaults to CACHE_DIR).

    Returns:
        ExtractionResult validated against Pydantic schema.

    Raises:
        ExtractionError: If validation fails twice or extraction fails.
    """
    if not pages:
        raise ExtractionError("No pages provided for requirement extraction.")

    target_cache_dir = cache_dir or CACHE_DIR
    all_text = "\n".join(p.text for p in pages)
    model_name = getattr(provider, "model_name", "unknown")
    cache_key = _get_cache_key(all_text, model_name)
    cache_file = target_cache_dir / f"{cache_key}.json"

    # 1. Check disk cache
    if use_cache and cache_file.exists():
        try:
            logger.info("Extraction cache hit for key %s", cache_key)
            with open(cache_file, "r", encoding="utf-8") as f:
                cached_data = json.load(f)
            return ExtractionResult.model_validate(cached_data)
        except Exception as e:
            logger.warning("Failed to read cache file %s: %s. Re-running extraction.", cache_file, e)

    # 2. Build prompt and call provider
    user_prompt = _build_user_prompt(pages)

    try:
        raw_response = provider.generate_json(SYSTEM_PROMPT, user_prompt)
    except Exception as exc:
        raise ExtractionError(f"LLM provider failed to generate JSON: {exc}") from exc

    # 3. Validate with Pydantic; retry once on error
    try:
        result = ExtractionResult.model_validate(raw_response)
    except Exception as first_val_err:
        logger.warning(
            "Pydantic validation failed on first attempt: %s. Retrying once with error feedback...",
            first_val_err,
        )
        retry_prompt = (
            f"{user_prompt}\n\n"
            f"ERROR IN PREVIOUS OUTPUT:\n{first_val_err}\n"
            "Please fix the schema discrepancies and return strictly valid JSON matching the schema."
        )
        try:
            retry_response = provider.generate_json(SYSTEM_PROMPT, retry_prompt)
            result = ExtractionResult.model_validate(retry_response)
        except Exception as second_val_err:
            raise ExtractionError(
                f"Extraction validation failed after retry: {second_val_err}"
            ) from second_val_err

    # 4. Save to disk cache
    if use_cache:
        try:
            target_cache_dir.mkdir(parents=True, exist_ok=True)
            with open(cache_file, "w", encoding="utf-8") as f:
                json.dump(result.model_dump(), f, indent=2)
        except Exception as err:
            logger.warning("Could not write extraction cache to %s: %s", cache_file, err)

    return result

