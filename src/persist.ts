import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Run } from "./types.js";

export const RUNS_DIR = path.resolve(process.cwd(), "data", "runs");

export async function saveRun(run: Run): Promise<string> {
  await mkdir(RUNS_DIR, { recursive: true });
  const file = path.join(RUNS_DIR, `${run.id}.json`);
  await writeFile(file, JSON.stringify(run, null, 2), "utf8");
  return file;
}

export async function loadRun(runId: string): Promise<Run> {
  const file = path.join(RUNS_DIR, `${runId}.json`);
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
