import type { Agent, Workflow } from "../types.js";
import { helloAgents, helloWorkflow, hitlWorkflow } from "./hello.js";
import { httpDemoAgents, httpDemoWorkflow } from "./http-demo.js";
import { githubDemoAgents, githubDemoWorkflow } from "./github-demo.js";
import { slackDemoAgents, slackDemoWorkflow } from "./slack-demo.js";
import { filesDemoAgents, filesDemoWorkflow } from "./files-demo.js";
import { llmDemoAgents, llmDemoWorkflow } from "./llm-demo.js";

export interface RegisteredWorkflow {
  workflow: Workflow;
  agents: Agent[];
}

export const workflowRegistry: Record<string, RegisteredWorkflow> = {
  [helloWorkflow.id]: { workflow: helloWorkflow, agents: helloAgents },
  hello: { workflow: helloWorkflow, agents: helloAgents },
  [hitlWorkflow.id]: { workflow: hitlWorkflow, agents: helloAgents },
  hitl: { workflow: hitlWorkflow, agents: helloAgents },
  [httpDemoWorkflow.id]: { workflow: httpDemoWorkflow, agents: httpDemoAgents },
  http: { workflow: httpDemoWorkflow, agents: httpDemoAgents },
  [githubDemoWorkflow.id]: { workflow: githubDemoWorkflow, agents: githubDemoAgents },
  github: { workflow: githubDemoWorkflow, agents: githubDemoAgents },
  [slackDemoWorkflow.id]: { workflow: slackDemoWorkflow, agents: slackDemoAgents },
  slack: { workflow: slackDemoWorkflow, agents: slackDemoAgents },
  [filesDemoWorkflow.id]: { workflow: filesDemoWorkflow, agents: filesDemoAgents },
  files: { workflow: filesDemoWorkflow, agents: filesDemoAgents },
  [llmDemoWorkflow.id]: { workflow: llmDemoWorkflow, agents: llmDemoAgents },
  llm: { workflow: llmDemoWorkflow, agents: llmDemoAgents },
};

export function resolveWorkflow(id: string): RegisteredWorkflow {
  const found = workflowRegistry[id];
  if (!found) {
    const known = Object.keys(workflowRegistry).join(", ");
    throw new Error(`Unknown workflow "${id}". Known: ${known}`);
  }
  return found;
}
