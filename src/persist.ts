import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Run } from "./types.js";

const RUNS_DIR = path.resolve(process.cwd(), "data", "runs");

export async function saveRun(run: Run): Promise<string> {
  await mkdir(RUNS_DIR, { recursive: true });
  const file = path.join(RUNS_DIR, `${run.id}.json`);
  await writeFile(file, JSON.stringify(run, null, 2), "utf8");
  return file;
}
