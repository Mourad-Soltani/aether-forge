import type { Agent, Workflow } from "../types.js";
import { httpRequest, summarizeStub, notifyStub } from "../tools/index.js";

export const fetcher: Agent = {
  id: "agent.fetcher",
  name: "Fetcher",
  goal: "Call a real HTTP endpoint and capture the payload",
  tools: [httpRequest],
};

export const analyst: Agent = {
  id: "agent.http-analyst",
  name: "HTTP Analyst",
  goal: "Summarize a live HTTP payload",
  tools: [summarizeStub],
};

export const operator: Agent = {
  id: "agent.http-operator",
  name: "Notifier",
  goal: "Notify that the live fetch completed",
  tools: [notifyStub],
};

export const httpDemoAgents: Agent[] = [fetcher, analyst, operator];

/**
 * Real connector demo. Hits a public JSON API (no token).
 * jsonplaceholder is stable and does not require auth.
 */
export const httpDemoWorkflow: Workflow = {
  id: "wf.http",
  name: "Live HTTP fetch",
  description: "GET jsonplaceholder post → summarize → notify",
  autoApprove: true,
  steps: [
    {
      id: "step.fetch",
      agentId: fetcher.id,
      toolName: "http_request",
      args: {
        url: "https://jsonplaceholder.typicode.com/posts/1",
        method: "GET",
      },
      writeTo: "http",
    },
    {
      id: "step.summarize",
      agentId: analyst.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.http}}" },
      writeTo: "brief",
    },
    {
      id: "step.notify",
      agentId: operator.id,
      toolName: "notify_stub",
      args: {
        channel: "#ops",
        message: "Live HTTP workflow finished: {{memory.brief}}",
      },
      writeTo: "notify",
    },
  ],
};
