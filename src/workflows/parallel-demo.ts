import type { Agent, Workflow } from "../types.js";
import { createTicketStub, researchStub, summarizeStub } from "../tools/index.js";

export const researcherA: Agent = {
  id: "agent.researcher.a",
  name: "Researcher A",
  goal: "Gather brief A",
  tools: [researchStub],
};

export const researcherB: Agent = {
  id: "agent.researcher.b",
  name: "Researcher B",
  goal: "Gather brief B",
  tools: [researchStub],
};

export const analyst: Agent = {
  id: "agent.analyst.parallel",
  name: "Analyst",
  goal: "Merge parallel findings",
  tools: [summarizeStub],
};

export const operator: Agent = {
  id: "agent.operator.parallel",
  name: "Operator",
  goal: "Create tickets",
  tools: [createTicketStub],
};

export const parallelDemoAgents: Agent[] = [researcherA, researcherB, analyst, operator];

/** Two research stubs in one parallel wave, then a sequential summarize. */
export const parallelDemoWorkflow: Workflow = {
  id: "wf.parallel",
  name: "Parallel research wave",
  description: "Two research stubs run concurrently, then summarize",
  autoApprove: true,
  steps: [
    {
      id: "step.research.a",
      agentId: researcherA.id,
      toolName: "research_stub",
      mode: "parallel",
      args: { topic: "audit trails for multi-agent workflows" },
      writeTo: "researchA",
    },
    {
      id: "step.research.b",
      agentId: researcherB.id,
      toolName: "research_stub",
      mode: "parallel",
      args: { topic: "HITL gates for irreversible enterprise tools" },
      writeTo: "researchB",
    },
    {
      id: "step.summarize",
      agentId: analyst.id,
      toolName: "summarize_stub",
      args: { findings: "{{memory.researchA}}" },
      writeTo: "brief",
    },
  ],
};

/** Parallel wave with one irreversible stub so HITL is exercised. */
export const parallelHitlWorkflow: Workflow = {
  id: "wf.parallel.hitl",
  name: "Parallel wave (HITL)",
  description: "Parallel research + ticket stub; pauses before the wave runs",
  autoApprove: false,
  steps: [
    {
      id: "step.research.p",
      agentId: researcherA.id,
      toolName: "research_stub",
      mode: "parallel",
      args: { topic: "parallel HITL" },
      writeTo: "researchA",
    },
    {
      id: "step.ticket.p",
      agentId: "agent.operator.parallel",
      toolName: "create_ticket_stub",
      mode: "parallel",
      args: { title: "Parallel gate", body: "Approve the wave" },
      writeTo: "ticket",
    },
  ],
};
