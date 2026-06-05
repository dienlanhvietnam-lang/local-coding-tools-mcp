const SECRET_PATTERNS: Array<{ pattern: RegExp; replacement: string }> = [
  { pattern: /\bsk-[A-Za-z0-9_-]{8,}\b/g, replacement: "sk-[REDACTED]" },
  { pattern: /\bBearer\s+[A-Za-z0-9._~+/=-]+\b/gi, replacement: "Bearer [REDACTED]" },
  { pattern: /\bapi[_-]?key\s*[=:]\s*[^\s&'"`,]+/gi, replacement: "api_key=[REDACTED]" },
  { pattern: /\btoken\s*[=:]\s*[^\s&'"`,]+/gi, replacement: "token=[REDACTED]" },
  { pattern: /\bpassword\s*[=:]\s*[^\s&'"`,]+/gi, replacement: "password=[REDACTED]" },
  { pattern: /\bauthorization\s*:\s*[^\r\n]+/gi, replacement: "authorization: [REDACTED]" },
  { pattern: /\bcookie\s*:\s*[^\r\n]+/gi, replacement: "cookie: [REDACTED]" },
  { pattern: /\bsecret\s*[=:]\s*[^\s&'"`,]+/gi, replacement: "secret=[REDACTED]" },
  { pattern: /\bAWS_[A-Z0-9_]+\s*[=:]\s*[^\s&'"`,]+/g, replacement: "AWS_[REDACTED]" },
];

/**
 * Replace common secret patterns in text before returning to the client.
 */
export function redactSecrets(text: string): string {
  let result = text;
  for (const { pattern, replacement } of SECRET_PATTERNS) {
    result = result.replace(pattern, replacement);
  }
  return result;
}

/**
 * Redact values in .env-style lines while preserving keys for diagnostics.
 */
export function redactEnvContent(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return line;
      const eq = line.indexOf("=");
      if (eq === -1) return line;
      const key = line.slice(0, eq);
      return `${key}=[REDACTED]`;
    })
    .join("\n");
}
