import assert from "node:assert/strict";
import { test } from "node:test";
import { mergeAbortSignals, throwIfAborted } from "../src/abort.js";

test("throwIfAborted no-ops when signal is missing or live", () => {
  throwIfAborted(undefined, "x");
  throwIfAborted(new AbortController().signal, "x");
});

test("throwIfAborted rejects an aborted signal", () => {
  const ac = new AbortController();
  ac.abort();
  assert.throws(() => throwIfAborted(ac.signal, "tool.x"), /tool.x aborted/);
});

test("mergeAbortSignals aborts when either input aborts", () => {
  const a = new AbortController();
  const b = new AbortController();
  const merged = mergeAbortSignals(a.signal, b.signal);
  assert.equal(merged.aborted, false);
  b.abort();
  assert.equal(merged.aborted, true);
});
