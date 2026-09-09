import type { AuditEvent, Run } from "./types.js";
import { verifyAuditChain, type AuditChainReport } from "./audit.js";

export interface AuditBundle {
  format: "aether-audit-v1";
  exportedAt: string;
  run: {
    id: string;
    workflowId: string;
    status: Run["status"];
    startedAt: string;
    finishedAt?: string;
    pausedStepId?: string;
    error?: string;
    memoryKeys: string[];
    approvedStepIds: string[];
    completedStepIds: string[];
  };
  events: AuditEvent[];
  chain: AuditChainReport;
}

export function buildAuditBundle(run: Run, exportedAt = new Date().toISOString()): AuditBundle {
  const events = run.audit ?? [];
  return {
    format: "aether-audit-v1",
    exportedAt,
    run: {
      id: run.id,
      workflowId: run.workflowId,
      status: run.status,
      startedAt: run.startedAt,
      finishedAt: run.finishedAt,
      pausedStepId: run.pausedStepId,
      error: run.error,
      memoryKeys: Object.keys(run.memory ?? {}),
      approvedStepIds: run.approvedStepIds ?? [],
      completedStepIds: run.completedStepIds ?? [],
    },
    events,
    chain: verifyAuditChain(events),
  };
}

/** One JSON object per line: header, then each audit event. */
export function auditBundleToJsonl(bundle: AuditBundle): string {
  const header = {
    format: bundle.format,
    exportedAt: bundle.exportedAt,
    run: bundle.run,
    eventCount: bundle.events.length,
    chain: bundle.chain,
  };
  const lines = [JSON.stringify(header), ...bundle.events.map((e) => JSON.stringify(e))];
  return lines.join("\n") + "\n";
}
