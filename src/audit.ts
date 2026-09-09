import { createHash, randomUUID } from "node:crypto";
import type { AuditEvent, Run } from "./types.js";

const SECRET_KEY =
  /(^|[_-])(token|secret|password|passwd|authorization|api[_-]?key|webhook(_?url)?)$/i;
const PAT_RE = /github_pat_[A-Za-z0-9_]+/g;
const BEARER_RE = /Bearer\s+[A-Za-z0-9._\-+=\/]+/gi;
const SLACK_HOOK_RE =
  /https:\/\/hooks\.slack\.com\/services\/[A-Za-z0-9/_-]+/gi;

/** First event links to this sentinel so the chain has a fixed root. */
export const AUDIT_GENESIS =
  "0000000000000000000000000000000000000000000000000000000000000000";

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

function stableStringify(value: unknown): string {
  if (value === undefined) return "null";
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) {
    return `[${value.map((v) => stableStringify(v)).join(",")}]`;
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

export function hashAuditPayload(payload: unknown): string {
  return createHash("sha256").update(stableStringify(payload)).digest("hex");
}

export function lastAuditHash(events: AuditEvent[] | undefined): string {
  if (!events || events.length === 0) return AUDIT_GENESIS;
  const last = events[events.length - 1];
  return last.hash ?? AUDIT_GENESIS;
}

export interface AuditChainReport {
  ok: boolean;
  eventCount: number;
  brokenAt?: number;
  reason?: string;
}

/**
 * Verify hash linkage. Events without hash (pre-Session 26) are skipped
 * as long as they do not claim a hash that fails.
 */
export function verifyAuditChain(events: AuditEvent[] | undefined): AuditChainReport {
  const list = events ?? [];
  let prev = AUDIT_GENESIS;
  for (let i = 0; i < list.length; i++) {
    const ev = list[i];
    if (!ev.hash) {
      prev = AUDIT_GENESIS;
      continue;
    }
    const expectedPrev = ev.prevHash ?? AUDIT_GENESIS;
    if (expectedPrev !== prev) {
      return { ok: false, eventCount: list.length, brokenAt: i, reason: "prevHash mismatch" };
    }
    const recomputed = hashAuditPayload({
      id: ev.id,
      timestamp: ev.timestamp,
      runId: ev.runId,
      agentId: ev.agentId,
      stepId: ev.stepId,
      type: ev.type,
      content: ev.content,
      prevHash: expectedPrev,
    });
    if (recomputed !== ev.hash) {
      return { ok: false, eventCount: list.length, brokenAt: i, reason: "hash mismatch" };
    }
    prev = ev.hash;
  }
  return { ok: true, eventCount: list.length };
}

export function appendAudit(
  run: Run,
  partial: Omit<AuditEvent, "id" | "timestamp" | "runId" | "hash" | "prevHash"> & {
    runId?: string;
  },
): AuditEvent {
  const content = sanitizeAuditContent(partial.content);
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const runId = partial.runId ?? run.id;
  const prevHash = lastAuditHash(run.audit);
  const body = {
    id,
    timestamp,
    runId,
    agentId: partial.agentId,
    stepId: partial.stepId,
    type: partial.type,
    content,
    prevHash,
  };
  const event: AuditEvent = {
    ...body,
    hash: hashAuditPayload(body),
  };
  run.audit.push(event);
  return event;
}
