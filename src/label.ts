import { appendAudit } from "./audit.js";
import { loadRun, saveRun } from "./persist.js";
import type { Run } from "./types.js";

export const MAX_LABELS = 8;
export const LABEL_RE = /^[a-z0-9][a-z0-9._-]{0,31}$/;

/** Normalize a single operator label. Lowercase, trimmed, charset-restricted. */
export function normalizeLabel(raw?: string): string {
  const value = (raw ?? "").trim().toLowerCase();
  if (!value) {
    throw new Error("Label is required");
  }
  if (!LABEL_RE.test(value)) {
    throw new Error("Label must match [a-z0-9][a-z0-9._-]{0,31}");
  }
  return value;
}

/** True when the run carries the exact normalized label. */
export function runHasLabel(
  labels: string[] | undefined,
  raw?: string,
): boolean {
  const needle = normalizeLabel(raw);
  return (labels ?? []).includes(needle);
}

export function filterByLabel<T extends { labels?: string[] }>(
  rows: T[],
  raw?: string,
): T[] {
  if (raw === undefined || raw === "" || raw === "all") return rows;
  const needle = normalizeLabel(raw);
  return rows.filter((r) => (r.labels ?? []).includes(needle));
}

/** Add an operator label. Any status. Does not change status or pin/archive. */
export async function labelRun(runId: string, raw?: string): Promise<Run> {
  const run = await loadRun(runId);
  const label = normalizeLabel(raw);
  const current = run.labels ?? [];
  if (current.includes(label)) {
    throw new Error(`Run ${runId} already has label ${label}`);
  }
  if (current.length >= MAX_LABELS) {
    throw new Error(`Run ${runId} already has ${MAX_LABELS} labels`);
  }
  run.labels = [...current, label];
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "label",
      label,
    },
  });
  await saveRun(run);
  return run;
}

export async function unlabelRun(runId: string, raw?: string): Promise<Run> {
  const run = await loadRun(runId);
  const label = normalizeLabel(raw);
  const current = run.labels ?? [];
  if (!current.includes(label)) {
    throw new Error(`Run ${runId} does not have label ${label}`);
  }
  run.labels = current.filter((l) => l !== label);
  if (run.labels.length === 0) delete run.labels;
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "unlabel",
      label,
    },
  });
  await saveRun(run);
  return run;
}
