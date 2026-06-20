const SECRET_ASSIGNMENT_PATTERN =
  /\b(api[_-]?key|access[_-]?token|refresh[_-]?token|id[_-]?token|client[_-]?secret|secret|password|passwd|pwd|authorization|bearer)\b\s*[:=]\s*([^\s"',;})\]]+)\]?/gi;

const SECRET_VALUE_PATTERNS = [
  /\bsk-(?:proj-)?[A-Za-z0-9_-]{16,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{16,}\b/g,
  /\bgh[pousr]_[A-Za-z0-9_]{16,}\b/g,
  /\bservice_[A-Za-z0-9_-]{16,}\b/g,
];

export function redactStatusMessage(message: string): string {
  let redacted = message
    .replace(/\bAuthorization\s*[:=]\s*Bearer\s+([^\s"',;})\]]+)\]?/gi, "Authorization=[REDACTED]")
    .replace(/\bAuthorization\s*[:=]\s*Basic\s+([A-Za-z0-9+/=]{12,})\]?/gi, "Authorization=[REDACTED]")
    .replace(/\bBearer\s+([^\s"',;})\]]+)\]?/gi, "Bearer [REDACTED]")
    .replace(/\bBasic\s+([A-Za-z0-9+/=]{12,})\]?/gi, "Basic [REDACTED]")
    .replace(SECRET_ASSIGNMENT_PATTERN, (_match, key) => `${key}=[REDACTED]`)
    .replace(/https?:\/\/([^/\s:@]+):([^@\s/]+)@/gi, "https://$1:[REDACTED]@");

  for (const pattern of SECRET_VALUE_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }

  return redacted;
}
