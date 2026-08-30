import { randomUUID } from "node:crypto";
import { appendAudit } from "./audit.js";
import { saveRun } from "./persist.js";
import type { Agent, Run, Step, ToolContext, Workflow } from "./types.js";
import { helloAgents, helloWorkflow } from "./workflows/hello.js";

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
): Promise<Run> {
  const agentMap = new Map(agents.map((a) => [a.id, a]));
  const run: Run = {
    id: randomUUID(),
    workflowId: workflow.id,
    status: "running",
    startedAt: new Date().toISOString(),
    memory: {},
    audit: [],
  };

  appendAudit(run, {
    type: "run_start",
    content: { workflowId: workflow.id, name: workflow.name },
  });

  try {
    for (const step of workflow.steps) {
      await executeStep(run, workflow, step, agentMap);
    }
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
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
): Promise<void> {
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

  if (tool.irreversible && !workflow.autoApprove) {
    run.status = "awaiting_approval";
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
    throw new Error(
      `Paused for approval: ${tool.name} on step ${step.id}`,
    );
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
}

async function main() {
  console.log("Aether Forge orchestrator — running hello-workflow");
  const run = await executeWorkflow(helloWorkflow, helloAgents);
  console.log("Memory keys:", Object.keys(run.memory).join(", "));
  if (run.error) {
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
