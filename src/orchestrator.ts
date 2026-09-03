import { randomUUID } from "node:crypto";
import { appendAudit } from "./audit.js";
import { auditBundleToJsonl, buildAuditBundle } from "./export.js";
import { listRuns, loadRun, saveRun } from "./persist.js";
import { summarizeRun, type RunSummary } from "./summary.js";
import type { Agent, Run, Step, ToolContext, Workflow } from "./types.js";
import { resolveWorkflow } from "./workflows/registry.js";

export type { RunSummary };
export { summarizeRun };

let jsonMode = false;

function humanLog(...args: unknown[]): void {
  if (jsonMode) console.error(...args);
  else console.log(...args);
}

function emitSummary(run: Run, persisted?: string): void {
  if (jsonMode) {
    console.log(JSON.stringify(summarizeRun(run, persisted)));
    return;
  }
  humanLog(`Run ${run.status}: ${run.id}`);
}

function interpolate(value: unknown, run: Run): unknown {
  if (typeof value !== "string") {
    if (Array.isArray(value)) return value.map((v) => interpolate(v, run));
    if (value && typeof value === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = interpolate(v, run);
      }
      return out;
    }
    return value;
  }
  if (value === "{{run.id}}") return run.id;
  const memMatch = value.match(/^\{\{memory\.([a-zA-Z0-9_]+)\}\}$/);
  if (memMatch) return run.memory[memMatch[1]];
  return value.replace(/\{\{run\.id\}\}/g, run.id).replace(
    /\{\{memory\.([a-zA-Z0-9_]+)\}\}/g,
    (_, key: string) => {
      const v = run.memory[key];
      return typeof v === "string" ? v : JSON.stringify(v ?? null);
    },
  );
}

/** Consecutive `mode: "parallel"` steps form one wave. Everything else is a solo wave. */
export function groupWaves(steps: Step[]): Step[][] {
  const waves: Step[][] = [];
  for (const step of steps) {
    const last = waves[waves.length - 1];
    if (step.mode === "parallel" && last && last.every((s) => s.mode === "parallel")) {
      last.push(step);
    } else {
      waves.push([step]);
    }
  }
  return waves;
}

export async function executeWorkflow(
  workflow: Workflow,
  agents: Agent[],
  existing?: Run,
): Promise<Run> {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const run: Run = existing ?? {
    id: randomUUID(),
    workflowId: workflow.id,
    status: "running",
    startedAt: new Date().toISOString(),
    memory: {},
    audit: [],
    approvedStepIds: [],
  };

  run.status = "running";
  delete run.error;
  delete run.finishedAt;

  if (!existing) {
    appendAudit(run, {
      type: "run_start",
      content: { workflowId: workflow.id, name: workflow.name },
    });
  }

  const waves = groupWaves(workflow.steps);
  let startWave = 0;
  if (existing?.pausedStepId) {
    const idx = waves.findIndex((w) => w.some((s) => s.id === existing.pausedStepId));
    startWave = Math.max(0, idx);
  }

  try {
    for (let w = startWave; w < waves.length; w++) {
      const outcome = await executeWave(run, workflow, waves[w], agentMap);
      if (outcome === "paused") {
        const file = await saveRun(run);
        emitSummary(run, file);
        humanLog(`Paused at step: ${run.pausedStepId}`);
        humanLog(`Resume: npm run start:orchestrator -- --approve ${run.id}`);
        humanLog(`Reject: npm run start:orchestrator -- --reject ${run.id}`);
        humanLog(`Persisted: ${file}`);
        return run;
      }
    }
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    delete run.pausedStepId;
    appendAudit(run, {
      type: "run_end",
      content: { status: run.status },
    });
  } catch (err) {
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    run.error = err instanceof Error ? err.message : String(err);
    appendAudit(run, { type: "error", content: { message: run.error } });
    appendAudit(run, { type: "run_end", content: { status: run.status } });
  }

  const file = await saveRun(run);
  emitSummary(run, file);
  humanLog(`Audit events: ${run.audit.length}`);
  humanLog(`Persisted: ${file}`);
  return run;
}

async function executeWave(
  run: Run,
  workflow: Workflow,
  wave: Step[],
  agentMap: Map<string, Agent>,
): Promise<"ok" | "paused"> {
  const prepared: Array<{
    step: Step;
    agent: Agent;
    tool: Agent["tools"][number];
    data: Record<string, unknown>;
  }> = [];

  for (const step of wave) {
    const agent = agentMap.get(step.agentId);
    if (!agent) throw new Error(`Unknown agent: ${step.agentId}`);

    const tool = agent.tools.find((t) => t.name === step.toolName);
    if (!tool) {
      throw new Error(`Agent ${agent.id} has no tool ${step.toolName}`);
    }

    const args = interpolate(step.args, run) as Record<string, unknown>;
    const parsed = tool.parameters.safeParse(args);
    if (!parsed.success) {
      throw new Error(`Invalid args for ${tool.name}: ${parsed.error.message}`);
    }

    const alreadyApproved = run.approvedStepIds?.includes(step.id);
    if (tool.irreversible && !workflow.autoApprove && !alreadyApproved) {
      run.status = "awaiting_approval";
      run.pausedStepId = step.id;
      appendAudit(run, {
        type: "human_input",
        agentId: agent.id,
        stepId: step.id,
        content: {
          reason: "irreversible tool requires approval",
          tool: tool.name,
          args: parsed.data,
          waveSize: wave.length,
        },
      });
      return "paused";
    }

    prepared.push({
      step,
      agent,
      tool,
      data: parsed.data as Record<string, unknown>,
    });
  }

  if (wave.length > 1) {
    appendAudit(run, {
      type: "decision",
      content: {
        kind: "parallel_wave",
        stepIds: wave.map((s) => s.id),
      },
    });
  }

  const results = await Promise.all(
    prepared.map(async ({ step, agent, tool, data }) => {
      appendAudit(run, {
        type: "tool_call",
        agentId: agent.id,
        stepId: step.id,
        content: { tool: tool.name, args: data },
      });

      const ctx: ToolContext = {
        runId: run.id,
        agentId: agent.id,
        stepId: step.id,
        memory: run.memory,
        audit: (type, content) =>
          appendAudit(run, { type, agentId: agent.id, stepId: step.id, content }),
      };

      const result = await tool.execute(data, ctx);

      appendAudit(run, {
        type: "tool_result",
        agentId: agent.id,
        stepId: step.id,
        content: { tool: tool.name, result },
      });

      return { step, result };
    }),
  );

  for (const { step, result } of results) {
    if (step.writeTo) {
      run.memory[step.writeTo] = result;
    }
  }
  return "ok";
}

export async function resumeRun(
  runId: string,
  decision: "approve" | "reject",
): Promise<Run> {
  const run = await loadRun(runId);
  if (run.status !== "awaiting_approval") {
    throw new Error(
      `Run ${runId} is ${run.status}, expected awaiting_approval`,
    );
  }
  const { workflow, agents } = resolveWorkflow(run.workflowId);

  if (decision === "reject") {
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    run.error = `Rejected at step ${run.pausedStepId}`;
    appendAudit(run, {
      type: "decision",
      stepId: run.pausedStepId,
      content: { decision: "reject", stepId: run.pausedStepId },
    });
    appendAudit(run, { type: "run_end", content: { status: run.status } });
    const file = await saveRun(run);
    emitSummary(run, file);
    humanLog(`Run rejected: ${run.id}`);
    humanLog(`Persisted: ${file}`);
    return run;
  }

  run.approvedStepIds = [
    ...new Set([...(run.approvedStepIds ?? []), run.pausedStepId ?? ""]),
  ].filter(Boolean);
  appendAudit(run, {
    type: "decision",
    stepId: run.pausedStepId,
    content: { decision: "approve", stepId: run.pausedStepId },
  });
  return executeWorkflow(workflow, agents, run);
}

function printUsage(): void {
  console.log(`Aether Forge orchestrator

Usage:
  npm run start:orchestrator [-- --workflow <hello|hitl|http|parallel|wf.*>]
  npm run start:orchestrator -- --list
  npm run start:orchestrator -- --approve <runId>
  npm run start:orchestrator -- --reject <runId>
  npm run start:orchestrator -- --export-audit <runId>
  npm run start:orchestrator -- --json --workflow hello

--json prints one RunSummary object to stdout; human logs go to stderr.
--export-audit prints aether-audit-v1 JSONL (header + events) to stdout.
`);
}

async function main() {
  const argv = process.argv.slice(2);
  jsonMode = argv.includes("--json");
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }
  if (argv.includes("--list")) {
    const ids = await listRuns();
    if (jsonMode) {
      console.log(JSON.stringify({ ok: true, runs: ids }));
      return;
    }
    console.log(ids.length ? ids.join("\n") : "(no runs yet)");
    return;
  }
  const exportIdx = argv.indexOf("--export-audit");
  if (exportIdx >= 0) {
    const id = argv[exportIdx + 1];
    if (!id) throw new Error("--export-audit requires a run id");
    const run = await loadRun(id);
    process.stdout.write(auditBundleToJsonl(buildAuditBundle(run)));
    return;
  }
  const approveIdx = argv.indexOf("--approve");
  if (approveIdx >= 0) {
    const id = argv[approveIdx + 1];
    if (!id) throw new Error("--approve requires a run id");
    const run = await resumeRun(id, "approve");
    humanLog("Memory keys:", Object.keys(run.memory).join(", ") || "(none)");
    if (run.error) process.exitCode = 1;
    return;
  }
  const rejectIdx = argv.indexOf("--reject");
  if (rejectIdx >= 0) {
    const id = argv[rejectIdx + 1];
    if (!id) throw new Error("--reject requires a run id");
    await resumeRun(id, "reject");
    return;
  }
  const wfIdx = argv.indexOf("--workflow");
  const workflowId = wfIdx >= 0 ? argv[wfIdx + 1] : "hello";
  if (!workflowId) throw new Error("--workflow requires an id");
  const { workflow, agents } = resolveWorkflow(workflowId);
  humanLog(`Aether Forge orchestrator — running ${workflow.id}`);
  const run = await executeWorkflow(workflow, agents);
  humanLog("Memory keys:", Object.keys(run.memory).join(", ") || "(none)");
  if (run.status === "failed") {
    console.error("Error:", run.error);
    process.exitCode = 1;
  }
}

const isDirect =
  process.argv[1]?.includes("orchestrator") ||
  process.argv[1]?.endsWith("orchestrator.ts") ||
  process.argv[1]?.endsWith("orchestrator.js");

if (isDirect) {
  main().catch((err) => {
    if (jsonMode) {
      console.log(
        JSON.stringify({
          ok: false,
          status: "failed",
          id: null,
          error: err instanceof Error ? err.message : String(err),
        }),
      );
    } else {
      console.error(err);
    }
    process.exit(1);
  });
}
