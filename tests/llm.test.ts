import assert from "node:assert/strict";
import { test } from "node:test";
import { isLlmDryRun, llmComplete, resolveLlmConfig } from "../src/tools/llm.js";
import type { ToolContext } from "../src/types.js";

function ctx(): ToolContext {
  return {
    runId: "run-1",
    agentId: "agent.llm-operator",
    stepId: "step.llm",
    memory: {},
    audit: () => undefined,
  };
}

test("isLlmDryRun reads 1/true/yes", () => {
  const prev = process.env.AETHER_LLM_DRY_RUN;
  try {
    delete process.env.AETHER_LLM_DRY_RUN;
    assert.equal(isLlmDryRun(), false);
    process.env.AETHER_LLM_DRY_RUN = "1";
    assert.equal(isLlmDryRun(), true);
    process.env.AETHER_LLM_DRY_RUN = "true";
    assert.equal(isLlmDryRun(), true);
    process.env.AETHER_LLM_DRY_RUN = "no";
    assert.equal(isLlmDryRun(), false);
  } finally {
    if (prev === undefined) delete process.env.AETHER_LLM_DRY_RUN;
    else process.env.AETHER_LLM_DRY_RUN = prev;
  }
});

test("resolveLlmConfig prefers xAI when XAI_API_KEY is set", () => {
  const prevX = process.env.XAI_API_KEY;
  const prevB = process.env.AETHER_LLM_BASE_URL;
  const prevM = process.env.AETHER_LLM_MODEL;
  const prevK = process.env.AETHER_LLM_API_KEY;
  const prevO = process.env.OPENAI_API_KEY;
  try {
    delete process.env.AETHER_LLM_BASE_URL;
    delete process.env.AETHER_LLM_MODEL;
    delete process.env.AETHER_LLM_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.XAI_API_KEY = "test-key";
    const cfg = resolveLlmConfig();
    assert.equal(cfg.baseUrl, "https://api.x.ai/v1");
    assert.equal(cfg.model, "grok-3");
    assert.equal(cfg.apiKey, "test-key");
  } finally {
    if (prevX === undefined) delete process.env.XAI_API_KEY;
    else process.env.XAI_API_KEY = prevX;
    if (prevB === undefined) delete process.env.AETHER_LLM_BASE_URL;
    else process.env.AETHER_LLM_BASE_URL = prevB;
    if (prevM === undefined) delete process.env.AETHER_LLM_MODEL;
    else process.env.AETHER_LLM_MODEL = prevM;
    if (prevK === undefined) delete process.env.AETHER_LLM_API_KEY;
    else process.env.AETHER_LLM_API_KEY = prevK;
    if (prevO === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = prevO;
  }
});

test("llm_complete dry-run does not require a key", async () => {
  const prevDry = process.env.AETHER_LLM_DRY_RUN;
  const keys = ["AETHER_LLM_API_KEY", "XAI_API_KEY", "OPENAI_API_KEY"] as const;
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  try {
    process.env.AETHER_LLM_DRY_RUN = "1";
    for (const k of keys) delete process.env[k];
    const result = (await llmComplete.execute(
      { prompt: "What should ops automate next?" },
      ctx(),
    )) as Record<string, unknown>;
    assert.equal(result.dryRun, true);
    assert.match(String(result.text), /dry-run/);
    assert.match(String(result.text), /automate/);
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_LLM_DRY_RUN;
    else process.env.AETHER_LLM_DRY_RUN = prevDry;
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test("llm_complete without key or dry-run throws", async () => {
  const prevDry = process.env.AETHER_LLM_DRY_RUN;
  const keys = ["AETHER_LLM_API_KEY", "XAI_API_KEY", "OPENAI_API_KEY"] as const;
  const saved: Record<string, string | undefined> = {};
  for (const k of keys) saved[k] = process.env[k];
  try {
    delete process.env.AETHER_LLM_DRY_RUN;
    for (const k of keys) delete process.env[k];
    await assert.rejects(
      () => llmComplete.execute({ prompt: "should fail" }, ctx()),
      /AETHER_LLM_API_KEY|XAI_API_KEY|OPENAI_API_KEY/,
    );
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_LLM_DRY_RUN;
    else process.env.AETHER_LLM_DRY_RUN = prevDry;
    for (const k of keys) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  }
});

test("llm_complete is not irreversible", () => {
  assert.equal(llmComplete.irreversible ?? false, false);
});
