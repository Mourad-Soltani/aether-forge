import { randomUUID } from "node:crypto";
import type { AuditEvent, Run } from "./types.js";

export function appendAudit(
  run: Run,
  partial: Omit<AuditEvent, "id" | "timestamp" | "runId"> & { runId?: string },
): AuditEvent {
  const event: AuditEvent = {
    id: randomUUID(),
    timestamp: new Date().toISOString(),
    runId: run.id,
    ...partial,
  };
  run.audit.push(event);
  return event;
}
