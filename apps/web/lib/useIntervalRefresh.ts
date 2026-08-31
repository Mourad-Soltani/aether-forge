"use client";

import { useEffect, useRef } from "react";

/** Poll `fn` while `enabled`. Always sends whatever headers the caller uses. */
export function useIntervalRefresh(
  fn: () => void | Promise<void>,
  enabled: boolean,
  ms = 5000,
): void {
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!enabled) return;
    const id = window.setInterval(() => {
      void fnRef.current();
    }, ms);
    return () => window.clearInterval(id);
  }, [enabled, ms]);
}
