import os
from typing import Optional, Literal
import requests


def submit_feedback(
    run_id: str,
    score: Optional[Literal["thumbs_up", "thumbs_down"]] = None,
    text: Optional[str] = None,
    api_key: Optional[str] = None,
    endpoint: Optional[str] = None,
) -> bool:
    # Validate inputs
    if not score and not text:
        raise ValueError(
            "[TCC] Cannot submit feedback: at least one of 'score' or 'text' must be provided"
        )

    if text and len(text) > 2000:
        raise ValueError(
            f"[TCC] Cannot submit feedback: text length ({len(text)}) exceeds maximum of 2000 characters"
        )

    # Get API key
    resolved_api_key = api_key or os.getenv("TCC_API_KEY")
    if not resolved_api_key:
        print("[TCC] Cannot submit feedback: TCC_API_KEY environment variable is not set")
        return False

    # Get endpoint
    from .config import get_url
    feedback_url = (
        endpoint
        or os.getenv("TCC_FEEDBACK_URL")
        or get_url(
            "https://api.thecontext.company/v1/feedback",
            "https://dev.thecontext.company/v1/feedback",
        )
    )

    # Prepare request
    payload: dict = {"runId": run_id}
    if score:
        payload["score"] = score
    if text:
        payload["text"] = text

    try:
        response = requests.post(
            feedback_url,
            json=payload,
            headers={
                "Content-Type": "application/json",
                "Authorization": f"Bearer {resolved_api_key}",
            },
            timeout=10,
        )

        if not response.ok:
            print(
                f"[TCC] Failed to submit feedback: {response.status_code} {response.text}"
            )
            return False

        return True

    except requests.exceptions.RequestException as e:
        print(f"[TCC] Failed to submit feedback: {e}")
        return False
