import assert from "node:assert/strict";
import { test } from "node:test";
import { labelRun, unlabelRun, normalizeLabel } from "../src/label.js";
import { executeWorkflow } from "../src/orchestrator.js";
import { loadRun } from "../src/persist.js";
import { summarizeRun } from "../src/summary.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("normalizeLabel: lowercase charset and rejects junk", () => {
  assert.equal(normalizeLabel(" Pilot "), "pilot");
  assert.throws(() => normalizeLabel(""), /required/);
  assert.throws(() => normalizeLabel("NO SPACES"), /must match/);
  assert.throws(() => normalizeLabel("x".repeat(40)), /must match/);
});

test("labelRun: appends unique labels and audit decision", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  const labeled = await labelRun(done.id, "pilot");
  assert.deepEqual(labeled.labels, ["pilot"]);
  const decisions = labeled.audit.filter(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "label",
  );
  assert.equal(decisions.length, 1);
  assert.equal((decisions[0].content as { label?: string }).label, "pilot");
  assert.deepEqual(summarizeRun(labeled).labels, ["pilot"]);
  assert.equal(done.status, labeled.status);

  await assert.rejects(() => labelRun(done.id, "pilot"), /already has label/);
  const second = await labelRun(done.id, "watch");
  assert.deepEqual(second.labels, ["pilot", "watch"]);

  const persisted = await loadRun(done.id);
  assert.deepEqual(persisted.labels, ["pilot", "watch"]);
});

test("unlabelRun: removes label; refuses missing", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  await labelRun(done.id, "pilot");
  const cleared = await unlabelRun(done.id, "pilot");
  assert.equal(cleared.labels, undefined);
  assert.equal(summarizeRun(cleared).labels, undefined);
  await assert.rejects(() => unlabelRun(done.id, "pilot"), /does not have label/);
});

test("labelRun: allowed on HITL pause", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  assert.equal(paused.status, "awaiting_approval");
  const labeled = await labelRun(paused.id, "review");
  assert.deepEqual(labeled.labels, ["review"]);
  assert.equal(labeled.status, "awaiting_approval");
});
