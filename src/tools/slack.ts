import { z } from "zod";
import type { Tool } from "../types.js";

const SlackArgs = z.object({
  text: z.string().min(1),
  webhookUrl: z.string().url().optional(),
});

export function isSlackDryRun(): boolean {
  const v = (process.env.AETHER_SLACK_DRY_RUN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Posts a message to a Slack incoming webhook.
 * URL from args.webhookUrl or SLACK_WEBHOOK_URL. Never stored in git.
 * Set AETHER_SLACK_DRY_RUN=1 to simulate without calling Slack.
 * Marked irreversible so HITL applies unless autoApprove.
 */
export const slackNotify: Tool = {
  name: "slack_notify",
  description:
    "Post text to a Slack incoming webhook. Requires SLACK_WEBHOOK_URL unless AETHER_SLACK_DRY_RUN=1. Irreversible.",
  parameters: SlackArgs,
  irreversible: true,
  async execute(args) {
    const parsed = SlackArgs.parse(args);
    if (isSlackDryRun()) {
      return {
        dryRun: true,
        delivered: true,
        status: 0,
        preview: parsed.text.slice(0, 200),
      };
    }
    const webhook = parsed.webhookUrl || process.env.SLACK_WEBHOOK_URL;
    if (!webhook) {
      throw new Error("slack_notify requires SLACK_WEBHOOK_URL or args.webhookUrl");
    }
    let url: URL;
    try {
      url = new URL(webhook);
    } catch {
      throw new Error("slack_notify webhook URL is invalid");
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      throw new Error("slack_notify only allows http(s) webhooks");
    }
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: parsed.text }),
    });
    const body = await res.text();
    if (!res.ok) {
      throw new Error(`Slack webhook ${res.status}: ${body.slice(0, 200)}`);
    }
    return { dryRun: false, delivered: true, status: res.status, response: body.slice(0, 200) };
  },
};
