import type { Agent, Workflow } from "../types.js";
import { githubCreateIssue, researchStub, summarizeStub } from "../tools/index.js";

const owner = process.env.AETHER_DEMO_GITHUB_OWNER ?? "Mourad-Soltani";
const repo = process.env.AETHER_DEMO_GITHUB_REPO ?? "aether-forge";

export const githubOperator: Agent = {
  id: "agent.github-operator",
  name: "GitHub Operator",
  goal: "Open an auditable GitHub issue after research",
  tools: [researchStub, summarizeStub, githubCreateIssue],
};

export const githubDemoAgents: Agent[] = [githubOperator];

/** HITL-gated live GitHub Issues workflow. Token stays in env at execute time. */
export const githubDemoWorkflow: Workflow = {
  id: "wf.github",
  name: "GitHub issue (HITL)",
  description: `Research → brief → create issue on ${owner}/${repo} (pauses for approval)`,
  autoApprove: false,
  steps: [
    {
      id: "step.research",
      agentId: githubOperator.id,
      toolName: "research_stub",
      args: { topic: "enterprise multi-agent coordination" },
      writeTo: "research",
    },
    {
      id: "step.summarize",
      agentId: githubOperator.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.research}}" },
      writeTo: "brief",
    },
    {
      id: "step.issue",
      agentId: githubOperator.id,
      toolName: "github_create_issue",
      args: {
        owner,
        repo,
        title: "Aether Forge demo: stand up auditable AI workforce",
        body: "Opened by wf.github. Brief: {{memory.brief}}",
      },
      writeTo: "issue",
    },
  ],
};
