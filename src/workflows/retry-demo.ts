import type { Agent, Workflow } from "../types.js";
import { failNStub, notifyStub } from "../tools/index.js";

export const retryDemoAgents: Agent[] = [
  {
    id: "agent.retry",
    name: "Retry",
    goal: "Prove step retries recover from transient tool failures",
    tools: [failNStub, notifyStub],
  },
];

/** Completes after two failures then success (maxAttempts 3). */
export const retryOkWorkflow: Workflow = {
  id: "wf.retry.ok",
  name: "Retry ok",
  description: "fail_n_stub fails twice, third attempt succeeds",
  autoApprove: true,
  steps: [
    {
      id: "step.retry.ok",
      agentId: "agent.retry",
      toolName: "fail_n_stub",
      args: { failTimes: 2, label: "demo-ok" },
      writeTo: "recovered",
      retry: { maxAttempts: 3, backoffMs: 10 },
    },
    {
      id: "step.notify.retry",
      agentId: "agent.retry",
      toolName: "notify_stub",
      args: {
        channel: "#ops",
        message: "retry-ok {{run.id}}",
      },
      writeTo: "notice",
    },
  ],
};

/** Exhausts retries and fails the run. */
export const retryFailWorkflow: Workflow = {
  id: "wf.retry.fail",
  name: "Retry fail",
  description: "fail_n_stub always fails; maxAttempts 2 then run fails",
  autoApprove: true,
  steps: [
    {
      id: "step.retry.fail",
      agentId: "agent.retry",
      toolName: "fail_n_stub",
      args: { failTimes: 5, label: "demo-fail" },
      writeTo: "recovered",
      retry: { maxAttempts: 2, backoffMs: 10 },
    },
  ],
};
