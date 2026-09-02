import assert from "node:assert/strict";
import { test } from "node:test";
import { isSlackDryRun, slackNotify } from "../src/tools/slack.js";
import type { ToolContext } from "../src/types.js";

function ctx(): ToolContext {
  return {
    runId: "run-1",
    agentId: "agent.slack-operator",
    stepId: "step.notify",
    memory: {},
    audit: () => undefined,
  };
}

test("isSlackDryRun reads 1/true/yes", () => {
  const prev = process.env.AETHER_SLACK_DRY_RUN;
  try {
    delete process.env.AETHER_SLACK_DRY_RUN;
    assert.equal(isSlackDryRun(), false);
    process.env.AETHER_SLACK_DRY_RUN = "1";
    assert.equal(isSlackDryRun(), true);
    process.env.AETHER_SLACK_DRY_RUN = "true";
    assert.equal(isSlackDryRun(), true);
    process.env.AETHER_SLACK_DRY_RUN = "no";
    assert.equal(isSlackDryRun(), false);
  } finally {
    if (prev === undefined) delete process.env.AETHER_SLACK_DRY_RUN;
    else process.env.AETHER_SLACK_DRY_RUN = prev;
  }
});

test("slack_notify dry-run does not require a webhook", async () => {
  const prevDry = process.env.AETHER_SLACK_DRY_RUN;
  const prevHook = process.env.SLACK_WEBHOOK_URL;
  try {
    process.env.AETHER_SLACK_DRY_RUN = "1";
    delete process.env.SLACK_WEBHOOK_URL;
    const result = (await slackNotify.execute(
      { text: "ops: dry-run notify" },
      ctx(),
    )) as Record<string, unknown>;
    assert.equal(result.dryRun, true);
    assert.equal(result.delivered, true);
    assert.equal(result.status, 0);
    assert.match(String(result.preview), /dry-run notify/);
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_SLACK_DRY_RUN;
    else process.env.AETHER_SLACK_DRY_RUN = prevDry;
    if (prevHook === undefined) delete process.env.SLACK_WEBHOOK_URL;
    else process.env.SLACK_WEBHOOK_URL = prevHook;
  }
});

test("slack_notify without webhook or dry-run throws", async () => {
  const prevDry = process.env.AETHER_SLACK_DRY_RUN;
  const prevHook = process.env.SLACK_WEBHOOK_URL;
  try {
    delete process.env.AETHER_SLACK_DRY_RUN;
    delete process.env.SLACK_WEBHOOK_URL;
    await assert.rejects(
      () => slackNotify.execute({ text: "should fail" }, ctx()),
      /SLACK_WEBHOOK_URL/,
    );
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_SLACK_DRY_RUN;
    else process.env.AETHER_SLACK_DRY_RUN = prevDry;
    if (prevHook === undefined) delete process.env.SLACK_WEBHOOK_URL;
    else process.env.SLACK_WEBHOOK_URL = prevHook;
  }
});

test("slack_notify is irreversible", () => {
  assert.equal(slackNotify.irreversible, true);
});
