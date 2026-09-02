import assert from "node:assert/strict";
import { test } from "node:test";
import { appendAudit, sanitizeAuditContent } from "../src/audit.js";
import type { Run } from "../src/types.js";

test("sanitizeAuditContent redacts PAT and Bearer strings", () => {
  const out = sanitizeAuditContent({
    note: "token github_pat_EXAMPLETOKENVALUE000 and Bearer abc.def",
    nested: { authorization: "Bearer live-secret" },
  }) as Record<string, unknown>;
  const note = String(out.note);
  assert.match(note, /\[redacted-pat\]/);
  assert.doesNotMatch(note, /github_pat_/);
  assert.match(note, /Bearer \[redacted\]/);
  const nested = out.nested as Record<string, unknown>;
  assert.equal(nested.authorization, "[redacted]");
});

test("sanitizeAuditContent redacts secret-shaped keys", () => {
  const out = sanitizeAuditContent({
    GITHUB_TOKEN: "should-not-persist",
    webhookUrl: "https://hooks.slack.com/services/T00/B00/xxx",
    title: "keep me",
  }) as Record<string, unknown>;
  assert.equal(out.GITHUB_TOKEN, "[redacted]");
  assert.equal(out.webhookUrl, "[redacted]");
  assert.equal(out.title, "keep me");
});

test("appendAudit stores sanitized content on the run", () => {
  const run: Run = {
    id: "run-1",
    workflowId: "wf.hello",
    status: "running",
    startedAt: "2026-09-02T00:00:00.000Z",
    memory: {},
    audit: [],
  };
  appendAudit(run, {
    type: "error",
    content: { message: "failed github_pat_EXAMPLETOKENVALUE000" },
  });
  const content = run.audit[0].content as { message: string };
  assert.match(content.message, /\[redacted-pat\]/);
  assert.doesNotMatch(content.message, /github_pat_/);
});
