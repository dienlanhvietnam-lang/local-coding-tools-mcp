/** Rough token estimate: ~4 characters per token for English/code. */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

export interface TokenCategory {
  id: string;
  estimatedTokens: number;
  characterCount: number;
}

/** Break a structured payload into per-top-level-key token categories. */
export function breakdownByCategory(payload: Record<string, unknown>): TokenCategory[] {
  const categories: TokenCategory[] = [];
  for (const [key, value] of Object.entries(payload)) {
    const text = typeof value === "string" ? value : JSON.stringify(value ?? "");
    categories.push({
      id: key,
      characterCount: text.length,
      estimatedTokens: estimateTokens(text),
    });
  }
  return categories.sort((a, b) => b.estimatedTokens - a.estimatedTokens);
}
