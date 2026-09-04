import { z } from "zod";

export const ToolCallSchema = z.object({
  toolName: z.string(),
  args: z.record(z.any()),
});

export const AuditEventSchema = z.object({
  id: z.string(),
  timestamp: z.string(),
  runId: z.string().optional(),
  agentId: z.string().optional(),
  stepId: z.string().optional(),
  type: z.enum([
    "thought",
    "tool_call",
    "tool_result",
    "decision",
    "error",
    "human_input",
    "run_start",
    "run_end",
  ]),
  content: z.any(),
});

export type ToolCall = z.infer<typeof ToolCallSchema>;
export type AuditEvent = z.infer<typeof AuditEventSchema>;

export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed";

export interface ToolContext {
  runId: string;
  agentId: string;
  stepId: string;
  memory: Record<string, unknown>;
  audit: (type: AuditEvent["type"], content: unknown) => void;
}

export interface Tool {
  name: string;
  description: string;
  parameters: z.ZodTypeAny;
  irreversible?: boolean;
  execute: (args: Record<string, unknown>, ctx: ToolContext) => Promise<unknown>;
}

export interface Agent {
  id: string;
  name: string;
  goal: string;
  tools: Tool[];
  systemPrompt?: string;
}

export interface Step {
  id: string;
  agentId: string;
  toolName: string;
  args: Record<string, unknown>;
  /** Write tool result into run memory under this key. */
  writeTo?: string;
  mode?: "sequential" | "parallel";
  /** Orchestrator-level cap for this step's execute(). Does not abort the underlying I/O. */
  timeoutMs?: number;
  /** Transient-failure retries. Not allowed on irreversible tools. */
  retry?: { maxAttempts: number; backoffMs?: number };
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: Step[];
  /** If true, skip HITL pause for irreversible tools (demos / CI). */
  autoApprove?: boolean;
}

export interface Run {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  memory: Record<string, unknown>;
  audit: AuditEvent[];
  error?: string;
  /** Step that triggered HITL pause. */
  pausedStepId?: string;
  /** Steps already approved for this run. */
  approvedStepIds?: string[];
}
