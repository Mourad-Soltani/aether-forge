import type { Agent, Workflow } from "../types.js";
import {
  createTicketStub,
  notifyStub,
  researchStub,
  summarizeStub,
} from "../tools/index.js";

export const researcher: Agent = {
  id: "agent.researcher",
  name: "Researcher",
  goal: "Gather a short brief on a topic",
  tools: [researchStub],
};

export const analyst: Agent = {
  id: "agent.analyst",
  name: "Analyst",
  goal: "Turn findings into an action brief",
  tools: [summarizeStub],
};

export const operator: Agent = {
  id: "agent.operator",
  name: "Operator",
  goal: "Create a ticket and notify stakeholders",
  tools: [createTicketStub, notifyStub],
};

export const helloAgents: Agent[] = [researcher, analyst, operator];

/** Vertical slice: research → summarize → create ticket → notify. */
export const helloWorkflow: Workflow = {
  id: "wf.hello",
  name: "Hello workforce",
  description: "Mocked research → summarize → ticket → notify",
  autoApprove: true,
  steps: [
    {
      id: "step.research",
      agentId: researcher.id,
      toolName: "research_stub",
      args: { topic: "enterprise multi-agent coordination" },
      writeTo: "research",
    },
    {
      id: "step.summarize",
      agentId: analyst.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.research}}" },
      writeTo: "brief",
    },
    {
      id: "step.ticket",
      agentId: operator.id,
      toolName: "create_ticket_stub",
      args: {
        title: "Stand up auditable AI workforce control plane",
        body: "Action brief: {{memory.brief}}",
      },
      writeTo: "ticket",
    },
    {
      id: "step.notify",
      agentId: operator.id,
      toolName: "notify_stub",
      args: {
        channel: "#ops",
        message: "Ticket opened: {{memory.ticket}}",
      },
      writeTo: "notify",
    },
  ],
};

/** Same graph as hello, but HITL is enforced on the irreversible ticket step. */
export const hitlWorkflow: Workflow = {
  ...helloWorkflow,
  id: "wf.hitl",
  name: "Hello workforce (HITL)",
  description: "Same as hello-workflow but pauses on create_ticket_stub",
  autoApprove: false,
};
