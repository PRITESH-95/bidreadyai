"""CLI demo script to extract and display requirements from a tender PDF.

Usage:
    python -m backend.app.scripts.extract_demo <pdf_path>

Example:
    python -m backend.app.scripts.extract_demo backend/tests/fixtures/synthetic_tender.pdf
"""

import sys
from pathlib import Path

from backend.app.services.extraction_service import extract_requirements
from backend.app.services.llm.factory import get_provider
from backend.app.services.pdf_service import extract_pages


def main() -> None:
    if len(sys.argv) < 2:
        print("Usage: python -m backend.app.scripts.extract_demo <path_to_pdf>")
        sys.exit(1)

    pdf_path = Path(sys.argv[1])
    if not pdf_path.exists():
        print(f"Error: file not found: {pdf_path}")
        sys.exit(1)

    print(f"Reading PDF: {pdf_path}")
    pages = extract_pages(pdf_path)
    print(f"Extracted {len(pages)} page(s). Calling LLM provider...")

    provider = get_provider()
    result = extract_requirements(pages, provider)

    print("\n" + "=" * 75)
    print(f"Tender No:    {result.tender_number}")
    print(f"Title:        {result.title}")
    cost_str = f"Rs. {result.estimated_cost:,.2f}" if result.estimated_cost else "N/A"
    print(f"Est. Cost:    {cost_str}")
    print(f"Bid Deadline: {result.bid_deadline or 'N/A'}")
    print("=" * 75 + "\n")

    # Table headers
    headers = ["ID", "CATEGORY", "MANDATORY", "THRESHOLD", "EXEMPTIONS", "PAGE"]
    col_fmt = "{:<25} {:<22} {:<10} {:<18} {:<12} {:<6}"

    print(col_fmt.format(*headers))
    print("-" * 98)

    for req in result.requirements:
        # Format threshold string with unit
        if req.threshold_value is not None:
            unit = req.threshold_unit.value if req.threshold_unit else ""
            if unit == "INR":
                thresh_str = f"Rs. {req.threshold_value:,.0f}"
            elif unit == "PERCENT":
                thresh_str = f"{req.threshold_value}%"
            else:
                thresh_str = f"{req.threshold_value} {unit}".strip()
        else:
            thresh_str = "-"

        mandatory_str = "Yes" if req.is_mandatory else "No"
        exemptions_count = len(req.exemptions)

        print(
            col_fmt.format(
                req.id[:24],
                req.category.value[:21],
                mandatory_str,
                thresh_str[:17],
                str(exemptions_count),
                str(req.source_page),
            )
        )

    print("-" * 98)
    print(f"Total requirements extracted: {len(result.requirements)}")


if __name__ == "__main__":
    main()

