import { appendAudit } from "./audit.js";
import { normalizeDecisionReason } from "./decision.js";
import { loadRun, saveRun } from "./persist.js";
import type { Run } from "./types.js";

/** Append an operator note. Does not change run status or archive state. */
export async function noteRun(runId: string, text?: string): Promise<Run> {
  const run = await loadRun(runId);
  const note = normalizeDecisionReason(text);
  if (!note) {
    throw new Error("Note text is required");
  }
  appendAudit(run, {
    type: "decision",
    content: {
      decision: "note",
      reason: note,
    },
  });
  await saveRun(run);
  return run;
}
