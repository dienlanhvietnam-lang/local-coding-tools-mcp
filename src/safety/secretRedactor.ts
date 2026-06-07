const SECRET_PATTERNS: RegExp[] = [
  /VSCE_PAT\s*[=:]\s*['"]?[A-Za-z0-9._-]{8,}/gi,
  /\bvso[a-z0-9]{20,}\b/gi,
  /\bpat_[A-Za-z0-9._-]{8,}\b/gi,
  /\bBearer\s+[A-Za-z0-9._~+/=-]{8,}/gi,
  /authorization\s*[=:]\s*['"]?[A-Za-z0-9._~+/=-]{8,}/gi,
  /token\s*[=:]\s*['"]?[A-Za-z0-9._-]{12,}/gi,
  /github_pat_[A-Za-z0-9_]{20,}/gi,
  /ghp_[A-Za-z0-9]{20,}/gi,
  /sk-[A-Za-z0-9]{20,}/gi,
  /--pat\s+['"]?[A-Za-z0-9._-]{8,}/gi,
];

const REDACTED = "[REDACTED]";

export function containsSecretPatterns(text: string): boolean {
  return SECRET_PATTERNS.some((re) => {
    re.lastIndex = 0;
    return re.test(text);
  });
}

export function redactSecrets(text: string): string {
  if (!text) return text;
  let out = text;
  for (const re of SECRET_PATTERNS) {
    re.lastIndex = 0;
    out = out.replace(re, REDACTED);
  }
  if (process.env.VSCE_PAT?.trim()) {
    out = out.split(process.env.VSCE_PAT).join(REDACTED);
  }
  return out;
}

/** Redact .env-style lines — keys preserved, values replaced. */
export function redactEnvContent(content: string): string {
  return content
    .split(/\r?\n/)
    .map((line) => {
      const m = line.match(/^(\s*[#;]?\s*[\w.-]+)\s*=\s*(.*)$/);
      if (!m) return line;
      const key = m[1]!;
      const val = m[2] ?? "";
      if (/secret|token|password|pat|key|auth/i.test(key) || containsSecretPatterns(val)) {
        return `${key}=${REDACTED}`;
      }
      return line;
    })
    .join("\n");
}
