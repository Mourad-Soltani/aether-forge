import type { Agent, Workflow } from "../types.js";
import { researchStub, slackNotify, summarizeStub } from "../tools/index.js";

export const slackOperator: Agent = {
  id: "agent.slack-operator",
  name: "Slack Operator",
  goal: "Notify ops after research with an auditable Slack post",
  tools: [researchStub, summarizeStub, slackNotify],
};

export const slackDemoAgents: Agent[] = [slackOperator];

/** HITL-gated Slack notify. Webhook stays in env at execute time. */
export const slackDemoWorkflow: Workflow = {
  id: "wf.slack",
  name: "Slack notify (HITL)",
  description: "Research → brief → slack_notify (pauses for approval)",
  autoApprove: false,
  steps: [
    {
      id: "step.research",
      agentId: slackOperator.id,
      toolName: "research_stub",
      args: { topic: "enterprise multi-agent coordination" },
      writeTo: "research",
    },
    {
      id: "step.summarize",
      agentId: slackOperator.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.research}}" },
      writeTo: "brief",
    },
    {
      id: "step.notify",
      agentId: slackOperator.id,
      toolName: "slack_notify",
      args: {
        text: "Aether Forge demo: {{memory.brief}}",
      },
      writeTo: "notify",
    },
  ],
};
