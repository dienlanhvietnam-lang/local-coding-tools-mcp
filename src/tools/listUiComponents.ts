import path from "node:path";
import fs from "node:fs";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export interface ListUiComponentsInput {
  workspacePath: string;
  scanDirs?: string[];
}

export interface UiComponentEntry {
  name: string;
  relativePath: string;
  hasStory: boolean;
  hasProps: boolean;
  exportKind: string;
}

export interface ListUiComponentsOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  components?: UiComponentEntry[];
  count?: number;
  duplicates?: string[];
  error?: string;
}

const PASCAL = /^[A-Z][a-zA-Z0-9]+$/;

function isComponentFile(name: string): boolean {
  const base = path.basename(name, path.extname(name));
  return PASCAL.test(base) && /\.(tsx|jsx|vue|svelte)$/.test(name);
}

export async function listUiComponents(
  input: ListUiComponentsInput
): Promise<ListUiComponentsOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const scanRoots = input.scanDirs ?? [
    "components",
    "src/components",
    "app/components",
    "packages/ui/src",
  ];

  const components: UiComponentEntry[] = [];
  const names = new Map<string, string[]>();

  function walk(dir: string): void {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name === "node_modules") continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (isComponentFile(entry.name)) {
        const rel = path.relative(workspacePath, full).replace(/\\/g, "/");
        const base = path.basename(entry.name, path.extname(entry.name));
        const content = fs.readFileSync(full, "utf8");
        const storyPath = rel.replace(/\.(tsx|jsx|vue)$/, ".stories.$1");
        const hasStory = fs.existsSync(path.join(workspacePath, storyPath));
        const hasProps = /interface\s+\w*Props|type\s+\w*Props/.test(content);
        const exportKind = /export\s+default/.test(content) ? "default" : "named";
        components.push({ name: base, relativePath: rel, hasStory, hasProps, exportKind });
        const list = names.get(base) ?? [];
        list.push(rel);
        names.set(base, list);
      }
    }
  }

  for (const root of scanRoots) {
    walk(path.join(workspacePath, root));
  }

  const duplicates = [...names.entries()]
    .filter(([, paths]) => paths.length > 1)
    .map(([name]) => name);

  return pass({
    workspacePath,
    components,
    count: components.length,
    duplicates,
  });
}
