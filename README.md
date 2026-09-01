# Aether Forge

**Private multi-agent OS that turns enterprise tools & data into an autonomous, auditable AI workforce.**

Solves the massive knowledge-work coordination tax. Target: product + early traction → $1B+ exit path within ~12 months.

## Quick start

```bash
npm install
npm run demo                 # hello → http → hitl (no secrets)
npm run start:orchestrator
npm run start:orchestrator -- --workflow http
npm run start:orchestrator -- --workflow hitl
npm run start:orchestrator -- --workflow github
npm run start:orchestrator -- --list
npm run start:orchestrator -- --json --workflow hello
```

`--json` prints one `RunSummary` object to stdout (human logs on stderr). `demo.sh` uses that path so it does not scrape console prose.

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
GITHUB_TOKEN=              # enables github_create_issue
SLACK_WEBHOOK_URL=         # enables slack_notify
AETHER_DEMO_GITHUB_OWNER=Mourad-Soltani
AETHER_DEMO_GITHUB_REPO=aether-forge
AETHER_API_PORT=8787
AETHER_CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_AETHER_API_URL=http://127.0.0.1:8787
NEXT_PUBLIC_AETHER_API_TOKEN=
```

## Project structure

- `src/` – core orchestrator, types, agents, tools
- `src/api.ts` – loopback control API (runs + HITL + optional token)
- `src/auth.ts` – API token check
- `src/tools/http.ts` – real HTTP connector
- `src/tools/github.ts` – GitHub Issues connector (env token)
- `src/tools/slack.ts` – Slack incoming webhook
- `apps/web` – Next.js dashboard (runs, audit, approve/reject, filters, live refresh)
- `demo.sh` – secret-free walkthrough of hello → http → hitl (JSON mode)
- `packages/` – shared packages
- `PROGRESS.md` – living handoff log (read this first every session)
- `ARCHITECTURE.md` – evolving design

## Daily automation
A Grok automation runs every day at 07:00, loads PROGRESS.md + this repo, continues the highest-priority next task, and updates the handoff.

## License
MIT
