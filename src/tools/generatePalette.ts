import sharp from "sharp";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { resolveImageInput } from "../safety/imageGuard.js";
import { generatePaletteFromSeed } from "../utils/paletteGenerator.js";
import { pass, fail } from "../utils/result.js";

export interface GeneratePaletteInput {
  workspacePath: string;
  seedColor?: string;
  extractFromImage?: string;
}

export interface GeneratePaletteOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  seedColor?: string;
  light?: Array<{ name: string; hex: string }>;
  dark?: Array<{ name: string; hex: string }>;
  cssVariables?: string;
  tailwindExtend?: string;
  error?: string;
}

async function dominantColorFromImage(imagePath: string): Promise<string> {
  const { dominant } = await sharp(imagePath).stats();
  const r = Math.round(dominant.r).toString(16).padStart(2, "0");
  const g = Math.round(dominant.g).toString(16).padStart(2, "0");
  const b = Math.round(dominant.b).toString(16).padStart(2, "0");
  return `#${r}${g}${b}`;
}

export async function generatePalette(input: GeneratePaletteInput): Promise<GeneratePaletteOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  let seed = input.seedColor?.trim();

  if (!seed && input.extractFromImage?.trim()) {
    const resolved = resolveImageInput(workspacePath, input.extractFromImage.trim());
    if (!resolved.ok) return fail(resolved.error ?? "Invalid image");
    try {
      seed = await dominantColorFromImage(resolved.resolved!.fullPath);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return fail(message);
    }
  }

  if (!seed || !/^#[0-9a-fA-F]{6}$/.test(seed)) {
    return fail("Provide seedColor (#RRGGBB) or extractFromImage");
  }

  const palette = generatePaletteFromSeed(seed);
  return pass({
    workspacePath,
    seedColor: seed,
    light: palette.light,
    dark: palette.dark,
    cssVariables: palette.cssVariables,
    tailwindExtend: palette.tailwindExtend,
  });
}
