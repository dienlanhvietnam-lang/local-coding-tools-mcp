import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { validateWorkspacePath } from "../safety/pathGuard.js";
import { pass, fail } from "../utils/result.js";

export type DevgolTopic = "scorecard" | "benchmark" | "patterns" | "trend";

export interface ReadDevgolGuideInput {
  workspacePath: string;
  topic: DevgolTopic;
  productType?: string;
}

export interface ReadDevgolGuideOutput {
  status: "PASS" | "FAIL";
  workspacePath?: string;
  topic?: string;
  source?: string;
  content?: string;
  error?: string;
}

const TOPIC_FILES: Record<DevgolTopic, string> = {
  scorecard: "DEV_GOL_SCORECARD.md",
  benchmark: "DEV_GOL_BENCHMARK_SELECTOR.md",
  patterns: "DEV_GOL_APPROVED_PATTERNS.md",
  trend: "DEV_GOL_TREND_RADAR.md",
};

const PATTERN_MAP: Record<string, string> = {
  web: "patterns/WEB_SAAS.md",
  saas: "patterns/WEB_SAAS.md",
  dashboard: "patterns/DASHBOARD.md",
  mobile: "patterns/MOBILE.md",
};

function bundledDevgolRoot(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "../../templates/devgol");
}

function readFirstExisting(paths: string[]): { content: string; source: string } | null {
  for (const p of paths) {
    if (fs.existsSync(p)) {
      return { content: fs.readFileSync(p, "utf8"), source: p };
    }
  }
  return null;
}

export async function readDevgolGuide(input: ReadDevgolGuideInput): Promise<ReadDevgolGuideOutput> {
  const validation = validateWorkspacePath(input.workspacePath);
  if (!validation.ok) return fail(validation.error ?? "Invalid workspace");

  const workspacePath = validation.resolvedPath!;
  const topic = input.topic;
  const bundled = bundledDevgolRoot();
  const wsDocs = path.join(workspacePath, "docs", "devgol-uiux");

  const candidates = [
    path.join(wsDocs, TOPIC_FILES[topic]),
    path.join(bundled, TOPIC_FILES[topic]),
  ];

  if (topic === "patterns" && input.productType) {
    const pt = input.productType.toLowerCase();
    const patternFile = PATTERN_MAP[pt];
    if (patternFile) {
      candidates.unshift(path.join(wsDocs, patternFile), path.join(bundled, patternFile));
    }
  }

  const found = readFirstExisting(candidates);
  if (!found) {
    return fail(`DEV GOL guide not found for topic: ${topic}`, { workspacePath, topic });
  }

  return pass({
    workspacePath,
    topic,
    source: found.source,
    content: found.content.slice(0, 32000),
  });
}
