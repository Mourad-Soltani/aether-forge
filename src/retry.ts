const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 5_000;
const DEFAULT_BACKOFF_MS = 50;

export interface StepRetry {
  maxAttempts: number;
  backoffMs?: number;
}

export interface ResolvedRetry {
  maxAttempts: number;
  backoffMs: number;
}

export function resolveStepRetry(retry?: StepRetry): ResolvedRetry {
  if (!retry) return { maxAttempts: 1, backoffMs: 0 };
  const maxAttempts = retry.maxAttempts;
  if (!Number.isFinite(maxAttempts) || maxAttempts < 1) {
    throw new Error(`Invalid retry.maxAttempts: ${maxAttempts}`);
  }
  const attempts = Math.min(Math.floor(maxAttempts), MAX_ATTEMPTS);
  let backoffMs = retry.backoffMs ?? DEFAULT_BACKOFF_MS;
  if (!Number.isFinite(backoffMs) || backoffMs < 0) {
    throw new Error(`Invalid retry.backoffMs: ${retry.backoffMs}`);
  }
  backoffMs = Math.min(Math.floor(backoffMs), MAX_BACKOFF_MS);
  return { maxAttempts: attempts, backoffMs };
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

export { MAX_ATTEMPTS, MAX_BACKOFF_MS, DEFAULT_BACKOFF_MS };
