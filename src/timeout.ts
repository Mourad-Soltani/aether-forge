const MAX_STEP_TIMEOUT_MS = 120_000;

export function resolveStepTimeoutMs(stepTimeoutMs?: number): number | undefined {
  if (stepTimeoutMs === undefined || stepTimeoutMs === null) return undefined;
  if (!Number.isFinite(stepTimeoutMs) || stepTimeoutMs <= 0) {
    throw new Error(`Invalid timeoutMs: ${stepTimeoutMs}`);
  }
  return Math.min(Math.floor(stepTimeoutMs), MAX_STEP_TIMEOUT_MS);
}

export function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  label: string,
): Promise<T> {
  if (timeoutMs === undefined) return promise;
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Step timed out after ${timeoutMs}ms: ${label}`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (err) => {
        clearTimeout(timer);
        reject(err);
      },
    );
  });
}

/** Race work against timeoutMs and abort `signal` when the cap elapses. */
export async function runWithTimeout<T>(
  work: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number | undefined,
  label: string,
): Promise<T> {
  const ac = new AbortController();
  let timer: ReturnType<typeof setTimeout> | undefined;
  if (timeoutMs !== undefined) {
    timer = setTimeout(() => ac.abort(), timeoutMs);
  }
  try {
    return await withTimeout(work(ac.signal), timeoutMs, label);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { MAX_STEP_TIMEOUT_MS };
