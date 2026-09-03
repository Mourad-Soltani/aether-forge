import assert from "node:assert/strict";
import { test } from "node:test";
import { executeWorkflow, resumeRun } from "../src/orchestrator.js";
import {
  verticalDemoAgents,
  verticalDemoWorkflow,
} from "../src/workflows/vertical-demo.js";

test("wf.vertical pauses at workspace_write after parallel fetch+research and llm", async () => {
  process.env.AETHER_LLM_DRY_RUN = "1";
  process.env.AETHER_WORKSPACE_DRY_RUN = "1";
  const run = await executeWorkflow(verticalDemoWorkflow, verticalDemoAgents);
  assert.equal(run.status, "awaiting_approval");
  assert.equal(run.pausedStepId, "step.write");
  assert.ok(run.memory.http);
  assert.ok(run.memory.research);
  assert.ok(run.memory.llm);
  assert.equal(run.memory.file, undefined);
  assert.equal(run.memory.notify, undefined);

  const waveEvent = run.audit.find(
    (e) =>
      e.type === "decision" &&
      e.content &&
      typeof e.content === "object" &&
      (e.content as { kind?: string }).kind === "parallel_wave",
  );
  assert.ok(waveEvent);

  const resumed = await resumeRun(run.id, "approve");
  assert.equal(resumed.status, "completed");
  assert.ok(resumed.memory.file);
  assert.ok(resumed.memory.notify);
  const file = resumed.memory.file as { dryRun?: boolean; path?: string };
  assert.equal(file.dryRun, true);
  assert.equal(file.path, "briefs/vertical.md");
});
