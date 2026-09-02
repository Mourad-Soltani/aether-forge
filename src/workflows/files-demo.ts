import type { Agent, Workflow } from "../types.js";
import { researchStub, summarizeStub, workspaceWrite } from "../tools/index.js";

export const filesOperator: Agent = {
  id: "agent.files-operator",
  name: "Files Operator",
  goal: "Persist an action brief into the sandboxed workspace",
  tools: [researchStub, summarizeStub, workspaceWrite],
};

export const filesDemoAgents: Agent[] = [filesOperator];

/** HITL-gated workspace write. Stays inside data/workspace. */
export const filesDemoWorkflow: Workflow = {
  id: "wf.files",
  name: "Workspace file write (HITL)",
  description: "Research → brief → workspace_write (pauses for approval)",
  autoApprove: false,
  steps: [
    {
      id: "step.research",
      agentId: filesOperator.id,
      toolName: "research_stub",
      args: { topic: "enterprise multi-agent coordination" },
      writeTo: "research",
    },
    {
      id: "step.summarize",
      agentId: filesOperator.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.research}}" },
      writeTo: "brief",
    },
    {
      id: "step.write",
      agentId: filesOperator.id,
      toolName: "workspace_write",
      args: {
        path: "briefs/demo.md",
        content: "Aether Forge brief: {{memory.brief}}",
      },
      writeTo: "file",
    },
  ],
};
