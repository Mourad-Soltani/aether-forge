import assert from "node:assert/strict";
import { test } from "node:test";
import { executeWorkflow } from "../src/orchestrator.js";
import { resolveStepTimeoutMs, withTimeout, MAX_STEP_TIMEOUT_MS } from "../src/timeout.js";
import {
  timeoutDemoAgents,
  timeoutFailWorkflow,
  timeoutOkWorkflow,
} from "../src/workflows/timeout-demo.js";

test("resolveStepTimeoutMs caps and rejects bad values", () => {
  assert.equal(resolveStepTimeoutMs(undefined), undefined);
  assert.equal(resolveStepTimeoutMs(50), 50);
  assert.equal(resolveStepTimeoutMs(MAX_STEP_TIMEOUT_MS + 1), MAX_STEP_TIMEOUT_MS);
  assert.throws(() => resolveStepTimeoutMs(0));
  assert.throws(() => resolveStepTimeoutMs(-1));
});

test("withTimeout resolves when work finishes first", async () => {
  const value = await withTimeout(Promise.resolve("ok"), 200, "step.x");
  assert.equal(value, "ok");
});

test("withTimeout rejects when the cap elapses", async () => {
  await assert.rejects(
    withTimeout(new Promise((r) => setTimeout(() => r("late"), 200)), 20, "step.slow"),
    /timed out after 20ms: step.slow/,
  );
});

test("wf.timeout.ok completes under the cap", async () => {
  const run = await executeWorkflow(timeoutOkWorkflow, timeoutDemoAgents);
  assert.equal(run.status, "completed");
  assert.ok(run.memory.slept);
  assert.ok(run.memory.notice);
});

test("wf.timeout.fail marks the run failed", async () => {
  const run = await executeWorkflow(timeoutFailWorkflow, timeoutDemoAgents);
  assert.equal(run.status, "failed");
  assert.match(String(run.error), /timed out after 40ms: step.sleep.fail/);
  const errEvent = run.audit.find((e) => e.type === "error");
  assert.ok(errEvent);
});

test("runWithTimeout aborts the signal when the cap elapses", async () => {
  const { runWithTimeout } = await import("../src/timeout.js");
  let aborted = false;
  const started = Date.now();
  await assert.rejects(
    runWithTimeout(
      async (signal) => {
        signal.addEventListener("abort", () => {
          aborted = true;
        });
        await new Promise((r) => setTimeout(r, 400));
        return "late";
      },
      30,
      "step.abort",
    ),
    /timed out after 30ms: step.abort/,
  );
  assert.equal(aborted, true);
  assert.ok(Date.now() - started < 300);
});
