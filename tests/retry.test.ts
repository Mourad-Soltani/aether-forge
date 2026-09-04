import assert from "node:assert/strict";
import { test } from "node:test";
import { executeWorkflow } from "../src/orchestrator.js";
import { resolveStepRetry, MAX_ATTEMPTS, MAX_BACKOFF_MS } from "../src/retry.js";
import {
  retryDemoAgents,
  retryFailWorkflow,
  retryOkWorkflow,
} from "../src/workflows/retry-demo.js";

test("resolveStepRetry defaults, clamps, and rejects bad values", () => {
  assert.deepEqual(resolveStepRetry(undefined), { maxAttempts: 1, backoffMs: 0 });
  assert.equal(resolveStepRetry({ maxAttempts: 3, backoffMs: 20 }).maxAttempts, 3);
  assert.equal(resolveStepRetry({ maxAttempts: MAX_ATTEMPTS + 4 }).maxAttempts, MAX_ATTEMPTS);
  assert.equal(resolveStepRetry({ maxAttempts: 2, backoffMs: MAX_BACKOFF_MS + 1 }).backoffMs, MAX_BACKOFF_MS);
  assert.throws(() => resolveStepRetry({ maxAttempts: 0 }));
  assert.throws(() => resolveStepRetry({ maxAttempts: -1 }));
  assert.throws(() => resolveStepRetry({ maxAttempts: 2, backoffMs: -5 }));
});

test("wf.retry.ok recovers after transient failures", async () => {
  const run = await executeWorkflow(retryOkWorkflow, retryDemoAgents);
  assert.equal(run.status, "completed");
  const recovered = run.memory.recovered as { attempts: number; ok: boolean };
  assert.equal(recovered.ok, true);
  assert.equal(recovered.attempts, 3);
  const errors = run.audit.filter((e) => e.type === "error");
  assert.equal(errors.length, 2);
  const retries = run.audit.filter(
    (e) => e.type === "decision" && (e.content as { kind?: string })?.kind === "retry",
  );
  assert.equal(retries.length, 2);
  assert.ok(run.memory.notice);
});

test("wf.retry.fail exhausts attempts", async () => {
  const run = await executeWorkflow(retryFailWorkflow, retryDemoAgents);
  assert.equal(run.status, "failed");
  assert.match(String(run.error), /fail_n_stub demo-fail/);
  const errors = run.audit.filter((e) => e.type === "error");
  assert.ok(errors.length >= 2);
});
