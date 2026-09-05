import assert from "node:assert/strict";
import { test } from "node:test";
import { githubCreateIssue, isGithubDryRun } from "../src/tools/github.js";
import type { ToolContext } from "../src/types.js";

function ctx(): ToolContext {
  return {
    runId: "run-1",
    agentId: "agent.github-operator",
    stepId: "step.issue",
    memory: {},
    audit: () => undefined,
  };
}

test("isGithubDryRun reads 1/true/yes", () => {
  const prev = process.env.AETHER_GITHUB_DRY_RUN;
  try {
    delete process.env.AETHER_GITHUB_DRY_RUN;
    assert.equal(isGithubDryRun(), false);
    process.env.AETHER_GITHUB_DRY_RUN = "1";
    assert.equal(isGithubDryRun(), true);
    process.env.AETHER_GITHUB_DRY_RUN = "true";
    assert.equal(isGithubDryRun(), true);
    process.env.AETHER_GITHUB_DRY_RUN = "no";
    assert.equal(isGithubDryRun(), false);
  } finally {
    if (prev === undefined) delete process.env.AETHER_GITHUB_DRY_RUN;
    else process.env.AETHER_GITHUB_DRY_RUN = prev;
  }
});

test("github_create_issue dry-run does not require a token", async () => {
  const prevDry = process.env.AETHER_GITHUB_DRY_RUN;
  const prevTok = process.env.GITHUB_TOKEN;
  const prevGh = process.env.GH_TOKEN;
  try {
    process.env.AETHER_GITHUB_DRY_RUN = "1";
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    const result = (await githubCreateIssue.execute(
      {
        owner: "Mourad-Soltani",
        repo: "aether-forge",
        title: "dry-run issue",
      },
      ctx(),
    )) as Record<string, unknown>;
    assert.equal(result.dryRun, true);
    assert.equal(result.issueNumber, 0);
    assert.equal(result.title, "dry-run issue");
    assert.match(String(result.url), /issues\/dry-run$/);
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_GITHUB_DRY_RUN;
    else process.env.AETHER_GITHUB_DRY_RUN = prevDry;
    if (prevTok === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevTok;
    if (prevGh === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = prevGh;
  }
});

test("github_create_issue honors an already-aborted signal", async () => {
  const ac = new AbortController();
  ac.abort();
  await assert.rejects(
    () =>
      githubCreateIssue.execute(
        { owner: "Mourad-Soltani", repo: "aether-forge", title: "aborted" },
        { ...ctx(), signal: ac.signal },
      ),
    /github_create_issue aborted/,
  );
});

test("github_create_issue without token or dry-run throws", async () => {
  const prevDry = process.env.AETHER_GITHUB_DRY_RUN;
  const prevTok = process.env.GITHUB_TOKEN;
  const prevGh = process.env.GH_TOKEN;
  try {
    delete process.env.AETHER_GITHUB_DRY_RUN;
    delete process.env.GITHUB_TOKEN;
    delete process.env.GH_TOKEN;
    await assert.rejects(
      () =>
        githubCreateIssue.execute(
          {
            owner: "Mourad-Soltani",
            repo: "aether-forge",
            title: "should fail",
          },
          ctx(),
        ),
      /GITHUB_TOKEN/,
    );
  } finally {
    if (prevDry === undefined) delete process.env.AETHER_GITHUB_DRY_RUN;
    else process.env.AETHER_GITHUB_DRY_RUN = prevDry;
    if (prevTok === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = prevTok;
    if (prevGh === undefined) delete process.env.GH_TOKEN;
    else process.env.GH_TOKEN = prevGh;
  }
});
