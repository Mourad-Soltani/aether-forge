import type { Agent, Workflow } from "../types.js";
import { llmComplete, researchStub, summarizeStub } from "../tools/index.js";

export const llmOperator: Agent = {
  id: "agent.llm-operator",
  name: "LLM Operator",
  goal: "Turn a research brief into a short operator-facing recommendation",
  tools: [researchStub, summarizeStub, llmComplete],
};

export const llmDemoAgents: Agent[] = [llmOperator];

/** Secret-free when AETHER_LLM_DRY_RUN=1. Live path is env-gated. */
export const llmDemoWorkflow: Workflow = {
  id: "wf.llm",
  name: "LLM complete (dry-run friendly)",
  description: "Research → brief → llm_complete",
  autoApprove: true,
  steps: [
    {
      id: "step.research",
      agentId: llmOperator.id,
      toolName: "research_stub",
      args: { topic: "enterprise multi-agent coordination" },
      writeTo: "research",
    },
    {
      id: "step.summarize",
      agentId: llmOperator.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.research}}" },
      writeTo: "brief",
    },
    {
      id: "step.llm",
      agentId: llmOperator.id,
      toolName: "llm_complete",
      args: {
        system: "You write one tight paragraph for an ops lead. No secrets.",
        prompt: "Recommend the next workflow to automate. Brief: {{memory.brief}}",
      },
      writeTo: "llm",
    },
  ],
};
