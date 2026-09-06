import assert from "node:assert/strict";
import { test } from "node:test";
import { executeWorkflow, retryFailedRun } from "../src/orchestrator.js";
import { loadRun, saveRun } from "../src/persist.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("successful waves record completedStepIds", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const run = await executeWorkflow(workflow, agents);
  assert.equal(run.status, "completed");
  assert.ok((run.completedStepIds ?? []).length >= 1);
});

test("retryFailedRun refuses non-failed runs", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  await assert.rejects(() => retryFailedRun(done.id), /expected failed/);

  const { workflow: hitlWf, agents: hitlAgents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(hitlWf, hitlAgents);
  await assert.rejects(() => retryFailedRun(paused.id), /expected failed/);
});

test("retryFailedRun skips completed waves and finishes remaining steps", async () => {
  const { workflow, agents } = resolveWorkflow("retry-ok");
  const completed = await executeWorkflow(workflow, agents);
  assert.equal(completed.status, "completed");
  assert.ok(completed.completedStepIds?.includes("step.retry.ok"));
  assert.ok(completed.completedStepIds?.includes("step.notify.retry"));

  completed.status = "failed";
  completed.error = "synthetic mid-run failure";
  completed.completedStepIds = ["step.retry.ok"];
  delete completed.memory.notice;
  completed.finishedAt = new Date().toISOString();
  await saveRun(completed);

  const retried = await retryFailedRun(completed.id);
  assert.equal(retried.id, completed.id);
  assert.equal(retried.status, "completed");
  assert.ok(retried.memory.recovered);
  assert.ok(retried.memory.notice);
  assert.ok(retried.completedStepIds?.includes("step.notify.retry"));

  const decisions = retried.audit.filter(
    (e) => e.type === "decision" && (e.content as { kind?: string }).kind === "retry_failed",
  );
  assert.equal(decisions.length, 1);

  const persisted = await loadRun(completed.id);
  assert.equal(persisted.status, "completed");
});
