import type { Run, Workflow } from "./types.js";

const MAX_TTL_MS = 24 * 60 * 60 * 1000;

export function resolveApprovalTtlMs(workflow: Workflow): number | undefined {
  const raw = workflow.approvalTtlMs;
  if (raw === undefined) return undefined;
  if (!Number.isFinite(raw) || raw <= 0) {
    throw new Error(`Invalid approvalTtlMs ${raw} on workflow ${workflow.id}`);
  }
  return Math.min(raw, MAX_TTL_MS);
}

export function computeApprovalExpiresAt(
  pausedAtIso: string,
  ttlMs: number,
): string {
  const pausedAt = Date.parse(pausedAtIso);
  if (!Number.isFinite(pausedAt)) {
    throw new Error(`Invalid pausedAt ${pausedAtIso}`);
  }
  return new Date(pausedAt + ttlMs).toISOString();
}

export function isApprovalExpired(
  run: Run,
  workflow: Workflow,
  now = Date.now(),
): boolean {
  if (run.status !== "awaiting_approval") return false;
  const ttl = resolveApprovalTtlMs(workflow);
  if (ttl === undefined) return false;
  if (run.approvalExpiresAt) {
    const expires = Date.parse(run.approvalExpiresAt);
    if (Number.isFinite(expires)) return now >= expires;
  }
  const pausedAt = run.pausedAt ? Date.parse(run.pausedAt) : Number.NaN;
  if (!Number.isFinite(pausedAt)) return false;
  return now - pausedAt >= ttl;
}
