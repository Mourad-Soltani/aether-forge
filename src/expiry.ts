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

export function isApprovalExpired(
  run: Run,
  workflow: Workflow,
  now = Date.now(),
): boolean {
  if (run.status !== "awaiting_approval") return false;
  const ttl = resolveApprovalTtlMs(workflow);
  if (ttl === undefined) return false;
  const pausedAt = run.pausedAt ? Date.parse(run.pausedAt) : Number.NaN;
  if (!Number.isFinite(pausedAt)) return false;
  return now - pausedAt >= ttl;
}
