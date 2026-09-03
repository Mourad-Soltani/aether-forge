import type { Agent, Workflow } from "../types.js";
import { notifyStub, sleepStub } from "../tools/index.js";

export const timeoutDemoAgents: Agent[] = [
  {
    id: "agent.timer",
    name: "Timer",
    goal: "Sleep then notify so timeout behavior can be proven",
    tools: [sleepStub, notifyStub],
  },
];

/** Completes: sleep shorter than timeoutMs. */
export const timeoutOkWorkflow: Workflow = {
  id: "wf.timeout.ok",
  name: "Timeout ok",
  description: "sleep_stub 20ms under a 2000ms cap",
  autoApprove: true,
  steps: [
    {
      id: "step.sleep.ok",
      agentId: "agent.timer",
      toolName: "sleep_stub",
      args: { ms: 20, label: "ok" },
      writeTo: "slept",
      timeoutMs: 2000,
    },
    {
      id: "step.notify.ok",
      agentId: "agent.timer",
      toolName: "notify_stub",
      args: {
        channel: "#ops",
        message: "timeout-ok {{run.id}}",
      },
      writeTo: "notice",
    },
  ],
};

/** Fails: sleep longer than timeoutMs. */
export const timeoutFailWorkflow: Workflow = {
  id: "wf.timeout.fail",
  name: "Timeout fail",
  description: "sleep_stub 400ms with a 40ms cap — run fails",
  autoApprove: true,
  steps: [
    {
      id: "step.sleep.fail",
      agentId: "agent.timer",
      toolName: "sleep_stub",
      args: { ms: 400, label: "fail" },
      writeTo: "slept",
      timeoutMs: 40,
    },
  ],
};
