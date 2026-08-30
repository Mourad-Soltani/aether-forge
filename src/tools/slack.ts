import { z } from "zod";
import type { Tool } from "../types.js";

const SlackArgs = z.object({
  text: z.string().min(1),
  webhookUrl: z.string().url().optional(),
});

/**
 * Posts a message to a Slack incoming webhook.
 * URL from args.webhookUrl or SLACK_WEBHOOK_URL. Never stored in git.
 */
export const slackNotify: Tool = {
  name: "slack_notify",
  description: "Post text to a Slack incoming webhook (SLACK_WEBHOOK_URL).",
  parameters: SlackArgs,
  async execute(args) {
    const parsed = SlackArgs.parse(args);
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
    return { delivered: true, status: res.status, response: body.slice(0, 200) };
  },
};
