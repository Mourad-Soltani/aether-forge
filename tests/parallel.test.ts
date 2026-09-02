import assert from "node:assert/strict";
import { test } from "node:test";
import { executeWorkflow, groupWaves, resumeRun } from "../src/orchestrator.js";
import type { Step } from "../src/types.js";
import {
  parallelDemoAgents,
  parallelDemoWorkflow,
  parallelHitlWorkflow,
} from "../src/workflows/parallel-demo.js";

test("groupWaves clusters consecutive parallel steps", () => {
  const steps: Step[] = [
    { id: "a", agentId: "x", toolName: "t", args: {}, mode: "parallel" },
    { id: "b", agentId: "x", toolName: "t", args: {}, mode: "parallel" },
    { id: "c", agentId: "x", toolName: "t", args: {} },
    { id: "d", agentId: "x", toolName: "t", args: {}, mode: "parallel" },
  ];
  const waves = groupWaves(steps);
  assert.equal(waves.length, 3);
  assert.deepEqual(waves[0].map((s) => s.id), ["a", "b"]);
  assert.deepEqual(waves[1].map((s) => s.id), ["c"]);
  assert.deepEqual(waves[2].map((s) => s.id), ["d"]);
});

test("wf.parallel completes with both research keys", async () => {
  const run = await executeWorkflow(parallelDemoWorkflow, parallelDemoAgents);
  assert.equal(run.status, "completed");
  assert.ok(run.memory.researchA);
  assert.ok(run.memory.researchB);
  assert.ok(run.memory.brief);
  const waveEvent = run.audit.find(
    (e) =>
      e.type === "decision" &&
      e.content &&
      typeof e.content === "object" &&
      (e.content as { kind?: string }).kind === "parallel_wave",
  );
  assert.ok(waveEvent);
});

test("parallel wave pauses before any irreversible execute", async () => {
  const run = await executeWorkflow(parallelHitlWorkflow, parallelDemoAgents);
  assert.equal(run.status, "awaiting_approval");
  assert.equal(run.pausedStepId, "step.ticket.p");
  assert.equal(run.memory.ticket, undefined);
  assert.equal(run.memory.researchA, undefined);

  const resumed = await resumeRun(run.id, "approve");
  assert.equal(resumed.status, "completed");
  assert.ok(resumed.memory.ticket);
  assert.ok(resumed.memory.researchA);
});
