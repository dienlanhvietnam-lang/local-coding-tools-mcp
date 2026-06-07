import { validateWorkspacePath } from "../safety/pathGuard.js";
import { getPatternSuggestions, normalizeProductType, type Tone } from "../data/devgolPatterns.js";
import { pass, fail } from "../utils/result.js";

export interface SuggestUiPatternInput {
  workspacePath: string;
  productType?: string;
  tone?: Tone;
}

export interface SuggestUiPatternOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  productType?: string;
  suggestions?: Array<{
    tone: string;
    title: string;
    description: string;
    components: string[];
    benchmark: string;
  }>;
  note?: string;
  error?: string;
}

export async function suggestUiPattern(
  input: SuggestUiPatternInput
): Promise<SuggestUiPatternOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const productType = normalizeProductType(input.productType);
  const suggestions = getPatternSuggestions(productType, input.tone);

  return pass({
    workspacePath,
    productType,
    suggestions,
    note: "Chọn một hướng trước khi code — không implement cả 3 cùng lúc.",
  });
}
