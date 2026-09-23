import { randomUUID } from "node:crypto";
import { appendAudit, verifyAuditChain } from "./audit.js";
import { auditBundleToJsonl, buildAuditBundle } from "./export.js";
import { listRuns, loadRun, saveRun } from "./persist.js";
import { summarizeRun, type RunSummary } from "./summary.js";
import type { Agent, Run, Step, ToolContext, Workflow } from "./types.js";
import { resolveStepRetry, computeBackoffMs, sleep } from "./retry.js";
import { normalizeDecisionReason } from "./decision.js";
import { resolveStepTimeoutMs, runWithTimeout } from "./timeout.js";
import { computeApprovalExpiresAt, isApprovalExpired, resolveApprovalTtlMs } from "./expiry.js";
import { resolveWorkflow } from "./workflows/registry.js";
import { archiveRun, unarchiveRun } from "./archive.js";
import { noteRun } from "./note.js";
import { pinRun, unpinRun } from "./pin.js";
import { labelRun, unlabelRun } from "./label.js";

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
  } else if (existing?.completedStepIds?.length) {
    const done = new Set(existing.completedStepIds);
    const idx = waves.findIndex((w) => w.some((s) => !done.has(s.id)));
    startWave = idx < 0 ? waves.length : idx;
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
      run.completedStepIds = [
        ...new Set([...(run.completedStepIds ?? []), ...waves[w].map((s) => s.id)]),
      ];
    }
    run.status = "completed";
    run.finishedAt = new Date().toISOString();
    delete run.pausedStepId;
    delete run.pausedAt;
    delete run.approvalExpiresAt;
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

    if (step.retry && tool.irreversible) {
      throw new Error(`Retry is not allowed on irreversible tool ${tool.name} (step ${step.id})`);
    }

    const alreadyApproved = run.approvedStepIds?.includes(step.id);
    if (tool.irreversible && !workflow.autoApprove && !alreadyApproved) {
      run.status = "awaiting_approval";
      run.pausedStepId = step.id;
      run.pausedAt = new Date().toISOString();
      const ttl = resolveApprovalTtlMs(workflow);
      if (ttl !== undefined) {
        run.approvalExpiresAt = computeApprovalExpiresAt(run.pausedAt, ttl);
      } else {
        delete run.approvalExpiresAt;
      }
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

      const timeoutMs = resolveStepTimeoutMs(step.timeoutMs);
      const retry = resolveStepRetry(step.retry);
      let result: unknown;
      let lastErr: unknown;
      for (let attempt = 1; attempt <= retry.maxAttempts; attempt++) {
        try {
          result = await runWithTimeout(
            (signal) => {
              const ctx: ToolContext = {
                runId: run.id,
                agentId: agent.id,
                stepId: step.id,
                memory: run.memory,
                signal,
                audit: (type, content) =>
                  appendAudit(run, { type, agentId: agent.id, stepId: step.id, content }),
              };
              return tool.execute(data, ctx);
            },
            timeoutMs,
            step.id,
          );
          lastErr = undefined;
          break;
        } catch (err) {
          lastErr = err;
          const message = err instanceof Error ? err.message : String(err);
          appendAudit(run, {
            type: "error",
            agentId: agent.id,
            stepId: step.id,
            content: {
              tool: tool.name,
              attempt,
              maxAttempts: retry.maxAttempts,
              message,
            },
          });
          if (attempt >= retry.maxAttempts) throw err;
          const backoffMs = computeBackoffMs(retry, attempt);
          appendAudit(run, {
            type: "decision",
            agentId: agent.id,
            stepId: step.id,
            content: {
              kind: "retry",
              tool: tool.name,
              attempt,
              nextAttempt: attempt + 1,
              backoffMs,
              strategy: retry.strategy,
              jitter: retry.jitter,
            },
          });
          await sleep(backoffMs);
        }
      }
      if (lastErr) throw lastErr;

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

function markExpired(run: Run, ttlMs: number): Run {
  run.status = "expired";
  run.finishedAt = new Date().toISOString();
  run.error = `Approval expired at step ${run.pausedStepId}`;
  appendAudit(run, {
    type: "decision",
    stepId: run.pausedStepId,
    content: {
      decision: "expire",
      stepId: run.pausedStepId,
      ttlMs,
    },
  });
  appendAudit(run, { type: "run_end", content: { status: run.status } });
  return run;
}

async function expireIfStale(run: Run): Promise<Run | null> {
  const { workflow } = resolveWorkflow(run.workflowId);
  if (!isApprovalExpired(run, workflow)) return null;
  markExpired(run, workflow.approvalTtlMs ?? 0);
  const file = await saveRun(run);
  emitSummary(run, file);
  humanLog(`Run expired: ${run.id}`);
  humanLog(`Persisted: ${file}`);
  return run;
}

/** Close a paused run whose approvalTtlMs has elapsed. */
export async function expireRun(runId: string): Promise<Run> {
  const run = await loadRun(runId);
  if (run.status !== "awaiting_approval") {
    throw new Error(
      `Run ${runId} is ${run.status}, expected awaiting_approval`,
    );
  }
  const expired = await expireIfStale(run);
  if (!expired) {
    throw new Error(`Run ${runId} approval window is still open`);
  }
  return expired;
}

/** Close every paused run whose approval TTL has elapsed. */
export async function expireStaleRuns(): Promise<Run[]> {
  const ids = await listRuns();
  const closed: Run[] = [];
  for (const id of ids) {
    let run: Run;
    try {
      run = await loadRun(id);
    } catch {
      continue;
    }
    if (run.status !== "awaiting_approval") continue;
    const expired = await expireIfStale(run);
    if (expired) closed.push(expired);
  }
  return closed;
}

export async function resumeRun(
  runId: string,
  decision: "approve" | "reject",
  reason?: string,
): Promise<Run> {
  const run = await loadRun(runId);
  if (run.status !== "awaiting_approval") {
    throw new Error(
      `Run ${runId} is ${run.status}, expected awaiting_approval`,
    );
  }
  const stale = await expireIfStale(run);
  if (stale) {
    throw new Error(`Run ${runId} is expired, expected awaiting_approval`);
  }
  const note = normalizeDecisionReason(reason);
  const { workflow, agents } = resolveWorkflow(run.workflowId);

  if (decision === "reject") {
    run.status = "failed";
    run.finishedAt = new Date().toISOString();
    run.error = `Rejected at step ${run.pausedStepId}`;
    appendAudit(run, {
      type: "decision",
      stepId: run.pausedStepId,
      content: {
        decision: "reject",
        stepId: run.pausedStepId,
        ...(note ? { reason: note } : {}),
      },
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
    content: {
      decision: "approve",
      stepId: run.pausedStepId,
      ...(note ? { reason: note } : {}),
    },
  });
  return executeWorkflow(workflow, agents, run);
}

/** Operator abort of a paused run. Distinct from reject (failed). Terminal, no tool execute. */
export async function cancelRun(runId: string, reason?: string): Promise<Run> {
  const run = await loadRun(runId);
  if (run.status !== "awaiting_approval") {
    throw new Error(
      `Run ${runId} is ${run.status}, expected awaiting_approval`,
    );
  }
  const stale = await expireIfStale(run);
  if (stale) {
    throw new Error(`Run ${runId} is expired, expected awaiting_approval`);
  }
  const note = normalizeDecisionReason(reason);
  run.status = "cancelled";
  run.finishedAt = new Date().toISOString();
  run.error = `Cancelled at step ${run.pausedStepId}`;
  appendAudit(run, {
    type: "decision",
    stepId: run.pausedStepId,
    content: {
      decision: "cancel",
      stepId: run.pausedStepId,
      ...(note ? { reason: note } : {}),
    },
  });
  appendAudit(run, { type: "run_end", content: { status: run.status } });
  const file = await saveRun(run);
  emitSummary(run, file);
  humanLog(`Run cancelled: ${run.id}`);
  humanLog(`Persisted: ${file}`);
  return run;
}

/** Continue a failed run from the first wave that is not in completedStepIds. */
export async function retryFailedRun(runId: string): Promise<Run> {
  const run = await loadRun(runId);
  if (run.status !== "failed") {
    throw new Error(`Run ${runId} is ${run.status}, expected failed`);
  }
  const { workflow, agents } = resolveWorkflow(run.workflowId);
  appendAudit(run, {
    type: "decision",
    content: {
      kind: "retry_failed",
      completedStepIds: run.completedStepIds ?? [],
    },
  });
  delete run.finishedAt;
  delete run.error;
  return executeWorkflow(workflow, agents, run);
}

function printUsage(): void {
  console.log(`Aether Forge orchestrator

Usage:
  npm run start:orchestrator [-- --workflow <hello|hitl|http|parallel|wf.*>]
  npm run start:orchestrator -- --list
  npm run start:orchestrator -- --approve <runId> [--reason "..."]
  npm run start:orchestrator -- --reject <runId> [--reason "..."]
  npm run start:orchestrator -- --cancel <runId> [--reason "..."]
  npm run start:orchestrator -- --retry-failed <runId>
  npm run start:orchestrator -- --export-audit <runId>
  npm run start:orchestrator -- --verify-audit <runId>
  npm run start:orchestrator -- --expire <runId>
  npm run start:orchestrator -- --expire-stale
  npm run start:orchestrator -- --archive <runId> [--reason "..."]
  npm run start:orchestrator -- --unarchive <runId> [--reason "..."]
  npm run start:orchestrator -- --note <runId> --reason "..."
  npm run start:orchestrator -- --pin <runId> [--reason "..."]
  npm run start:orchestrator -- --unpin <runId> [--reason "..."]
  npm run start:orchestrator -- --label <runId> --reason <label>
  npm run start:orchestrator -- --unlabel <runId> --reason <label>
  npm run start:orchestrator -- --json --workflow hello

--json prints one RunSummary object to stdout; human logs go to stderr.
--export-audit prints aether-audit-v1 JSONL (header + events) to stdout.
--verify-audit prints the hash-chain report JSON and exits 1 if chain.ok is false.
--expire closes a paused run when workflow.approvalTtlMs has elapsed.
--expire-stale sweeps all paused runs and expires those past TTL.
--archive / --unarchive hide or restore a terminal run without deleting the audit file.
--note appends an operator comment to the audit trail (any status; does not change status).
--pin / --unpin mark a run so lists sort it first. Status unchanged.
--label / --unlabel attach a short operator tag (max 8 per run). Status unchanged.
`);
}


function readReasonFlag(argv: string[]): string | undefined {
  const idx = argv.indexOf("--reason");
  if (idx < 0) return undefined;
  return argv[idx + 1];
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
  const verifyIdx = argv.indexOf("--verify-audit");
  if (verifyIdx >= 0) {
    const id = argv[verifyIdx + 1];
    if (!id) throw new Error("--verify-audit requires a run id");
    const run = await loadRun(id);
    const report = verifyAuditChain(run.audit);
    process.stdout.write(JSON.stringify({ runId: run.id, ...report }) + "\n");
    if (!report.ok) process.exitCode = 1;
    return;
  }
  if (argv.includes("--expire-stale")) {
    const closed = await expireStaleRuns();
    if (jsonMode) {
      console.log(JSON.stringify({ ok: true, expired: closed.map((r) => r.id) }));
      return;
    }
    humanLog(closed.length ? `Expired ${closed.length} run(s)` : "No stale approvals");
    for (const run of closed) humanLog(`  ${run.id}`);
    return;
  }
  const expireIdx = argv.indexOf("--expire");
  if (expireIdx >= 0) {
    const id = argv[expireIdx + 1];
    if (!id) throw new Error("--expire requires a run id");
    await expireRun(id);
    return;
  }
  const approveIdx = argv.indexOf("--approve");
  if (approveIdx >= 0) {
    const id = argv[approveIdx + 1];
    if (!id) throw new Error("--approve requires a run id");
    const run = await resumeRun(id, "approve", readReasonFlag(argv));
    humanLog("Memory keys:", Object.keys(run.memory).join(", ") || "(none)");
    if (run.error) process.exitCode = 1;
    return;
  }
  const rejectIdx = argv.indexOf("--reject");
  if (rejectIdx >= 0) {
    const id = argv[rejectIdx + 1];
    if (!id) throw new Error("--reject requires a run id");
    await resumeRun(id, "reject", readReasonFlag(argv));
    return;
  }
  const cancelIdx = argv.indexOf("--cancel");
  if (cancelIdx >= 0) {
    const id = argv[cancelIdx + 1];
    if (!id) throw new Error("--cancel requires a run id");
    await cancelRun(id, readReasonFlag(argv));
    return;
  }
  const archiveIdx = argv.indexOf("--archive");
  if (archiveIdx >= 0) {
    const id = argv[archiveIdx + 1];
    if (!id) throw new Error("--archive requires a run id");
    const run = await archiveRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Run archived: ${run.id}`);
    return;
  }
  const unarchiveIdx = argv.indexOf("--unarchive");
  if (unarchiveIdx >= 0) {
    const id = argv[unarchiveIdx + 1];
    if (!id) throw new Error("--unarchive requires a run id");
    const run = await unarchiveRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Run unarchived: ${run.id}`);
    return;
  }
  const noteIdx = argv.indexOf("--note");
  if (noteIdx >= 0) {
    const id = argv[noteIdx + 1];
    if (!id) throw new Error("--note requires a run id");
    const run = await noteRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Note appended: ${run.id}`);
    return;
  }
  const pinIdx = argv.indexOf("--pin");
  if (pinIdx >= 0) {
    const id = argv[pinIdx + 1];
    if (!id) throw new Error("--pin requires a run id");
    const run = await pinRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Run pinned: ${run.id}`);
    return;
  }
  const unpinIdx = argv.indexOf("--unpin");
  if (unpinIdx >= 0) {
    const id = argv[unpinIdx + 1];
    if (!id) throw new Error("--unpin requires a run id");
    const run = await unpinRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Run unpinned: ${run.id}`);
    return;
  }
  const labelIdx = argv.indexOf("--label");
  if (labelIdx >= 0) {
    const id = argv[labelIdx + 1];
    if (!id) throw new Error("--label requires a run id");
    const run = await labelRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Labeled: ${run.id} -> ${(run.labels ?? []).join(",")}`);
    return;
  }
  const unlabelIdx = argv.indexOf("--unlabel");
  if (unlabelIdx >= 0) {
    const id = argv[unlabelIdx + 1];
    if (!id) throw new Error("--unlabel requires a run id");
    const run = await unlabelRun(id, readReasonFlag(argv));
    emitSummary(run);
    humanLog(`Unlabeled: ${run.id}`);
    return;
  }
  const retryIdx = argv.indexOf("--retry-failed");
  if (retryIdx >= 0) {
    const id = argv[retryIdx + 1];
    if (!id) throw new Error("--retry-failed requires a run id");
    const run = await retryFailedRun(id);
    humanLog("Memory keys:", Object.keys(run.memory).join(", ") || "(none)");
    if (run.status === "failed") {
      console.error("Error:", run.error);
      process.exitCode = 1;
    }
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
