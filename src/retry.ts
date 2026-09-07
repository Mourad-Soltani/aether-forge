const MAX_ATTEMPTS = 5;
const MAX_BACKOFF_MS = 5_000;
const DEFAULT_BACKOFF_MS = 50;

export type RetryStrategy = "linear" | "exponential";

export interface StepRetry {
  maxAttempts: number;
  /** Base delay between attempts. Linear uses this every time; exponential doubles it. */
  backoffMs?: number;
  /** Default linear (Session 17). Exponential is opt-in (Session 24). */
  strategy?: RetryStrategy;
  /**
   * Jitter fraction in [0, 1]. Applied as equal jitter:
   * delay * (1 - jitter + 2 * jitter * rand).
   * 0 (default) keeps the delay deterministic.
   */
  jitter?: number;
}

export interface ResolvedRetry {
  maxAttempts: number;
  backoffMs: number;
  strategy: RetryStrategy;
  jitter: number;
}

export function resolveStepRetry(retry?: StepRetry): ResolvedRetry {
  if (!retry) return { maxAttempts: 1, backoffMs: 0, strategy: "linear", jitter: 0 };
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

  const strategy = retry.strategy ?? "linear";
  if (strategy !== "linear" && strategy !== "exponential") {
    throw new Error(`Invalid retry.strategy: ${String(strategy)}`);
  }

  let jitter = retry.jitter ?? 0;
  if (!Number.isFinite(jitter) || jitter < 0 || jitter > 1) {
    throw new Error(`Invalid retry.jitter: ${retry.jitter}`);
  }

  return { maxAttempts: attempts, backoffMs, strategy, jitter };
}

/** Delay after a failed `attempt` (1-based) before the next try. */
export function computeBackoffMs(
  retry: ResolvedRetry,
  attempt: number,
  rand: () => number = Math.random,
): number {
  if (retry.maxAttempts <= 1 || retry.backoffMs <= 0) return 0;
  const exp = Math.max(0, Math.floor(attempt) - 1);
  let base =
    retry.strategy === "exponential"
      ? retry.backoffMs * Math.pow(2, exp)
      : retry.backoffMs;
  base = Math.min(base, MAX_BACKOFF_MS);
  if (retry.jitter <= 0) return Math.floor(base);
  const r = rand();
  const unit = Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
  const factor = 1 - retry.jitter + 2 * retry.jitter * unit;
  return Math.min(MAX_BACKOFF_MS, Math.max(0, Math.floor(base * factor)));
}

export async function sleep(ms: number): Promise<void> {
  if (ms <= 0) return;
  await new Promise((r) => setTimeout(r, ms));
}

export { MAX_ATTEMPTS, MAX_BACKOFF_MS, DEFAULT_BACKOFF_MS };
