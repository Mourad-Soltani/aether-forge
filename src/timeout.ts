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

export { MAX_STEP_TIMEOUT_MS };
