import fs from "node:fs";
import path from "node:path";
import { validateWorkspacePath } from "../safety/pathGuard.js";

const MEMORY_REL = ".mcp-debug/project-memory.json";
const MAX_LESSONS = 40;
const MAX_FAILURES = 50;
const MAX_CONVENTIONS = 30;
const MAX_KEY_FILES = 40;

export interface ProjectLesson {
  at: string;
  lesson: string;
  task?: string;
  relatedFiles?: string[];
}

export interface ProjectFailure {
  at: string;
  tool: string;
  error: string;
  context?: string;
  doNotRetry?: boolean;
}

export interface KeyFilePin {
  path: string;
  reason: string;
  at: string;
}

export interface ProjectMemory {
  conventions: string[];
  lessons: ProjectLesson[];
  failedAttempts: ProjectFailure[];
  keyFiles: KeyFilePin[];
  updatedAt: string;
}

function emptyMemory(): ProjectMemory {
  return {
    conventions: [],
    lessons: [],
    failedAttempts: [],
    keyFiles: [],
    updatedAt: new Date().toISOString(),
  };
}

function resolveMemoryPath(workspacePath: string): string | null {
  const validation = validateWorkspacePath(workspacePath);
  if (!validation.ok) return null;
  return path.join(validation.resolvedPath!, ".mcp-debug", "project-memory.json");
}

export function loadProjectMemory(workspacePath: string): ProjectMemory {
  const p = resolveMemoryPath(workspacePath);
  if (!p || !fs.existsSync(p)) return emptyMemory();
  try {
    const parsed = JSON.parse(fs.readFileSync(p, "utf8")) as Partial<ProjectMemory>;
    return {
      conventions: parsed.conventions ?? [],
      lessons: parsed.lessons ?? [],
      failedAttempts: parsed.failedAttempts ?? [],
      keyFiles: parsed.keyFiles ?? [],
      updatedAt: parsed.updatedAt ?? new Date().toISOString(),
    };
  } catch {
    return emptyMemory();
  }
}

function saveProjectMemory(workspacePath: string, memory: ProjectMemory): boolean {
  const p = resolveMemoryPath(workspacePath);
  if (!p) return false;
  try {
    memory.updatedAt = new Date().toISOString();
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, JSON.stringify(memory, null, 2), "utf8");
    return true;
  } catch {
    return false;
  }
}

export function appendLesson(
  workspacePath: string,
  entry: { lesson: string; task?: string; relatedFiles?: string[] }
): ProjectMemory {
  const memory = loadProjectMemory(workspacePath);
  memory.lessons.unshift({
    at: new Date().toISOString(),
    lesson: entry.lesson.trim(),
    task: entry.task?.trim(),
    relatedFiles: entry.relatedFiles?.filter(Boolean),
  });
  memory.lessons = memory.lessons.slice(0, MAX_LESSONS);
  saveProjectMemory(workspacePath, memory);
  return memory;
}

export function appendFailure(
  workspacePath: string,
  entry: { tool: string; error: string; context?: string; doNotRetry?: boolean }
): ProjectMemory {
  const memory = loadProjectMemory(workspacePath);
  const error = entry.error.trim().slice(0, 500);
  const dup = memory.failedAttempts.find(
    (f) => f.tool === entry.tool && f.error === error
  );
  if (!dup) {
    memory.failedAttempts.unshift({
      at: new Date().toISOString(),
      tool: entry.tool,
      error,
      context: entry.context?.trim().slice(0, 300),
      doNotRetry: entry.doNotRetry ?? true,
    });
    memory.failedAttempts = memory.failedAttempts.slice(0, MAX_FAILURES);
    saveProjectMemory(workspacePath, memory);
  }
  return memory;
}

export function addConvention(workspacePath: string, text: string): ProjectMemory {
  const memory = loadProjectMemory(workspacePath);
  const t = text.trim();
  if (t && !memory.conventions.includes(t)) {
    memory.conventions.unshift(t);
    memory.conventions = memory.conventions.slice(0, MAX_CONVENTIONS);
    saveProjectMemory(workspacePath, memory);
  }
  return memory;
}

export function pinKeyFile(
  workspacePath: string,
  entry: { path: string; reason: string }
): ProjectMemory {
  const memory = loadProjectMemory(workspacePath);
  const rel = entry.path.trim().replace(/\\/g, "/");
  memory.keyFiles = memory.keyFiles.filter((k) => k.path !== rel);
  memory.keyFiles.unshift({
    path: rel,
    reason: entry.reason.trim(),
    at: new Date().toISOString(),
  });
  memory.keyFiles = memory.keyFiles.slice(0, MAX_KEY_FILES);
  saveProjectMemory(workspacePath, memory);
  return memory;
}

export function clearProjectMemory(workspacePath: string): boolean {
  const p = resolveMemoryPath(workspacePath);
  if (!p) return false;
  try {
    if (fs.existsSync(p)) fs.unlinkSync(p);
    return true;
  } catch {
    return false;
  }
}

export function getProjectMemorySummary(workspacePath: string) {
  const m = loadProjectMemory(workspacePath);
  return {
    conventionCount: m.conventions.length,
    lessonCount: m.lessons.length,
    failureCount: m.failedAttempts.length,
    keyFileCount: m.keyFiles.length,
    updatedAt: m.updatedAt,
  };
}

export const PROJECT_MEMORY_REL = MEMORY_REL;
