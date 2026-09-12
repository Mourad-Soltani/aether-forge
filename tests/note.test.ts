import assert from "node:assert/strict";
import { test } from "node:test";
import { noteRun } from "../src/note.js";
import { executeWorkflow } from "../src/orchestrator.js";
import { loadRun } from "../src/persist.js";
import { verifyAuditChain } from "../src/audit.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("noteRun: appends decision note without changing status", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  const before = done.audit.length;
  const noted = await noteRun(done.id, "pilot review: keep");
  assert.equal(noted.status, "completed");
  const notes = noted.audit.filter(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "note",
  );
  assert.equal(notes.length, 1);
  assert.equal((notes[0].content as { reason?: string }).reason, "pilot review: keep");
  assert.equal(noted.audit.length, before + 1);
  assert.equal(verifyAuditChain(noted.audit).ok, true);
  const persisted = await loadRun(done.id);
  assert.equal(persisted.audit.length, noted.audit.length);
});

test("noteRun: allowed on HITL pause", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  assert.equal(paused.status, "awaiting_approval");
  const noted = await noteRun(paused.id, "waiting on legal");
  assert.equal(noted.status, "awaiting_approval");
  assert.equal(noted.pausedStepId, paused.pausedStepId);
});

test("noteRun: refuses empty text", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  await assert.rejects(() => noteRun(done.id, "   "), /Note text is required/);
  await assert.rejects(() => noteRun(done.id), /Note text is required/);
});
