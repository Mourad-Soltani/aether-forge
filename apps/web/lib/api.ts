export const API_BASE =
  process.env.NEXT_PUBLIC_AETHER_API_URL ?? "http://127.0.0.1:8787";

export type RunStatus =
  | "pending"
  | "running"
  | "awaiting_approval"
  | "completed"
  | "failed";

export interface RunSummary {
  id: string;
  workflowId: string;
  status: RunStatus;
  startedAt: string;
  finishedAt?: string;
  pausedStepId?: string;
  auditCount: number;
  error?: string;
}

export interface AuditEvent {
  id: string;
  timestamp: string;
  runId?: string;
  agentId?: string;
  stepId?: string;
  type: string;
  content: unknown;
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
  pausedStepId?: string;
  approvedStepIds?: string[];
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
    cache: "no-store",
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? `HTTP ${res.status}`);
  }
  return data as T;
}

export function fetchRuns() {
  return request<{ runs: RunSummary[] }>("/runs");
}

export function fetchRun(id: string) {
  return request<{ run: Run }>(`/runs/${id}`);
}

export function startRun(workflowId: string) {
  return request<{ run: Run }>("/runs", {
    method: "POST",
    body: JSON.stringify({ workflowId }),
  });
}

export function decideRun(id: string, decision: "approve" | "reject") {
  return request<{ run: Run }>(`/runs/${id}/${decision}`, { method: "POST" });
}

export function fetchWorkflows() {
  return request<{ workflows: { id: string; name: string; description?: string }[] }>(
    "/workflows",
  );
}
