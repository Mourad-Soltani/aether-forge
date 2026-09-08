import assert from "node:assert/strict";
import { test } from "node:test";
import { normalizeDecisionReason, MAX_DECISION_REASON } from "../src/decision.js";
import { cancelRun, executeWorkflow, resumeRun } from "../src/orchestrator.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("normalizeDecisionReason trims, drops controls, caps length", () => {
  assert.equal(normalizeDecisionReason(undefined), undefined);
  assert.equal(normalizeDecisionReason("   "), undefined);
  assert.equal(normalizeDecisionReason("  looks good  "), "looks good");
  assert.equal(normalizeDecisionReason("a\nb\tc"), "a b c");
  const long = "x".repeat(MAX_DECISION_REASON + 40);
  assert.equal(normalizeDecisionReason(long)?.length, MAX_DECISION_REASON);
});

test("approve / reject / cancel persist optional reason on decision audit", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");

  const pausedA = await executeWorkflow(workflow, agents);
  const approved = await resumeRun(pausedA.id, "approve", "ticket looks valid");
  const approveEv = approved.audit.find(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "approve",
  );
  assert.equal((approveEv?.content as { reason?: string }).reason, "ticket looks valid");
  assert.equal(approved.status, "completed");

  const pausedR = await executeWorkflow(workflow, agents);
  const rejected = await resumeRun(pausedR.id, "reject", "out of policy");
  const rejectEv = rejected.audit.find(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "reject",
  );
  assert.equal((rejectEv?.content as { reason?: string }).reason, "out of policy");

  const pausedC = await executeWorkflow(workflow, agents);
  const cancelled = await cancelRun(pausedC.id, "operator abort");
  const cancelEv = cancelled.audit.find(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "cancel",
  );
  assert.equal((cancelEv?.content as { reason?: string }).reason, "operator abort");
});

test("missing reason keeps prior decision payload shape", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  const cancelled = await cancelRun(paused.id);
  const ev = cancelled.audit.find(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "cancel",
  );
  assert.equal((ev?.content as { reason?: string }).reason, undefined);
});
