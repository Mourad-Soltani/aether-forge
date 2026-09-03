import type { Agent, Workflow } from "../types.js";
import {
  httpRequest,
  llmComplete,
  notifyStub,
  researchStub,
  workspaceWrite,
} from "../tools/index.js";

export const verticalFetcher: Agent = {
  id: "agent.vertical.fetcher",
  name: "Vertical Fetcher",
  goal: "Pull a public HTTP signal",
  tools: [httpRequest],
};

export const verticalResearcher: Agent = {
  id: "agent.vertical.researcher",
  name: "Vertical Researcher",
  goal: "Gather an internal brief in parallel with the live fetch",
  tools: [researchStub],
};

export const verticalAnalyst: Agent = {
  id: "agent.vertical.analyst",
  name: "Vertical Analyst",
  goal: "Turn fetch + research into an operator recommendation",
  tools: [llmComplete],
};

export const verticalOperator: Agent = {
  id: "agent.vertical.operator",
  name: "Vertical Operator",
  goal: "Persist the brief and notify ops",
  tools: [workspaceWrite, notifyStub],
};

export const verticalDemoAgents: Agent[] = [
  verticalFetcher,
  verticalResearcher,
  verticalAnalyst,
  verticalOperator,
];

/**
 * One vertical slice of the product thesis:
 * live tool + internal research in parallel → LLM brief → HITL file write → notify.
 * Secret-free when AETHER_LLM_DRY_RUN and AETHER_WORKSPACE_DRY_RUN are set.
 */
export const verticalDemoWorkflow: Workflow = {
  id: "wf.vertical",
  name: "Vertical knowledge-work slice",
  description:
    "Parallel HTTP + research → llm_complete → HITL workspace_write → notify",
  autoApprove: false,
  steps: [
    {
      id: "step.fetch",
      agentId: verticalFetcher.id,
      toolName: "http_request",
      mode: "parallel",
      args: {
        url: "https://jsonplaceholder.typicode.com/posts/1",
        method: "GET",
      },
      writeTo: "http",
    },
    {
      id: "step.research",
      agentId: verticalResearcher.id,
      toolName: "research_stub",
      mode: "parallel",
      args: { topic: "enterprise multi-agent coordination tax" },
      writeTo: "research",
    },
    {
      id: "step.llm",
      agentId: verticalAnalyst.id,
      toolName: "llm_complete",
      args: {
        system: "You write one tight ops paragraph. No secrets.",
        prompt:
          "Draft a one-paragraph action brief from this HTTP payload and research. HTTP: {{memory.http}} Research: {{memory.research}}",
      },
      writeTo: "llm",
    },
    {
      id: "step.write",
      agentId: verticalOperator.id,
      toolName: "workspace_write",
      args: {
        path: "briefs/vertical.md",
        content: "Aether Forge vertical brief (run {{run.id}}): {{memory.llm}}",
      },
      writeTo: "file",
    },
    {
      id: "step.notify",
      agentId: verticalOperator.id,
      toolName: "notify_stub",
      args: {
        channel: "#ops",
        message: "Vertical workflow wrote briefs/vertical.md for run {{run.id}}",
      },
      writeTo: "notify",
    },
  ],
};
