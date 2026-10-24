import json
import os
import re

import httpx

from backend.app.services.llm.base import LLMProvider

URL = "https://api.groq.com/openai/v1/chat/completions"


class GroqProvider(LLMProvider):
    """Groq provider (OpenAI-compatible API)."""

    def __init__(self, model: str = "openai/gpt-oss-120b"):
        self.model_name = model
        self.key = os.getenv("GROQ_API_KEY")
        if not self.key:
            raise ValueError("GROQ_API_KEY is not set")

    def generate_json(self, system_prompt: str, user_prompt: str):
        body = {
            "model": self.model_name,
            "temperature": 0,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        headers = {"Authorization": "Bearer " + self.key}
        last = None
        for _ in range(2):
            r = httpx.post(URL, headers=headers, json=body, timeout=120)
            if r.status_code != 200:
                last = RuntimeError("Groq error %s: %s" % (r.status_code, r.text[:300]))
                continue
            text = r.json()["choices"][0]["message"]["content"].strip()
            text = re.sub(r"^```(?:json)?|```$", "", text, flags=re.M).strip()
            try:
                return json.loads(text)
            except ValueError as e:
                last = e
        raise last
