import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  isWorkspaceDryRun,
  resolveWorkspacePath,
  workspaceRead,
  workspaceWrite,
} from "../src/tools/workspace.js";
import type { ToolContext } from "../src/types.js";

function ctx(): ToolContext {
  return {
    runId: "run-1",
    agentId: "agent.files-operator",
    stepId: "step.write",
    memory: {},
    audit: () => undefined,
  };
}

test("isWorkspaceDryRun reads 1/true/yes", () => {
  const prev = process.env.AETHER_WORKSPACE_DRY_RUN;
  try {
    delete process.env.AETHER_WORKSPACE_DRY_RUN;
    assert.equal(isWorkspaceDryRun(), false);
    process.env.AETHER_WORKSPACE_DRY_RUN = "1";
    assert.equal(isWorkspaceDryRun(), true);
    process.env.AETHER_WORKSPACE_DRY_RUN = "true";
    assert.equal(isWorkspaceDryRun(), true);
    process.env.AETHER_WORKSPACE_DRY_RUN = "no";
    assert.equal(isWorkspaceDryRun(), false);
  } finally {
    if (prev === undefined) delete process.env.AETHER_WORKSPACE_DRY_RUN;
    else process.env.AETHER_WORKSPACE_DRY_RUN = prev;
  }
});

test("resolveWorkspacePath rejects traversal and absolute paths", () => {
  const prev = process.env.AETHER_WORKSPACE_ROOT;
  try {
    process.env.AETHER_WORKSPACE_ROOT = path.join(os.tmpdir(), "aether-ws");
    assert.throws(() => resolveWorkspacePath("../secret.txt"), /invalid/);
    assert.throws(() => resolveWorkspacePath("/etc/passwd"), /invalid/);
    assert.throws(() => resolveWorkspacePath(""), /invalid/);
    const ok = resolveWorkspacePath("briefs/demo.md");
    assert.match(ok, /briefs[\\/]demo\.md$/);
  } finally {
    if (prev === undefined) delete process.env.AETHER_WORKSPACE_ROOT;
    else process.env.AETHER_WORKSPACE_ROOT = prev;
  }
});

test("workspace_write dry-run does not touch disk", async () => {
  const prevDry = process.env.AETHER_WORKSPACE_DRY_RUN;
  const prevRoot = process.env.AETHER_WORKSPACE_ROOT;
  const dir = await mkdtemp(path.join(os.tmpdir(), "aether-ws-"));
  try {
    process.env.AETHER_WORKSPACE_DRY_RUN = "1";
    process.env.AETHER_WORKSPACE_ROOT = dir;
    const result = (await workspaceWrite.execute(
      { path: "briefs/demo.md", content: "hello" },
      ctx(),
    )) as Record<string, unknown>;
    assert.equal(result.dryRun, true);
    assert.equal(result.written, true);
    await assert.rejects(() => readFile(path.join(dir, "briefs", "demo.md"), "utf8"));
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_WORKSPACE_DRY_RUN;
    else process.env.AETHER_WORKSPACE_DRY_RUN = prevDry;
    if (prevRoot === undefined) delete process.env.AETHER_WORKSPACE_ROOT;
    else process.env.AETHER_WORKSPACE_ROOT = prevRoot;
    await rm(dir, { recursive: true, force: true });
  }
});

test("workspace_write then workspace_read in a temp root", async () => {
  const prevDry = process.env.AETHER_WORKSPACE_DRY_RUN;
  const prevRoot = process.env.AETHER_WORKSPACE_ROOT;
  const dir = await mkdtemp(path.join(os.tmpdir(), "aether-ws-"));
  try {
    delete process.env.AETHER_WORKSPACE_DRY_RUN;
    process.env.AETHER_WORKSPACE_ROOT = dir;
    const written = (await workspaceWrite.execute(
      { path: "briefs/demo.md", content: "ops brief" },
      ctx(),
    )) as Record<string, unknown>;
    assert.equal(written.dryRun, false);
    assert.equal(written.written, true);
    const onDisk = await readFile(path.join(dir, "briefs", "demo.md"), "utf8");
    assert.equal(onDisk, "ops brief");
    const read = (await workspaceRead.execute({ path: "briefs/demo.md" }, ctx())) as Record<
      string,
      unknown
    >;
    assert.equal(read.content, "ops brief");
    assert.equal(read.bytes, Buffer.byteLength("ops brief", "utf8"));
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_WORKSPACE_DRY_RUN;
    else process.env.AETHER_WORKSPACE_DRY_RUN = prevDry;
    if (prevRoot === undefined) delete process.env.AETHER_WORKSPACE_ROOT;
    else process.env.AETHER_WORKSPACE_ROOT = prevRoot;
    await rm(dir, { recursive: true, force: true });
  }
});

test("workspace_write is irreversible", () => {
  assert.equal(workspaceWrite.irreversible, true);
  assert.equal(workspaceRead.irreversible ?? false, false);
});

test("workspace tools honor an already-aborted signal", async () => {
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () =>
      workspaceWrite.execute(
        { path: "briefs/aborted.md", content: "nope" },
        { ...ctx(), signal: ac.signal },
      ),
    /workspace_write aborted/,
  );
  await assert.rejects(
    () => workspaceRead.execute({ path: "briefs/aborted.md" }, { ...ctx(), signal: ac.signal }),
    /workspace_read aborted/,
  );
});
