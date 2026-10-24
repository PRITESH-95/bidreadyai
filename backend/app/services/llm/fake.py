"""Fake LLM provider for tests and offline development.

Allows queueing arbitrary JSON dictionaries. When the queue is empty,
it falls back to loading backend/tests/fixtures/extraction_synthetic_tender.json.
"""

import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from backend.app.services.llm.base import LLMProvider

# Default path to synthetic tender extraction fixture
_DEFAULT_FIXTURE_PATH = (
    Path(__file__).resolve().parent.parent.parent.parent
    / "tests"
    / "fixtures"
    / "extraction_synthetic_tender.json"
)


class FakeProvider(LLMProvider):
    """Fake provider returning pre-configured or fixture JSON."""

    model_name: str = "fake"

    def __init__(self, fixture_path: Optional[Path | str] = None) -> None:
        """Initialize FakeProvider with an optional fixture path."""
        self.fixture_path = Path(fixture_path) if fixture_path else _DEFAULT_FIXTURE_PATH
        self.queue: List[Dict[str, Any]] = []
        self.call_count: int = 0
        self.history: List[Dict[str, str]] = []

    def queue_response(self, response: Dict[str, Any]) -> None:
        """Add a response dict to be returned on subsequent generate_json calls."""
        self.queue.append(response)

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Return the next queued response, or load from the default fixture."""
        self.call_count += 1
        self.history.append({
            "system_prompt": system_prompt,
            "user_prompt": user_prompt,
        })

        if self.queue:
            return self.queue.pop(0)

        # Fallback to loading the fixture file
        if not self.fixture_path.exists():
            raise FileNotFoundError(
                f"FakeProvider fixture not found at {self.fixture_path}. "
                "Ensure backend/tests/fixtures/extraction_synthetic_tender.json exists."
            )

        with open(self.fixture_path, "r", encoding="utf-8") as f:
            return json.load(f)

