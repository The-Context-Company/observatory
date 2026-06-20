import re

_SECRET_ASSIGNMENT_PATTERN = re.compile(
    r"\b(api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|secret|password|passwd|pwd|authorization|bearer)\b\s*[:=]\s*([^\s\"',;})\]]+)\]?",
    re.IGNORECASE,
)

_SECRET_VALUE_PATTERNS = [
    re.compile(r"\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b"),
    re.compile(r"\bxox[abprs]-[A-Za-z0-9-]{16,}\b"),
    re.compile(r"\bgh[pousr]_[A-Za-z0-9_]{16,}\b"),
    re.compile(r"\bservice_[A-Za-z0-9_-]{16,}\b"),
]


def redact_status_message(message: str) -> str:
    redacted = re.sub(
        r"\bAuthorization\s*[:=]\s*Bearer\s+([^\s\"',;})\]]+)\]?",
        "Authorization=[REDACTED]",
        message,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(
        r"\bAuthorization\s*[:=]\s*Basic\s+([A-Za-z0-9+/=]{12,})\]?",
        "Authorization=[REDACTED]",
        redacted,
        flags=re.IGNORECASE,
    )
    redacted = re.sub(r"\bBearer\s+([^\s\"',;})\]]+)\]?", "Bearer [REDACTED]", redacted, flags=re.IGNORECASE)
    redacted = re.sub(r"\bBasic\s+([A-Za-z0-9+/=]{12,})\]?", "Basic [REDACTED]", redacted, flags=re.IGNORECASE)
    redacted = _SECRET_ASSIGNMENT_PATTERN.sub(lambda match: f"{match.group(1)}=[REDACTED]", redacted)
    redacted = re.sub(r"https?://([^/\s:@]+):([^@\s/]+)@", r"https://\1:[REDACTED]@", redacted, flags=re.IGNORECASE)

    for pattern in _SECRET_VALUE_PATTERNS:
        redacted = pattern.sub("[REDACTED]", redacted)

    return redacted
