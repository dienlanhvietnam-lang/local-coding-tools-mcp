import { validateWorkspacePath } from "../safety/pathGuard.js";
import {
  appendLesson,
  appendFailure,
  addConvention,
  pinKeyFile,
  clearProjectMemory,
  loadProjectMemory,
  PROJECT_MEMORY_REL,
} from "../session/projectMemory.js";
import { pass, fail } from "../utils/result.js";

export type ProjectMemoryAction =
  | "append_lesson"
  | "append_failure"
  | "add_convention"
  | "pin_key_file"
  | "clear";

export interface WriteProjectMemoryInput {
  workspacePath: string;
  action: ProjectMemoryAction;
  lesson?: string;
  task?: string;
  relatedFiles?: string[];
  tool?: string;
  error?: string;
  context?: string;
  doNotRetry?: boolean;
  convention?: string;
  keyFilePath?: string;
  keyFileReason?: string;
}

export async function writeProjectMemory(input: WriteProjectMemoryInput) {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;

  switch (input.action) {
    case "append_lesson": {
      if (!input.lesson?.trim()) return fail("lesson is required for append_lesson");
      const memory = appendLesson(workspacePath, {
        lesson: input.lesson,
        task: input.task,
        relatedFiles: input.relatedFiles,
      });
      return pass({
        workspacePath,
        action: input.action,
        storagePath: PROJECT_MEMORY_REL,
        lessonCount: memory.lessons.length,
      });
    }
    case "append_failure": {
      if (!input.tool?.trim() || !input.error?.trim()) {
        return fail("tool and error are required for append_failure");
      }
      const memory = appendFailure(workspacePath, {
        tool: input.tool,
        error: input.error,
        context: input.context,
        doNotRetry: input.doNotRetry,
      });
      return pass({
        workspacePath,
        action: input.action,
        storagePath: PROJECT_MEMORY_REL,
        failureCount: memory.failedAttempts.length,
      });
    }
    case "add_convention": {
      if (!input.convention?.trim()) return fail("convention is required");
      const memory = addConvention(workspacePath, input.convention);
      return pass({
        workspacePath,
        action: input.action,
        conventionCount: memory.conventions.length,
      });
    }
    case "pin_key_file": {
      if (!input.keyFilePath?.trim() || !input.keyFileReason?.trim()) {
        return fail("keyFilePath and keyFileReason are required");
      }
      const memory = pinKeyFile(workspacePath, {
        path: input.keyFilePath,
        reason: input.keyFileReason,
      });
      return pass({
        workspacePath,
        action: input.action,
        keyFileCount: memory.keyFiles.length,
      });
    }
    case "clear": {
      const ok = clearProjectMemory(workspacePath);
      if (!ok) return fail("Could not clear project memory");
      return pass({ workspacePath, action: input.action, cleared: true });
    }
    default:
      return fail(`Unknown action: ${input.action as string}`);
  }
}
