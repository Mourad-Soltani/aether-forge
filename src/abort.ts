/** Throw if the step AbortSignal is already aborted. */
export function throwIfAborted(signal: AbortSignal | undefined, label: string): void {
  if (signal?.aborted) {
    throw new Error(`${label} aborted`);
  }
}

/** Merge a step signal with an optional local timeout controller. */
export function mergeAbortSignals(
  step: AbortSignal | undefined,
  local?: AbortSignal,
): AbortSignal {
  const signals = [step, local].filter((s): s is AbortSignal => Boolean(s));
  if (signals.length === 0) return new AbortController().signal;
  if (signals.length === 1) return signals[0];
  if (typeof AbortSignal.any === "function") {
    return AbortSignal.any(signals);
  }
  const ac = new AbortController();
  const onAbort = () => ac.abort();
  for (const s of signals) {
    if (s.aborted) {
      ac.abort();
      break;
    }
    s.addEventListener("abort", onAbort, { once: true });
  }
  return ac.signal;
}
