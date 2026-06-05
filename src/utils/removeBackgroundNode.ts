import fs from "node:fs";
import path from "node:path";

/**
 * Remove background using @imgly/background-removal-node (pure Node, no Python).
 * First run may download ML model (~tens of MB).
 */
export async function removeBackgroundNode(
  inputPath: string,
  outputPath: string
): Promise<{ ok: boolean; error?: string }> {
  try {
    const mod = await import("@imgly/background-removal-node");
    const removeBackground = mod.removeBackground ?? mod.default?.removeBackground;
    if (typeof removeBackground !== "function") {
      return { ok: false, error: "@imgly/background-removal-node: removeBackground not found" };
    }

    const inputBytes = fs.readFileSync(inputPath);
    const blob = new Blob([inputBytes]);
    const result = await removeBackground(blob, {
      output: { format: "image/png", quality: 0.9 },
    });

    const buffer = Buffer.from(await result.arrayBuffer());
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, buffer);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
