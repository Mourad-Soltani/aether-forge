import { randomUUID } from "node:crypto";
import type { AuditEvent, Run } from "./types.js";

const SECRET_KEY =
  /(^|[_-])(token|secret|password|passwd|authorization|api[_-]?key|webhook(_?url)?)$/i;
const PAT_RE = /github_pat_[A-Za-z0-9_]+/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-+=\/]+/gi;
const SLACK_HOOK_RE =
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/gi;

function redactString(value: string): string {
  return value
    .replace(PAT_RE, "[redacted-pat]")
    .replace(BEARER_RE, "Bearer [redacted]")
    .replace(SLACK_HOOK_RE, "https://hooks.slack.com/services/[redacted]");
}

/** Strip secret-shaped values before they land in the append-only audit log. */
export function sanitizeAuditContent(value: unknown): unknown {
  if (typeof value === "string") return redactString(value);
  if (Array.isArray(value)) return value.map(sanitizeAuditContent);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (SECRET_KEY.test(k)) {
        out[k] = "[redacted]";
        continue;
      }
      out[k] = sanitizeAuditContent(v);
    }
    return out;
  }
  return value;
}

export function appendAudit(
  run: Run,
  partial: Omit<AuditEvent, "id" | "timestamp" | "runId"> & { runId?: string },
): AuditEvent {
  const event: AuditEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    runId: run.id,
    ...partial,
    content: sanitizeAuditContent(partial.content),
  };
  run.audit.push(event);
  return event;
}
