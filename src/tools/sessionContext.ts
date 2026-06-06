import { loadSession, clearSession } from "../session/contextBank.js";
import { pass, fail } from "../utils/result.js";

export interface GetSessionContextInput {
  workspacePath: string;
}

export async function getSessionContext(input: GetSessionContextInput) {
  const session = loadSession(input.workspacePath);
  const pendingCacheRefs = session.toolSummaries
    .filter((s) => s.cacheRef)
    .map((s) => ({ tool: s.tool, cacheRef: s.cacheRef, at: s.at }));

  return pass({
    workspacePath: input.workspacePath,
    sessionId: session.sessionId,
    recentSearches: session.lastSearches,
    recentReads: session.lastReads,
    pendingCacheRefs,
    updatedAt: session.updatedAt,
    hint: "Avoid re-running identical searches or re-reading files already listed in recentReads.",
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
