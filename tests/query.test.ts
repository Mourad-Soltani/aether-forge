import assert from "node:assert/strict";
import { test } from "node:test";
import { filterRunSummaries, parseStatusFilter, parseArchivedFilter } from "../src/query.js";
import { executeWorkflow } from "../src/orchestrator.js";
import { labelRun } from "../src/label.js";
import { archiveRun } from "../src/archive.js";
import { listRunSummaries } from "../src/persist.js";
import { resolveWorkflow } from "../src/workflows/registry.js";

test("parseStatusFilter and parseArchivedFilter reject junk", () => {
  assert.equal(parseStatusFilter(undefined), undefined);
  assert.equal(parseStatusFilter("all"), undefined);
  assert.equal(parseStatusFilter("completed"), "completed");
  assert.throws(() => parseStatusFilter("nope"), /Unknown status/);
  assert.equal(parseArchivedFilter(undefined), "all");
  assert.equal(parseArchivedFilter("hide"), "hide");
  assert.throws(() => parseArchivedFilter("maybe"), /archived must be/);
});

test("filterRunSummaries ANDs status, workflow, label, q, archived", async () => {
  const { workflow, agents } = resolveWorkflow("hello");
  const a = await executeWorkflow(workflow, agents);
  const b = await executeWorkflow(workflow, agents);
  await labelRun(a.id, "pilot");
  await archiveRun(b.id);

  const rows = await listRunSummaries();
  const byLabel = filterRunSummaries(rows, { label: "pilot" });
  assert.ok(byLabel.some((r) => r.id === a.id));
  assert.ok(!byLabel.some((r) => r.id === b.id));

  const byStatus = filterRunSummaries(rows, { status: "completed", label: "pilot" });
  assert.ok(byStatus.some((r) => r.id === a.id));

  const byQ = filterRunSummaries(rows, { q: a.id.slice(0, 8) });
  assert.ok(byQ.some((r) => r.id === a.id));

  const hidden = filterRunSummaries(rows, { archived: "hide" });
  assert.ok(hidden.some((r) => r.id === a.id));
  assert.ok(!hidden.some((r) => r.id === b.id));

  const onlyArchived = filterRunSummaries(rows, { archived: "only" });
  assert.ok(onlyArchived.some((r) => r.id === b.id));
  assert.ok(!onlyArchived.some((r) => r.id === a.id));

  const miss = filterRunSummaries(rows, { workflow: "wf.hitl", label: "pilot" });
  assert.ok(!miss.some((r) => r.id === a.id));
});
