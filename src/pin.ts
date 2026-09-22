import { appendAudit } from "./audit.js";
import { normalizeDecisionReason } from "./decision.js";
import { loadRun, saveRun } from "./persist.js";
import type { Run } from "./types.js";

/** Pin a run so it sorts first in operator lists. Any status. */
export async function pinRun(runId: string, reason?: string): Promise<Run> {
  const run = await loadRun(runId);
  if (run.pinnedAt) {
    throw new Error(`Run ${runId} is already pinned`);
  }
  const note = normalizeDecisionReason(reason);
  run.pinnedAt = new Date().toISOString();
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "pin",
      ...(note ? { reason: note } : {}),
    },
  });
  await saveRun(run);
  return run;
}

export async function unpinRun(runId: string, reason?: string): Promise<Run> {
  const run = await loadRun(runId);
  if (!run.pinnedAt) {
    throw new Error(`Run ${runId} is not pinned`);
  }
  const note = normalizeDecisionReason(reason);
  delete run.pinnedAt;
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "unpin",
      ...(note ? { reason: note } : {}),
    },
  });
  await saveRun(run);
  return run;
}
