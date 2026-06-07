import { validateWorkspacePath } from "../safety/pathGuard.js";
import { loadProjectMemory, PROJECT_MEMORY_REL } from "../session/projectMemory.js";
import { pass, fail } from "../utils/result.js";

export interface ReadProjectMemoryInput {
  workspacePath: string;
  maxLessons?: number;
  maxFailures?: number;
}

export async function readProjectMemory(input: ReadProjectMemoryInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const memory = loadProjectMemory(workspacePath);
  const maxL = Math.min(Math.max(input.maxLessons ?? 15, 1), 40);
  const maxF = Math.min(Math.max(input.maxFailures ?? 15, 1), 50);

  return pass({
    workspacePath,
    storagePath: PROJECT_MEMORY_REL,
    conventions: memory.conventions,
    lessons: memory.lessons.slice(0, maxL),
    failedAttempts: memory.failedAttempts.slice(0, maxF),
    keyFiles: memory.keyFiles,
    counts: {
      conventions: memory.conventions.length,
      lessons: memory.lessons.length,
      failedAttempts: memory.failedAttempts.length,
      keyFiles: memory.keyFiles.length,
    },
    updatedAt: memory.updatedAt,
    hint: "Check failedAttempts.doNotRetry before repeating a tool approach. Use keyFiles before broad search.",
  });
}
