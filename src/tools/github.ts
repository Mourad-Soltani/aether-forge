import { z } from "zod";
import type { Tool } from "../types.js";

const CreateIssueArgs = z.object({
  owner: z.string().min(1),
  repo: z.string().min(1),
  title: z.string().min(1),
  body: z.string().optional(),
  labels: z.array(z.string()).optional(),
});

export function isGithubDryRun(): boolean {
  const v = (process.env.AETHER_GITHUB_DRY_RUN ?? "").trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

/**
 * Creates a GitHub Issue via REST API.
 * Token is read from GITHUB_TOKEN or GH_TOKEN env — never from repo files.
 * Set AETHER_GITHUB_DRY_RUN=1 to simulate without calling GitHub.
 */
export const githubCreateIssue: Tool = {
  name: "github_create_issue",
  description:
    "Create a GitHub issue. Requires GITHUB_TOKEN unless AETHER_GITHUB_DRY_RUN=1. Irreversible.",
  parameters: CreateIssueArgs,
  irreversible: true,
  async execute(args) {
    const parsed = CreateIssueArgs.parse(args);
    if (isGithubDryRun()) {
      return {
        dryRun: true,
        issueNumber: 0,
        title: parsed.title,
        url: `https://github.com/${parsed.owner}/${parsed.repo}/issues/dry-run`,
        state: "open",
      };
    }
    const token = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
    if (!token) {
      throw new Error(
        "github_create_issue requires GITHUB_TOKEN (or GH_TOKEN) in the environment",
      );
    }
    const url = `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(parsed.repo)}/issues`;
    const res = await fetch(url, {
      method: "POST",
      headers: {
        accept: "application/vnd.github+json",
        authorization: `Bearer ${token}`,
        "content-type": "application/json",
        "user-agent": "aether-forge/0.1",
        "x-github-api-version": "2022-11-28",
      },
      body: JSON.stringify({
        title: parsed.title,
        body: parsed.body ?? "",
        labels: parsed.labels,
      }),
    });
    const text = await res.text();
    let data: Record<string, unknown> = {};
    try {
      data = text ? (JSON.parse(text) as Record<string, unknown>) : {};
    } catch {
      throw new Error(`GitHub API returned non-JSON (${res.status}): ${text.slice(0, 200)}`);
    }
    if (!res.ok) {
      throw new Error(
        `GitHub API ${res.status}: ${typeof data.message === "string" ? data.message : text.slice(0, 200)}`,
      );
    }
    return {
      dryRun: false,
      issueNumber: data.number,
      title: data.title,
      url: data.html_url,
      state: data.state,
    };
  },
};
