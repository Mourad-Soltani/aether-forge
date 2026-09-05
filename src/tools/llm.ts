import { z } from "zod";
import { mergeAbortSignals, throwIfAborted } from "../abort.js";
import type { Tool } from "../types.js";

const LlmArgs = z.object({
  prompt: z.string().min(1).max(16_384),
  system: z.string().max(4_096).optional(),
  model: z.string().min(1).max(120).optional(),
});

export function isLlmDryRun(): boolean {
  const v = (process.env.AETHER_LLM_DRY_RUN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

export function resolveLlmConfig(modelOverride?: string): {
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
} {
  const baseUrl = (
    process.env.AETHER_LLM_BASE_URL ||
    (process.env.XAI_API_KEY ? "https://api.x.ai/v1" : "https://api.openai.com/v1")
  ).replace(/\/+$/, "");
  const apiKey =
    process.env.AETHER_LLM_API_KEY ||
    process.env.XAI_API_KEY ||
    process.env.OPENAI_API_KEY;
  const model =
    modelOverride ||
    process.env.AETHER_LLM_MODEL ||
    (process.env.XAI_API_KEY ? "grok-3" : "gpt-4o-mini");
  return { baseUrl, apiKey, model };
}

/**
 * OpenAI-compatible chat completion.
 * Keys from AETHER_LLM_API_KEY / XAI_API_KEY / OPENAI_API_KEY — never from repo files.
 * AETHER_LLM_DRY_RUN=1 simulates without an HTTP call.
 * Not irreversible (read-only generation).
 */
export const llmComplete: Tool = {
  name: "llm_complete",
  description:
    "Call an OpenAI-compatible chat model. Requires an API key unless AETHER_LLM_DRY_RUN=1.",
  parameters: LlmArgs,
  async execute(args, ctx) {
    const parsed = LlmArgs.parse(args);
    const cfg = resolveLlmConfig(parsed.model);
    throwIfAborted(ctx.signal, "llm_complete");
    if (isLlmDryRun()) {
      return {
        dryRun: true,
        model: cfg.model,
        text: `[dry-run] ${parsed.prompt.slice(0, 160)}`,
      };
    }
    if (!cfg.apiKey) {
      throw new Error(
        "llm_complete requires AETHER_LLM_API_KEY, XAI_API_KEY, or OPENAI_API_KEY",
      );
    }
    const messages: Array<{ role: string; content: string }> = [];
    if (parsed.system) messages.push({ role: "system", content: parsed.system });
    messages.push({ role: "user", content: parsed.prompt });
    const res = await fetch(`${cfg.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        accept: "application/json",
        authorization: `Bearer ${cfg.apiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        temperature: 0.2,
      }),
      signal: mergeAbortSignals(ctx.signal, AbortSignal.timeout(20_000)),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`LLM API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      const msg =
        typeof data.error === "object" &&
        data.error &&
        "message" in (data.error as object)
          ? String((data.error as { message: unknown }).message)
          : typeof data.message === "string"
            ? data.message
            : text.slice(0, 200);
      throw new Error(`LLM API ${res.status}: ${msg}`);
    }
    const choices = data.choices;
    const first =
      Array.isArray(choices) && choices[0] && typeof choices[0] === "object"
        ? (choices[0] as { message?: { content?: unknown } })
        : undefined;
    const content = first?.message?.content;
    return {
      dryRun: false,
      model: cfg.model,
      text: typeof content === "string" ? content : JSON.stringify(content ?? ""),
    };
  },
};
