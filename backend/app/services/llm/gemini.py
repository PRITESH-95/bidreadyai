"""Gemini LLM Provider using the official google-genai SDK.

Configured with JSON output mode, model from config/settings, request timeout,
and one retry on network errors.
"""

import json
import logging
import time
from typing import Any, Dict, Optional

from backend.app.config import settings
from backend.app.services.llm.base import LLMProvider

logger = logging.getLogger(__name__)


class GeminiProvider(LLMProvider):
    """LLM Provider backed by Google Gemini via google-genai SDK."""

    def __init__(
        self,
        api_key: Optional[str] = None,
        model_name: Optional[str] = None,
        timeout_seconds: float = 60.0,
    ) -> None:
        """Initialize the GeminiProvider.

        Args:
            api_key: Gemini API key. Defaults to settings.GEMINI_API_KEY.
            model_name: Gemini model name. Defaults to settings.GEMINI_MODEL.
            timeout_seconds: Request timeout in seconds.
        """
        self.api_key = api_key or settings.GEMINI_API_KEY
        self.model_name = model_name or settings.GEMINI_MODEL
        self.timeout_seconds = timeout_seconds

        # Lazy check for google-genai package so tests don't break if not installed
        try:
            from google import genai
            from google.genai import types

            self._genai = genai
            self._types = types
            # Initialize client with timeout options
            # http_options timeout can be specified in milliseconds or float seconds
            self.client = genai.Client(
                api_key=self.api_key,
                http_options=types.HttpOptions(timeout=int(self.timeout_seconds * 1000)),
            )
        except ImportError as e:
            self._genai = None
            self._types = None
            self.client = None
            self._import_error = e

    def _call_api(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Make a single call to Gemini with JSON output configuration."""
        if self.client is None:
            raise ImportError(
                "google-genai is not installed or client initialization failed. "
                "Please install google-genai: pip install google-genai"
            )

        config = self._types.GenerateContentConfig(
            system_instruction=system_prompt,
            response_mime_type="application/json",
        )

        response = self.client.models.generate_content(
            model=self.model_name,
            contents=user_prompt,
            config=config,
        )

        # Parse the JSON string from the response
        text = response.text or "{}"
        return json.loads(text)

    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Generate a JSON response from Gemini with one retry on network error."""
        try:
            return self._call_api(system_prompt, user_prompt)
        except Exception as first_err:
            logger.warning(
                "First attempt to call Gemini failed with %s: %s. Retrying once...",
                type(first_err).__name__,
                first_err,
            )
            time.sleep(1.0)
            try:
                return self._call_api(system_prompt, user_prompt)
            except Exception as second_err:
                logger.error(
                    "Retry to call Gemini failed with %s: %s",
                    type(second_err).__name__,
                    second_err,
                )
                raise second_err

