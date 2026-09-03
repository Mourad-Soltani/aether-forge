import assert from "node:assert/strict";
import { test } from "node:test";
import { appendAudit } from "../src/audit.js";
import { auditBundleToJsonl, buildAuditBundle } from "../src/export.js";
import type { Run } from "../src/types.js";

function sampleRun(): Run {
  const run: Run = {
    id: "run-export-1",
    workflowId: "wf.hello",
    status: "completed",
    startedAt: "2026-09-03T00:00:00.000Z",
    finishedAt: "2026-09-03T00:00:01.000Z",
    memory: { brief: "ok" },
    audit: [],
    approvedStepIds: ["s1"],
  };
  appendAudit(run, { type: "run_start", content: { workflowId: "wf.hello" } });
  appendAudit(run, {
    type: "tool_result",
    content: { token: "should-not-appear", note: "github_pat_EXAMPLETOKENVALUE000" },
  });
  return run;
}

test("buildAuditBundle omits raw memory values", () => {
  const bundle = buildAuditBundle(sampleRun(), "2026-09-03T08:00:00.000Z");
  assert.equal(bundle.format, "aether-audit-v1");
  assert.equal(bundle.run.id, "run-export-1");
  assert.deepEqual(bundle.run.memoryKeys, ["brief"]);
  assert.equal(bundle.events.length, 2);
  assert.ok(!("memory" in bundle.run));
});

test("JSONL export is parseable and already redacted", () => {
  const run = sampleRun();
  const text = auditBundleToJsonl(buildAuditBundle(run, "2026-09-03T08:00:00.000Z"));
  const lines = text.trim().split("\n");
  assert.equal(lines.length, 3);
  const header = JSON.parse(lines[0]) as { eventCount: number; format: string };
  assert.equal(header.format, "aether-audit-v1");
  assert.equal(header.eventCount, 2);
  assert.doesNotMatch(text, /github_pat_/);
  assert.match(text, /\[redacted-pat\]/);
  assert.match(text, /"token":"\[redacted\]"/);
});
