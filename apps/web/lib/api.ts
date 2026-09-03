export const API_BASE =
  process.env.NEXT_PUBLIC_AETHER_API_URL ?? "http://127.0.0.1:8787";

const TOKEN_STORAGE_KEY = "aether.apiToken";

export function getStoredApiToken(): string {
  if (typeof window === "undefined") return "";
  return window.localStorage.getItem(TOKEN_STORAGE_KEY) ?? "";
}

export function setStoredApiToken(token: string): void {
  if (typeof window === "undefined") return;
  const trimmed = token.trim();
  if (!trimmed) window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  else window.localStorage.setItem(TOKEN_STORAGE_KEY, trimmed);
}

function resolveToken(): string | undefined {
  const fromEnv = process.env.NEXT_PUBLIC_AETHER_API_TOKEN?.trim();
  if (fromEnv) return fromEnv;
  const stored = getStoredApiToken().trim();
  return stored || undefined;
}

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
  const token = resolveToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (token) headers["X-Aether-Token"] = token;
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
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

export function fetchAuditBundle(id: string) {
  return request<{ bundle: { format: string; exportedAt: string; run: unknown; events: AuditEvent[] } }>(
    `/runs/${id}/audit`,
  );
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
