import { z } from "zod";
import type { Tool } from "../types.js";

const HttpArgs = z.object({
  url: z.string().url(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]).default("GET"),
  headers: z.record(z.string()).optional(),
  body: z.unknown().optional(),
  timeoutMs: z.number().int().min(100).max(30_000).optional(),
});

function assertSafeUrl(url: string): URL {
  const parsed = new URL(url);
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Blocked URL protocol: ${parsed.protocol}`);
  }
  return parsed;
}

/** Real HTTP connector. No secrets stored; caller supplies headers if needed. */
export const httpRequest: Tool = {
  name: "http_request",
  description: "Perform an HTTP request (http/https only) and return status + JSON/text body.",
  parameters: HttpArgs,
  async execute(args) {
    const parsed = HttpArgs.parse(args);
    const url = assertSafeUrl(parsed.url);
    const timeoutMs = parsed.timeoutMs ?? 10_000;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const init: RequestInit = {
        method: parsed.method,
        headers: {
          accept: "application/json, text/plain;q=0.9, */*;q=0.1",
          "user-agent": "aether-forge/0.1",
          ...(parsed.headers ?? {}),
        },
        signal: controller.signal,
      };
      if (parsed.body !== undefined && parsed.method !== "GET") {
        init.body =
          typeof parsed.body === "string"
            ? parsed.body
            : JSON.stringify(parsed.body);
        const headers = init.headers as Record<string, string>;
        if (!headers["content-type"] && !headers["Content-Type"]) {
          headers["content-type"] = "application/json";
        }
      }
      const res = await fetch(url, init);
      const text = await res.text();
      let data: unknown = text;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text.slice(0, 4000);
      }
      return {
        ok: res.ok,
        status: res.status,
        url: url.toString(),
        data,
      };
    } finally {
      clearTimeout(timer);
    }
  },
};
