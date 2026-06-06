/**
 * Mirrors Cursor's agent-transcript context-stripping: removes heavy XML-like
 * context blocks that are noise inside tool output (instructions, environment,
 * git status, etc.) before the text is returned to the model.
 */
const STRIP_TAGS = [
  "user_info",
  "project_layout",
  "rules",
  "user_rules",
  "agent_skills",
  "available_skills",
  "open_and_recently_viewed_files",
  "system_reminder",
  "system-reminder",
  "mcp_instructions",
  "mcp_file_system",
  "mcp_file_system_servers",
  "git_status",
  "agent_transcripts",
  "attached_files",
  "system_notification",
];

export function stripContextBlocks(text: string): string {
  let out = text;
  for (const tag of STRIP_TAGS) {
    const re = new RegExp(`<${tag}(?:\\s[^>]*)?>[\\s\\S]*?</${tag}>`, "gi");
    out = out.replace(re, "");
  }
  return out.replace(/\n{3,}/g, "\n\n").trim();
}
