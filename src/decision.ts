/** Operator notes attached to HITL decisions. Never treat as a secret store. */

export const MAX_DECISION_REASON = 500;

export function normalizeDecisionReason(input?: string | null): string | undefined {
  if (input == null) return undefined;
  const stripped = input.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!stripped) return undefined;
  return stripped.slice(0, MAX_DECISION_REASON);
}
