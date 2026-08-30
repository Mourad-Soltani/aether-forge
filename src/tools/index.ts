import { z } from "zod";
import type { Tool } from "../types.js";

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

export const builtinTools: Tool[] = [
  researchStub,
  summarizeStub,
  createTicketStub,
  notifyStub,
];

export function toolsByName(tools: Tool[]): Map<string, Tool> {
  return new Map(tools.map((t) => [t.name, t]));
}
