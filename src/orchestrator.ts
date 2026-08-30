import { randomUUID } from "node:crypto";
import { appendAudit } from "./audit.js";
import { listRuns, loadRun, saveRun } from "./persist.js";
import type { Agent, Run, Step, ToolContext, Workflow } from "./types.js";
import { resolveWorkflow } from "./workflows/registry.js";

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

  const startIndex = existing?.pausedStepId
    ? Math.max(
        0,
        workflow.steps.findIndex((s) => s.id === existing.pausedStepId),
      )
    : 0;

  try {
    for (let i = startIndex; i < workflow.steps.length; i++) {
      const step = workflow.steps[i];
      const outcome = await executeStep(run, workflow, step, agentMap);
      if (outcome === "paused") {
        const file = await saveRun(run);
        console.log(`Run ${run.status}: ${run.id}`);
        console.log(`Paused at step: ${run.pausedStepId}`);
        console.log(`Resume: npm run start:orchestrator -- --approve ${run.id}`);
        console.log(`Reject: npm run start:orchestrator -- --reject ${run.id}`);
        console.log(`Persisted: ${file}`);
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
  console.log(`Run ${run.status}: ${run.id}`);
  console.log(`Audit events: ${run.audit.length}`);
  console.log(`Persisted: ${file}`);
  return run;
}

async function executeStep(
  run: Run,
  workflow: Workflow,
  step: Step,
  agentMap: Map<string, Agent>,
): Promise<"ok" | "paused"> {
  const agent = agentMap.get(step.agentId);
  if (!agent) throw new Error(`Unknown agent: ${step.agentId}`);

  const tool = agent.tools.find((t) => t.name === step.toolName);
  if (!tool) {
    throw new Error(`Agent ${agent.id} has no tool ${step.toolName}`);
  }

  const args = interpolate(step.args, run) as Record<string, unknown>;
  const parsed = tool.parameters.safeParse(args);
  if (!parsed.success) {
    throw new Error(
      `Invalid args for ${tool.name}: ${parsed.error.message}`,
    );
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
      },
    });
    return "paused";
  }

  appendAudit(run, {
    type: "tool_call",
    agentId: agent.id,
    stepId: step.id,
    content: { tool: tool.name, args: parsed.data },
  });

  const ctx: ToolContext = {
    runId: run.id,
    agentId: agent.id,
    stepId: step.id,
    memory: run.memory,
    audit: (type, content) =>
      appendAudit(run, { type, agentId: agent.id, stepId: step.id, content }),
  };

  const result = await tool.execute(
    parsed.data as Record<string, unknown>,
    ctx,
  );

  appendAudit(run, {
    type: "tool_result",
    agentId: agent.id,
    stepId: step.id,
    content: { tool: tool.name, result },
  });

  if (step.writeTo) {
    run.memory[step.writeTo] = result;
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
    console.log(`Run rejected: ${run.id}`);
    console.log(`Persisted: ${file}`);
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
  npm run start:orchestrator [-- --workflow <hello|hitl|http|wf.*>]
  npm run start:orchestrator -- --list
  npm run start:orchestrator -- --approve <runId>
  npm run start:orchestrator -- --reject <runId>
`);
}

async function main() {
  const argv = process.argv.slice(2);
  if (argv.includes("--help") || argv.includes("-h")) {
    printUsage();
    return;
  }
  if (argv.includes("--list")) {
    const ids = await listRuns();
    console.log(ids.length ? ids.join("\n") : "(no runs yet)");
    return;
  }
  const approveIdx = argv.indexOf("--approve");
  if (approveIdx >= 0) {
    const id = argv[approveIdx + 1];
    if (!id) throw new Error("--approve requires a run id");
    const run = await resumeRun(id, "approve");
    console.log("Memory keys:", Object.keys(run.memory).join(", ") || "(none)");
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
  console.log(`Aether Forge orchestrator — running ${workflow.id}`);
  const run = await executeWorkflow(workflow, agents);
  console.log("Memory keys:", Object.keys(run.memory).join(", ") || "(none)");
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
    console.error(err);
    process.exit(1);
  });
}
