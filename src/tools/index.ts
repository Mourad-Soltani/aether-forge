import { z } from "zod";
import type { Tool } from "../types.js";
import { httpRequest } from "./http.js";
import { githubCreateIssue } from "./github.js";
import { slackNotify } from "./slack.js";
import { workspaceRead, workspaceWrite } from "./workspace.js";
import { llmComplete } from "./llm.js";

export { httpRequest } from "./http.js";
export { githubCreateIssue } from "./github.js";
export { slackNotify } from "./slack.js";
export { workspaceRead, workspaceWrite } from "./workspace.js";
export { llmComplete } from "./llm.js";

/** Echo / research stub — stands in for a search or knowledge-base tool. */
export const researchStub: Tool = {
  name: "research_stub",
  description: "Mock research tool. Returns a canned brief for a topic.",
  parameters: z.object({
    topic: z.string(),
  }),
  async execute(args) {
    const topic = String(args.topic);
    return {
      topic,
      findings: [
        `${topic}: coordination overhead dominates knowledge-work cost.`,
        "Enterprises lack an auditable multi-agent control plane across tools.",
        "Highest-leverage first workflow: research → summarize → ticket → notify.",
      ],
      sources: ["internal-mock"],
    };
  },
};

export const summarizeStub: Tool = {
  name: "summarize_stub",
  description: "Mock summarizer. Condenses findings into an action brief.",
  parameters: z.object({
    findings: z.unknown(),
  }),
  async execute(args) {
    const findings = args.findings;
    const lines = Array.isArray(findings)
      ? findings.map(String)
      : typeof findings === "object" && findings && "findings" in (findings as object)
        ? ((findings as { findings: unknown[] }).findings ?? []).map(String)
        : [String(findings)];
    return {
      title: "Action brief",
      summary: lines.slice(0, 3).join(" "),
      recommendedAction: "Open an internal ticket and notify the ops channel.",
    };
  },
};

export const createTicketStub: Tool = {
  name: "create_ticket_stub",
  description: "Mock ticket creator (stands in for Jira/Linear/GitHub Issues).",
  parameters: z.object({
    title: z.string(),
    body: z.string(),
  }),
  irreversible: true,
  async execute(args) {
    const id = `TICKET-${Math.floor(1000 + Math.random() * 9000)}`;
    return {
      ticketId: id,
      title: String(args.title),
      url: `https://tickets.local/${id}`,
      status: "open",
    };
  },
};

export const notifyStub: Tool = {
  name: "notify_stub",
  description: "Mock notifier (stands in for Slack/email webhook).",
  parameters: z.object({
    channel: z.string(),
    message: z.string(),
  }),
  async execute(args) {
    return {
      delivered: true,
      channel: String(args.channel),
      preview: String(args.message).slice(0, 200),
    };
  },
};



const failNCounts = new Map<string, number>();

/** Test helper. Throws on the first `failTimes` calls for a given label, then succeeds. */
export const failNStub: Tool = {
  name: "fail_n_stub",
  description: "Test helper. Fails the first failTimes executions for label, then returns ok.",
  parameters: z.object({
    failTimes: z.number().int().nonnegative().max(10),
    label: z.string().min(1).max(64),
  }),
  async execute(args) {
    const label = String(args.label);
    const failTimes = Number(args.failTimes);
    const seen = failNCounts.get(label) ?? 0;
    failNCounts.set(label, seen + 1);
    if (seen < failTimes) {
      throw new Error(`fail_n_stub ${label} attempt ${seen + 1}`);
    }
    return { ok: true, attempts: seen + 1, label };
  },
};

export const sleepStub: Tool = {
  name: "sleep_stub",
  description: "Test helper. Resolves after ms milliseconds. Used to prove step timeouts.",
  parameters: z.object({
    ms: z.number().int().nonnegative().max(30_000),
    label: z.string().optional(),
  }),
  async execute(args, ctx) {
    const ms = Number(args.ms);
    const label = args.label ? String(args.label) : "sleep";
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        ctx.signal?.removeEventListener("abort", onAbort);
        resolve();
      }, ms);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new Error("sleep_stub aborted"));
      };
      if (ctx.signal?.aborted) {
        clearTimeout(timer);
        reject(new Error("sleep_stub aborted"));
        return;
      }
      ctx.signal?.addEventListener("abort", onAbort, { once: true });
    });
    return { sleptMs: ms, label };
  },
};

export const builtinTools: Tool[] = [
  researchStub,
  summarizeStub,
  createTicketStub,
  notifyStub,
  httpRequest,
  githubCreateIssue,
  slackNotify,
  workspaceRead,
  workspaceWrite,
  llmComplete,
  sleepStub,
  failNStub,
];

export function toolsByName(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.name, t]));
}
