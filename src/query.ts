import { filterByLabel } from "./label.js";
import type { RunStatus } from "./types.js";

export const LIST_STATUSES: readonly RunStatus[] = [
  "pending",
  "running",
  "awaiting_approval",
  "completed",
  "failed",
  "cancelled",
  "expired",
];

export type ArchivedFilter = "all" | "hide" | "only";

export interface RunListQuery {
  label?: string;
  status?: string;
  workflow?: string;
  q?: string;
  archived?: string;
}

export interface NormalizedRunListQuery {
  label?: string;
  status?: RunStatus;
  workflow?: string;
  q?: string;
  archived: ArchivedFilter;
}

const ARCHIVED: readonly ArchivedFilter[] = ["all", "hide", "only"];

export function parseArchivedFilter(raw?: string): ArchivedFilter {
  if (raw === undefined || raw === "" || raw === "all") return "all";
  const value = raw.trim().toLowerCase();
  if ((ARCHIVED as readonly string[]).includes(value)) return value as ArchivedFilter;
  throw new Error("archived must be all, hide, or only");
}

export function parseStatusFilter(raw?: string): RunStatus | undefined {
  if (raw === undefined || raw === "" || raw === "all") return undefined;
  const value = raw.trim();
  if (!(LIST_STATUSES as readonly string[]).includes(value)) {
    throw new Error(`Unknown status filter: ${raw}`);
  }
  return value as RunStatus;
}

export function normalizeRunListQuery(input: RunListQuery = {}): NormalizedRunListQuery {
  const workflow =
    input.workflow === undefined || input.workflow === "" || input.workflow === "all"
      ? undefined
      : input.workflow.trim();
  const q =
    input.q === undefined || input.q.trim() === ""
      ? undefined
      : input.q.trim().toLowerCase();
  return {
    label: input.label,
    status: parseStatusFilter(input.status),
    workflow,
    q,
    archived: parseArchivedFilter(input.archived),
  };
}

export function filterRunSummaries<
  T extends {
    id: string;
    workflowId: string;
    status: string;
    labels?: string[];
    archivedAt?: string;
  },
>(rows: T[], raw: RunListQuery = {}): T[] {
  const q = normalizeRunListQuery(raw);
  let out = filterByLabel(rows, q.label);
  if (q.status) out = out.filter((r) => r.status === q.status);
  if (q.workflow) out = out.filter((r) => r.workflowId === q.workflow);
  if (q.q) out = out.filter((r) => r.id.toLowerCase().includes(q.q!));
  if (q.archived === "hide") out = out.filter((r) => !r.archivedAt);
  if (q.archived === "only") out = out.filter((r) => Boolean(r.archivedAt));
  return out;
}
