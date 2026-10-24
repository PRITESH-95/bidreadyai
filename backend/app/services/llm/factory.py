"""Factory for obtaining the active LLM provider based on application settings."""

from typing import Optional

from backend.app.config import settings
from backend.app.services.llm.base import LLMProvider
from backend.app.services.llm.fake import FakeProvider
from backend.app.services.llm.gemini import GeminiProvider
from backend.app.services.llm.groq import GroqProvider


def get_provider(provider_name: Optional[str] = None) -> LLMProvider:
    name = (provider_name or settings.LLM_PROVIDER).strip().lower()
    if name == "fake":
        return FakeProvider()
    elif name == "gemini":
        return GeminiProvider()
    elif name == "groq":
        return GroqProvider()
    raise ValueError("Unknown LLM_PROVIDER '%s'. Use 'groq', 'gemini' or 'fake'." % name)
