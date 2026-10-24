"""Abstract base class for all LLM providers in BidReady AI.

Every provider implementation must inherit from LLMProvider and implement
generate_json(system_prompt, user_prompt) returning a Python dictionary.
"""

from abc import ABC, abstractmethod
from typing import Any, Dict


class LLMProvider(ABC):
    """Abstract interface for LLM communication."""

    model_name: str = "base"

    @abstractmethod
    def generate_json(self, system_prompt: str, user_prompt: str) -> Dict[str, Any]:
        """Send prompts to the LLM and receive a parsed JSON dictionary.

        Args:
            system_prompt: Guiding instructions / role definition.
            user_prompt: User content, such as document text.

        Returns:
            A parsed Python dictionary from the model's JSON output.

        Raises:
            Exception on network or model invocation failures.
        """
        pass

