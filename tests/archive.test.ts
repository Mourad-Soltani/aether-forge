import assert from "node:assert/strict";
import { test } from "node:test";
import { archiveRun, unarchiveRun } from "../src/archive.js";
import { executeWorkflow } from "../src/orchestrator.js";
import { loadRun } from "../src/persist.js";
import { summarizeRun } from "../src/summary.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("archiveRun: completed run stamps archivedAt and audit decision", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  assert.equal(done.status, "completed");
  assert.equal(done.archivedAt, undefined);

  const archived = await archiveRun(done.id, "keep list clean");
  assert.ok(archived.archivedAt);
  const decisions = archived.audit.filter(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "archive",
  );
  assert.equal(decisions.length, 1);
  assert.equal((decisions[0].content as { reason?: string }).reason, "keep list clean");

  const summary = summarizeRun(archived);
  assert.equal(summary.archived, true);

  const persisted = await loadRun(done.id);
  assert.ok(persisted.archivedAt);
});

test("archiveRun: refuses HITL pause and double-archive", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  await assert.rejects(() => archiveRun(paused.id), /expected a terminal status/);

  const { workflow: helloWf, agents: helloAgents } = resolveWorkflow("hello");
  const done = await executeWorkflow(helloWf, helloAgents);
  await archiveRun(done.id);
  await assert.rejects(() => archiveRun(done.id), /already archived/);
});

test("unarchiveRun: clears archivedAt", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  await archiveRun(done.id);
  const restored = await unarchiveRun(done.id);
  assert.equal(restored.archivedAt, undefined);
  assert.equal(summarizeRun(restored).archived ?? false, false);
  await assert.rejects(() => unarchiveRun(done.id), /not archived/);
});
