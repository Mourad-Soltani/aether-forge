import { z } from "zod";
import type { Run } from "./types.js";

export const RunSummarySchema = z.object({
  ok: z.boolean(),
  status: z.enum([
    "pending",
    "running",
    "awaiting_approval",
    "completed",
    "failed",
  ]),
  id: z.string().min(1),
  workflowId: z.string().min(1),
  pausedStepId: z.string().nullable(),
  auditEvents: z.number().int().nonnegative(),
  memoryKeys: z.array(z.string()),
  error: z.string().nullable(),
  persisted: z.string().optional(),
});

export type RunSummary = z.infer<typeof RunSummarySchema>;

export function summarizeRun(run: Run, persisted?: string): RunSummary {
  return RunSummarySchema.parse({
    ok: run.status !== "failed",
    status: run.status,
    id: run.id,
    workflowId: run.workflowId,
    pausedStepId: run.pausedStepId ?? null,
    auditEvents: run.audit.length,
    memoryKeys: Object.keys(run.memory),
    error: run.error ?? null,
    ...(persisted ? { persisted } : {}),
  });
}

/** Same contract as demo.sh: last valid RunSummary JSON line on stdout. */
export function parseRunSummaryFromStdout(raw: string): RunSummary {
  const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
  for (let i = lines.length - 1; i >= 0; i--) {
    try {
      const parsed: unknown = JSON.parse(lines[i]);
      const result = RunSummarySchema.safeParse(parsed);
      if (result.success) return result.data;
    } catch {
      // skip non-JSON / banner lines
    }
  }
  throw new Error("no JSON RunSummary on stdout");
}
