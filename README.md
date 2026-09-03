# Aether Forge

**Private multi-agent OS that turns enterprise tools & data into an autonomous, auditable AI workforce.**

Solves the massive knowledge-work coordination tax. Target: product + early traction → $1B+ exit path within ~12 months.

## Quick start

```bash
npm install
npm test                     # node:test — RunSummary, persist, audit, connectors
npm run demo                 # hello → http → hitl → github/slack/files/llm dry-run → parallel
npm run start:orchestrator
npm run start:orchestrator -- --workflow http
npm run start:orchestrator -- --workflow hitl
AETHER_GITHUB_DRY_RUN=1 npm run start:orchestrator -- --workflow github
AETHER_SLACK_DRY_RUN=1 npm run start:orchestrator -- --workflow slack
AETHER_WORKSPACE_DRY_RUN=1 npm run start:orchestrator -- --workflow files
AETHER_LLM_DRY_RUN=1 npm run start:orchestrator -- --workflow llm
npm run start:orchestrator -- --workflow parallel
npm run start:orchestrator -- --list
npm run start:orchestrator -- --json --workflow hello
npm run start:orchestrator -- --export-audit <runId>
```

`--json` prints one `RunSummary` object to stdout (human logs on stderr). Schema lives in `src/summary.ts`. `demo.sh` uses that path so it does not scrape console prose.

Approve or reject a paused run:

```bash
npm run start:orchestrator -- --approve <runId>
npm run start:orchestrator -- --reject <runId>
```

Dashboard (two terminals):

```bash
export AETHER_API_TOKEN=dev-local-token   # recommended
npm run start:api
npm run dev:web
# http://localhost:3000 — save the same token in the dashboard
```

Optional env (never commit values):

```
AETHER_API_TOKEN=          # gates the control API
AETHER_GITHUB_DRY_RUN=1    # simulate github_create_issue (no live issue)
AETHER_SLACK_DRY_RUN=1     # simulate slack_notify (no webhook call)
AETHER_WORKSPACE_DRY_RUN=1 # simulate workspace file I/O
AETHER_LLM_DRY_RUN=1        # simulate llm_complete (no provider call)
AETHER_LLM_API_KEY=         # live llm_complete (operator-only)
AETHER_LLM_BASE_URL=        # OpenAI-compatible base (optional)
AETHER_LLM_MODEL=           # default grok-3 if XAI_API_KEY else gpt-4o-mini
AETHER_WORKSPACE_ROOT=     # default ./data/workspace
GITHUB_TOKEN=              # live github_create_issue (operator-only; never paste in chat)
SLACK_WEBHOOK_URL=         # live slack_notify (operator-only; never commit)
AETHER_DEMO_GITHUB_OWNER=Mourad-Soltani
AETHER_DEMO_GITHUB_REPO=aether-forge
AETHER_API_PORT=8787
AETHER_CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_AETHER_API_URL=http://127.0.0.1:8787
NEXT_PUBLIC_AETHER_API_TOKEN=
```

## Project structure

- `src/` – core orchestrator, types, agents, tools
- `src/summary.ts` – `RunSummary` Zod contract + stdout parse helper
- `src/audit.ts` – append-only audit + secret redaction
- `src/export.ts` – `aether-audit-v1` JSON/JSONL bundle (memory values omitted)
- `src/api.ts` – loopback control API (runs + HITL + optional token)
- `src/auth.ts` – API token check
- `src/tools/http.ts` – real HTTP connector
- `src/tools/github.ts` – GitHub Issues connector (env token or dry-run)
- `src/tools/slack.ts` – Slack incoming webhook (env webhook or dry-run; HITL)
- `src/tools/workspace.ts` – sandboxed file read/write (`data/workspace`)
- `src/tools/llm.ts` – OpenAI-compatible chat completion (env key or dry-run)
- `apps/web` – Next.js dashboard (runs, audit, approve/reject, filters, live refresh)
- `demo.sh` – secret-free walkthrough including github/slack/files/llm dry-run
- `tests/` – node:test unit tests
- `packages/` – shared packages
- `PROGRESS.md` – living handoff log (read this first every session)
- `ARCHITECTURE.md` – evolving design

## Daily automation
A Grok automation runs every day at 07:00, loads PROGRESS.md + this repo, continues the highest-priority next task, and updates the handoff.

## License
MIT
