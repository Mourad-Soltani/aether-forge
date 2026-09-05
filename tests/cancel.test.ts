import assert from "node:assert/strict";
import { test } from "node:test";
import { cancelRun, executeWorkflow, resumeRun } from "../src/orchestrator.js";
import { loadRun } from "../src/persist.js";
import { summarizeRun } from "../src/summary.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("cancelRun: paused HITL run becomes cancelled, not failed", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  assert.equal(paused.status, "awaiting_approval");

  const cancelled = await cancelRun(paused.id);
  assert.equal(cancelled.status, "cancelled");
  assert.equal(cancelled.error?.includes("Cancelled"), true);
  assert.ok(cancelled.finishedAt);

  const decisions = cancelled.audit.filter(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "cancel",
  );
  assert.equal(decisions.length, 1);

  const summary = summarizeRun(cancelled);
  assert.equal(summary.status, "cancelled");
  assert.equal(summary.ok, true);

  const persisted = await loadRun(paused.id);
  assert.equal(persisted.status, "cancelled");
});

test("cancelRun: refuses completed and already-cancelled runs", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  await assert.rejects(() => cancelRun(done.id), /expected awaiting_approval/);

  const { workflow: hitlWf, agents: hitlAgents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(hitlWf, hitlAgents);
  await cancelRun(paused.id);
  await assert.rejects(() => cancelRun(paused.id), /expected awaiting_approval/);
});

test("cancel vs reject: reject stays failed", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  const rejected = await resumeRun(paused.id, "reject");
  assert.equal(rejected.status, "failed");
});
