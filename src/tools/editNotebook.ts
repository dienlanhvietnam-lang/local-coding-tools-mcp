import fs from "node:fs";
import { assertWithinWorkspace, validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export type NotebookOp = "replace" | "insert" | "delete";

export interface EditNotebookInput {
  workspacePath: string;
  relativePath: string;
  operation: NotebookOp;
  cellIndex: number;
  cellType?: "code" | "markdown";
  source?: string;
}

export interface EditNotebookOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  relativePath?: string;
  operation?: string;
  cellIndex?: number;
  cellCount?: number;
  error?: string;
}

interface NotebookCell {
  cell_type: string;
  metadata: Record<string, unknown>;
  source: string[];
  outputs?: unknown[];
  execution_count?: number | null;
}

function toSourceLines(text: string): string[] {
  const lines = text.split(/(?<=\n)/);
  return lines.length ? lines : [""];
}

export async function editNotebook(input: EditNotebookInput): Promise<EditNotebookOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }

  const workspacePath = validation.resolvedPath!;
  const relativePath = input.relativePath.replace(/\\/g, "/");

  if (!relativePath.endsWith(".ipynb")) {
    return fail("File must be a .ipynb notebook", { workspacePath, relativePath });
  }

  try {
    const fullPath = assertWithinWorkspace(workspacePath, relativePath);
    if (!fs.existsSync(fullPath)) {
      return fail("Notebook does not exist", { workspacePath, relativePath });
    }

    const nb = JSON.parse(fs.readFileSync(fullPath, "utf8")) as {
      cells?: NotebookCell[];
      [k: string]: unknown;
    };
    if (!Array.isArray(nb.cells)) {
      return fail("Invalid notebook: missing cells array", { workspacePath, relativePath });
    }

    const idx = input.cellIndex;

    if (input.operation === "delete") {
      if (idx < 0 || idx >= nb.cells.length) {
        return fail(`cellIndex ${idx} out of range (0..${nb.cells.length - 1})`, { workspacePath, relativePath });
      }
      nb.cells.splice(idx, 1);
    } else if (input.operation === "replace") {
      if (idx < 0 || idx >= nb.cells.length) {
        return fail(`cellIndex ${idx} out of range (0..${nb.cells.length - 1})`, { workspacePath, relativePath });
      }
      if (input.source === undefined) {
        return fail("source is required for replace", { workspacePath, relativePath });
      }
      nb.cells[idx].source = toSourceLines(input.source);
      if (input.cellType) nb.cells[idx].cell_type = input.cellType;
    } else if (input.operation === "insert") {
      if (input.source === undefined) {
        return fail("source is required for insert", { workspacePath, relativePath });
      }
      const cellType = input.cellType ?? "code";
      const newCell: NotebookCell = {
        cell_type: cellType,
        metadata: {},
        source: toSourceLines(input.source),
        ...(cellType === "code" ? { outputs: [], execution_count: null } : {}),
      };
      const insertAt = Math.max(0, Math.min(idx, nb.cells.length));
      nb.cells.splice(insertAt, 0, newCell);
    } else {
      return fail(`Unknown operation ${input.operation}`, { workspacePath, relativePath });
    }

    fs.writeFileSync(fullPath, JSON.stringify(nb, null, 1) + "\n", "utf8");

    return pass({
      workspacePath,
      relativePath,
      operation: input.operation,
      cellIndex: idx,
      cellCount: nb.cells.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return fail(message, { workspacePath, relativePath });
  }
}
