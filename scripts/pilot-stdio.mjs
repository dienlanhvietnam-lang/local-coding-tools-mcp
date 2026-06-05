#!/usr/bin/env node
/**
 * Clean-machine stdio pilot: initialize, tools/list, check_system, run_coding_session.
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const SERVER = path.join(ROOT, "dist", "server.js");
const workspacePath = process.argv[2] ?? ROOT;

function parseToolResult(result) {
  const text = result?.content?.find((c) => c.type === "text")?.text ?? "{}";
  try {
    return JSON.parse(text);
  } catch {
    return { status: "FAIL", raw: text };
  }
}

const report = { initialize: "FAIL", toolsList: "FAIL", toolCount: 0, check_system: "FAIL", run_coding_session: "FAIL" };

let client;
try {
  const transport = new StdioClientTransport({
    command: process.execPath,
    args: [SERVER],
    cwd: ROOT,
  });

  client = new Client({ name: "pilot-stdio", version: "1.0.0" }, { capabilities: {} });
  await client.connect(transport);
  report.initialize = "PASS";

  const tools = await client.listTools();
  report.toolCount = tools.tools?.length ?? 0;
  report.toolsList = report.toolCount >= 27 ? "PASS" : "FAIL";
  report.toolNames = tools.tools?.map((t) => t.name);

  const cs = parseToolResult(await client.callTool({ name: "check_system", arguments: {} }));
  report.check_system = cs.status === "PASS" || cs.tools?.node?.ok ? "PASS" : "FAIL";
  report.check_systemDetail = cs;

  const rs = parseToolResult(
    await client.callTool({
      name: "run_coding_session",
      arguments: { workspacePath, runScript: true, collectBundle: false },
    }),
  );
  report.run_coding_session =
    rs.status === "PASS" || rs.status === "PARTIAL" ? "PASS" : "FAIL";
  report.run_coding_sessionDetail = rs;
} catch (err) {
  report.error = err instanceof Error ? err.message : String(err);
} finally {
  if (client) await client.close().catch(() => {});
}

console.log(JSON.stringify(report, null, 2));

const failed =
  report.initialize !== "PASS" ||
  report.toolsList !== "PASS" ||
  report.check_system !== "PASS" ||
  report.run_coding_session !== "PASS";

process.exit(failed ? 1 : 0);
