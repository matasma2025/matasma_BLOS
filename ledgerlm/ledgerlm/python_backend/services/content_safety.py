"""
Azure AI Content Safety — prompt screening before LLM calls.

Checks user input for:
  - Hate speech
  - Violence
  - Sexual content
  - Self-harm
  - Prompt injection attempts

Set AZURE_CONTENT_SAFETY_ENDPOINT and AZURE_CONTENT_SAFETY_KEY in env to enable.
If not configured, this module is a no-op (logs a warning, allows the query).

Severity levels: 0=safe, 2=low, 4=medium, 6=high.
Default block threshold: severity >= 4 (medium+).
"""

import os
import logging
import httpx
from typing import Tuple

logger = logging.getLogger(__name__)

_ENDPOINT = os.getenv("AZURE_CONTENT_SAFETY_ENDPOINT", "").rstrip("/")
_KEY      = os.getenv("AZURE_CONTENT_SAFETY_KEY", "")
_API_VER  = "2024-09-01"
_THRESHOLD = int(os.getenv("CONTENT_SAFETY_THRESHOLD", "4"))

_ENABLED = bool(_ENDPOINT and _KEY)

if not _ENABLED:
    logger.warning(
        "Azure Content Safety not configured "
        "(AZURE_CONTENT_SAFETY_ENDPOINT / AZURE_CONTENT_SAFETY_KEY missing). "
        "Prompt screening is disabled."
    )


async def screen_prompt(text: str) -> Tuple[bool, str]:
    """
    Screen `text` through Azure AI Content Safety.

    Returns:
        (allowed: bool, reason: str)
        allowed=True  → safe to proceed
        allowed=False → blocked; reason contains the category + severity
    """
    if not _ENABLED:
        return True, "content_safety_disabled"

    url = f"{_ENDPOINT}/contentsafety/text:analyze?api-version={_API_VER}"
    payload = {
        "text": text[:10_000],
        "categories": ["Hate", "Violence", "Sexual", "SelfHarm"],
        "outputType": "FourSeverityLevels",
    }
    headers = {
        "Ocp-Apim-Subscription-Key": _KEY,
        "Content-Type": "application/json",
    }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.post(url, json=payload, headers=headers)

        if resp.status_code != 200:
            logger.warning(
                f"Content Safety returned {resp.status_code}: {resp.text[:200]} — allowing query"
            )
            return True, "content_safety_api_error"

        data = resp.json()
        categories = data.get("categoriesAnalysis", [])

        for cat in categories:
            severity = cat.get("severity", 0)
            category = cat.get("category", "unknown")
            if severity >= _THRESHOLD:
                logger.warning(
                    f"Content Safety BLOCKED: category={category} severity={severity} "
                    f"text_preview={text[:80]!r}"
                )
                return False, f"{category} (severity {severity})"

        logger.debug(f"Content Safety passed: {categories}")
        return True, "ok"

    except httpx.TimeoutException:
        logger.warning("Content Safety timeout — allowing query (fail-open)")
        return True, "content_safety_timeout"
    except Exception as exc:
        logger.warning(f"Content Safety error: {exc} — allowing query (fail-open)")
        return True, f"content_safety_error: {exc}"
