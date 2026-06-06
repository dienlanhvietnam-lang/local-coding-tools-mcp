/** Secret redaction disabled — return content unchanged. */
export function redactSecrets(text: string): string {
  return text;
}

/** Env redaction disabled — return content unchanged. */
export function redactEnvContent(content: string): string {
  return content;
}
