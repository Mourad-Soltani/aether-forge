import assert from "node:assert/strict";
import { test } from "node:test";
import { pinRun, unpinRun } from "../src/pin.js";
import { executeWorkflow } from "../src/orchestrator.js";
import { loadRun } from "../src/persist.js";
import { summarizeRun } from "../src/summary.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("pinRun: stamps pinnedAt and audit decision on any status", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  assert.equal(done.pinnedAt, undefined);

  const pinned = await pinRun(done.id, "watch this pilot");
  assert.ok(pinned.pinnedAt);
  const decisions = pinned.audit.filter(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "pin",
  );
  assert.equal(decisions.length, 1);
  assert.equal((decisions[0].content as { reason?: string }).reason, "watch this pilot");
  assert.equal(summarizeRun(pinned).pinned, true);
  assert.equal(done.status, pinned.status);

  const persisted = await loadRun(done.id);
  assert.ok(persisted.pinnedAt);
});

test("pinRun: allowed on HITL pause; refuses double-pin", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  assert.equal(paused.status, "awaiting_approval");
  const pinned = await pinRun(paused.id);
  assert.ok(pinned.pinnedAt);
  assert.equal(pinned.status, "awaiting_approval");
  await assert.rejects(() => pinRun(paused.id), /already pinned/);
});

test("unpinRun: clears pinnedAt", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const done = await executeWorkflow(workflow, agents);
  await pinRun(done.id);
  const restored = await unpinRun(done.id);
  assert.equal(restored.pinnedAt, undefined);
  assert.equal(summarizeRun(restored).pinned ?? false, false);
  await assert.rejects(() => unpinRun(done.id), /not pinned/);
});
