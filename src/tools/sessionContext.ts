import { loadSession, clearSession } from "../session/contextBank.js";
import { getProjectMemorySummary } from "../session/projectMemory.js";
import { pass, fail } from "../utils/result.js";

export interface GetSessionContextInput {
  workspacePath: string;
}

export async function getSessionContext(input: GetSessionContextInput) {
  const session = loadSession(input.workspacePath);
  const pendingCacheRefs = session.toolSummaries
    .filter((s) => s.cacheRef)
    .map((s) => ({ tool: s.tool, cacheRef: s.cacheRef, at: s.at }));

  const memorySummary = getProjectMemorySummary(input.workspacePath);

  return pass({
    workspacePath: input.workspacePath,
    sessionId: session.sessionId,
    recentSearches: session.lastSearches,
    recentReads: session.lastReads,
    recentFailures: session.recentFailures,
    pendingCacheRefs,
    projectMemory: memorySummary,
    updatedAt: session.updatedAt,
    hint:
      "MEMORY_LOOP: read_project_memory before work; avoid re-reads in recentReads; check recentFailures and failedAttempts before retrying.",
  });
}

export interface ClearSessionContextInput {
  workspacePath: string;
}

export async function clearSessionContext(input: ClearSessionContextInput) {
  const ok = clearSession(input.workspacePath);
  if (!ok) {
    return fail("Could not clear session (invalid workspace or no session file)", {
      workspacePath: input.workspacePath,
    });
  }
  return pass({ workspacePath: input.workspacePath, cleared: true });
}
