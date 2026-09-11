import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { isApprovalExpired, resolveApprovalTtlMs } from "../src/expiry.js";
import {
  executeWorkflow,
  expireRun,
  expireStaleRuns,
  resumeRun,
} from "../src/orchestrator.js";
import { summarizeRun } from "../src/summary.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("resolveApprovalTtlMs: omit means no expiry; invalid throws", () => {
  assert.equal(resolveApprovalTtlMs({ id: "wf.x", name: "x", steps: [] }), undefined);
  assert.throws(
    () => resolveApprovalTtlMs({ id: "wf.x", name: "x", steps: [], approvalTtlMs: 0 }),
    /Invalid approvalTtlMs/,
  );
});

test("isApprovalExpired: uses pausedAt + workflow TTL", () => {
  const wf = resolveWorkflow("hitl-ttl").workflow;
  const now = Date.parse("2026-09-11T00:00:01.000Z");
  assert.equal(
    isApprovalExpired(
      {
        id: "r1",
        workflowId: wf.id,
        status: "awaiting_approval",
        startedAt: "2026-09-11T00:00:00.000Z",
        pausedAt: "2026-09-11T00:00:00.000Z",
        memory: {},
        audit: [],
      },
      wf,
      now,
    ),
    true,
  );
  assert.equal(
    isApprovalExpired(
      {
        id: "r2",
        workflowId: "wf.hitl",
        status: "awaiting_approval",
        startedAt: "2026-09-11T00:00:00.000Z",
        pausedAt: "2026-09-11T00:00:00.000Z",
        memory: {},
        audit: [],
      },
      resolveWorkflow("hitl").workflow,
      now,
    ),
    false,
  );
});

test("expireRun: HITL TTL workflow becomes expired, not failed", async () => {
  const { workflow, agents } = resolveWorkflow("hitl-ttl");
  const paused = await executeWorkflow(workflow, agents);
  assert.equal(paused.status, "awaiting_approval");
  assert.ok(paused.pausedAt);
  await delay(5);
  const expired = await expireRun(paused.id);
  assert.equal(expired.status, "expired");
  assert.ok(expired.finishedAt);
  const decisions = expired.audit.filter(
    (e) => e.type === "decision" && (e.content as { decision?: string }).decision === "expire",
  );
  assert.equal(decisions.length, 1);
  const summary = summarizeRun(expired);
  assert.equal(summary.status, "expired");
  assert.equal(summary.ok, true);
});

test("approve after TTL refuses and persists expired", async () => {
  const { workflow, agents } = resolveWorkflow("hitl-ttl");
  const paused = await executeWorkflow(workflow, agents);
  await delay(5);
  await assert.rejects(() => resumeRun(paused.id, "approve"), /expired/);
  const { loadRun } = await import("../src/persist.js");
  const persisted = await loadRun(paused.id);
  assert.equal(persisted.status, "expired");
});

test("expireRun: default HITL without TTL stays open", async () => {
  const { workflow, agents } = resolveWorkflow("hitl");
  const paused = await executeWorkflow(workflow, agents);
  await assert.rejects(() => expireRun(paused.id), /still open/);
  assert.equal(paused.status, "awaiting_approval");
});

test("pause stamps approvalExpiresAt when workflow has TTL", async () => {
  const { workflow, agents } = resolveWorkflow("hitl-ttl");
  const paused = await executeWorkflow(workflow, agents);
  assert.equal(paused.status, "awaiting_approval");
  assert.ok(paused.approvalExpiresAt);
  assert.ok(Date.parse(paused.approvalExpiresAt) >= Date.parse(paused.pausedAt ?? ""));
});

test("expireStaleRuns closes only TTL-elapsed pauses", async () => {
  const ttl = resolveWorkflow("hitl-ttl");
  const open = resolveWorkflow("hitl");
  const stale = await executeWorkflow(ttl.workflow, ttl.agents);
  const keep = await executeWorkflow(open.workflow, open.agents);
  await delay(5);
  const closed = await expireStaleRuns();
  const ids = closed.map((r) => r.id);
  assert.ok(ids.includes(stale.id));
  assert.ok(!ids.includes(keep.id));
  const { loadRun } = await import("../src/persist.js");
  assert.equal((await loadRun(stale.id)).status, "expired");
  assert.equal((await loadRun(keep.id)).status, "awaiting_approval");
});
