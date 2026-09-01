import assert from "node:assert/strict";
import { test } from "node:test";
import type { Run } from "../src/types.js";
import {
  parseRunSummaryFromStdout,
  summarizeRun,
} from "../src/summary.js";

function run(partial: Partial<Run>): Run {
  return {
    id: "run-abc",
    workflowId: "wf.hello",
    status: "completed",
    startedAt: "2026-09-02T00:00:00.000Z",
    memory: {},
    audit: [],
    ...partial,
  };
}

test("summarizeRun: completed is ok and omits persisted when unset", () => {
  const summary = summarizeRun(
    run({
      status: "completed",
      memory: { brief: "x" },
      audit: [
        {
          id: "1",
          timestamp: "t",
          type: "run_start",
          content: {},
        },
      ],
    }),
  );
  assert.equal(summary.ok, true);
  assert.equal(summary.status, "completed");
  assert.equal(summary.id, "run-abc");
  assert.equal(summary.workflowId, "wf.hello");
  assert.equal(summary.pausedStepId, null);
  assert.equal(summary.auditEvents, 1);
  assert.deepEqual(summary.memoryKeys, ["brief"]);
  assert.equal(summary.error, null);
  assert.equal(summary.persisted, undefined);
});

test("summarizeRun: failed is not ok and keeps error", () => {
  const summary = summarizeRun(
    run({ status: "failed", error: "boom" }),
    "/tmp/run-abc.json",
  );
  assert.equal(summary.ok, false);
  assert.equal(summary.status, "failed");
  assert.equal(summary.error, "boom");
  assert.equal(summary.persisted, "/tmp/run-abc.json");
});

test("summarizeRun: awaiting_approval is ok (pause is not failure)", () => {
  const summary = summarizeRun(
    run({ status: "awaiting_approval", pausedStepId: "create-ticket" }),
  );
  assert.equal(summary.ok, true);
  assert.equal(summary.status, "awaiting_approval");
  assert.equal(summary.pausedStepId, "create-ticket");
});

test("parseRunSummaryFromStdout: last valid object wins; banners ignored", () => {
  const summary = summarizeRun(run({ status: "completed" }));
  const raw = [
    "npm warn something",
    JSON.stringify({ ok: true, not: "a summary" }),
    JSON.stringify(summary),
    "",
  ].join("\n");
  const parsed = parseRunSummaryFromStdout(raw);
  assert.equal(parsed.id, "run-abc");
  assert.equal(parsed.status, "completed");
});

test("parseRunSummaryFromStdout: throws when no contract object", () => {
  assert.throws(
    () => parseRunSummaryFromStdout("hello\n{not json\n"),
    /no JSON RunSummary/,
  );
});
