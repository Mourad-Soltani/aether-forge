import { appendAudit } from "./audit.js";
import { normalizeDecisionReason } from "./decision.js";
import { loadRun, saveRun } from "./persist.js";
import type { Run, RunStatus } from "./types.js";

const TERMINAL: RunStatus[] = ["completed", "failed", "cancelled", "expired"];

export function isTerminalStatus(status: RunStatus): boolean {
  return TERMINAL.includes(status);
}

export async function archiveRun(runId: string, reason?: string): Promise<Run> {
  const run = await loadRun(runId);
  if (!isTerminalStatus(run.status)) {
    throw new Error(`Run ${runId} is ${run.status}, expected a terminal status`);
  }
  if (run.archivedAt) {
    throw new Error(`Run ${runId} is already archived`);
  }
  const note = normalizeDecisionReason(reason);
  run.archivedAt = new Date().toISOString();
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "archive",
      ...(note ? { reason: note } : {}),
    },
  });
  await saveRun(run);
  return run;
}

export async function unarchiveRun(runId: string, reason?: string): Promise<Run> {
  const run = await loadRun(runId);
  if (!run.archivedAt) {
    throw new Error(`Run ${runId} is not archived`);
  }
  const note = normalizeDecisionReason(reason);
  delete run.archivedAt;
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "unarchive",
      ...(note ? { reason: note } : {}),
    },
  });
  await saveRun(run);
  return run;
}
