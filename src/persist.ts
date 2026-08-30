import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Run } from "./types.js";

export const RUNS_DIR = path.resolve(process.cwd(), "data", "runs");

const RUN_ID_RE = /^[a-zA-Z0-9._-]+$/;

export function assertRunId(runId: string): string {
  if (!runId || !RUN_ID_RE.test(runId)) {
    throw new Error("Invalid run id");
  }
  return runId;
}

export async function saveRun(run: Run): Promise<string> {
  await mkdir(RUNS_DIR, { recursive: true });
  const file = path.join(RUNS_DIR, `${assertRunId(run.id)}.json`);
  await writeFile(file, JSON.stringify(run, null, 2), "utf8");
  return file;
}

export async function loadRun(runId: string): Promise<Run> {
  const file = path.join(RUNS_DIR, `${assertRunId(runId)}.json`);
  const raw = await readFile(file, "utf8");
  return JSON.parse(raw) as Run;
}

export async function listRuns(): Promise<string[]> {
  await mkdir(RUNS_DIR, { recursive: true });
  const files = await readdir(RUNS_DIR);
  return files
    .filter((f) => f.endsWith(".json"))
    .map((f) => f.replace(/\.json$/, ""));
}

export interface RunSummary {
  id: string;
  workflowId: string;
  status: Run["status"];
  startedAt: string;
  finishedAt?: string;
  pausedStepId?: string;
  auditCount: number;
  error?: string;
}

export async function listRunSummaries(): Promise<RunSummary[]> {
  const ids = await listRuns();
  const rows: RunSummary[] = [];
  for (const id of ids) {
    try {
      const run = await loadRun(id);
      rows.push({
        id: run.id,
        workflowId: run.workflowId,
        status: run.status,
        startedAt: run.startedAt,
        finishedAt: run.finishedAt,
        pausedStepId: run.pausedStepId,
        auditCount: run.audit?.length ?? 0,
        error: run.error,
      });
    } catch {
      // skip unreadable files
    }
  }
  rows.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return rows;
}
