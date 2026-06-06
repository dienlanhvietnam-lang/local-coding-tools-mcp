import fs from "node:fs";
import path from "node:path";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export type TodoStatus = "pending" | "in_progress" | "completed" | "cancelled";

export interface TodoItem {
  id: string;
  content: string;
  status: TodoStatus;
}

export interface TodoWriteInput {
  workspacePath: string;
  todos: TodoItem[];
  merge?: boolean;
}

export interface TodoReadInput {
  workspacePath: string;
}

export interface TodoOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  todos?: TodoItem[];
  count?: number;
  note?: string;
  error?: string;
}

const VALID_STATUS: TodoStatus[] = ["pending", "in_progress", "completed", "cancelled"];
const NOTE = "MCP-only session store (.mcp-debug/todos.json) — not shown in Cursor UI";

function todosPath(workspacePath: string): string {
  return path.join(workspacePath, ".mcp-debug", "todos.json");
}

function loadTodos(workspacePath: string): TodoItem[] {
  const file = todosPath(workspacePath);
  if (!fs.existsSync(file)) return [];
  try {
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(data?.todos) ? data.todos : [];
  } catch {
    return [];
  }
}

export async function todoWrite(input: TodoWriteInput): Promise<TodoOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }
  const workspacePath = validation.resolvedPath!;

  if (!Array.isArray(input.todos)) {
    return fail("todos must be an array", { workspacePath });
  }
  for (const t of input.todos) {
    if (!t.id || !t.content || !VALID_STATUS.includes(t.status)) {
      return fail(`Invalid todo item: ${JSON.stringify(t)}`, { workspacePath });
    }
  }

  let finalTodos: TodoItem[];
  if (input.merge) {
    const existing = loadTodos(workspacePath);
    const map = new Map(existing.map((t) => [t.id, t]));
    for (const t of input.todos) {
      map.set(t.id, { ...map.get(t.id), ...t });
    }
    finalTodos = [...map.values()];
  } else {
    finalTodos = input.todos;
  }

  try {
    const file = todosPath(workspacePath);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(file, JSON.stringify({ todos: finalTodos, updatedAt: new Date().toISOString() }, null, 2), "utf8");
    return pass({ workspacePath, todos: finalTodos, count: finalTodos.length, note: NOTE });
  } catch (err) {
    return fail(err instanceof Error ? err.message : String(err), { workspacePath });
  }
}

export async function todoRead(input: TodoReadInput): Promise<TodoOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) {
    return fail(validation.error ?? "Invalid workspace");
  }
  const workspacePath = validation.resolvedPath!;
  const todos = loadTodos(workspacePath);
  return pass({ workspacePath, todos, count: todos.length, note: NOTE });
}
