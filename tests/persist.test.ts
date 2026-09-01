import assert from "node:assert/strict";
import { test } from "node:test";
import { assertRunId } from "../src/persist.js";

test("assertRunId accepts uuid-like and dotted ids", () => {
  assert.equal(assertRunId("abc"), "abc");
  assert.equal(
    assertRunId("a1b2c3d4-e5f6-7890-abcd-ef1234567890"),
    "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  );
  assert.equal(assertRunId("wf.hello_1"), "wf.hello_1");
});

test("assertRunId rejects path traversal and empty", () => {
  assert.throws(() => assertRunId(""), /Invalid run id/);
  assert.throws(() => assertRunId("../etc/passwd"), /Invalid run id/);
  assert.throws(() => assertRunId("foo/bar"), /Invalid run id/);
  assert.throws(() => assertRunId("has space"), /Invalid run id/);
});
