# Aether Forge

**Private multi-agent OS that turns enterprise tools & data into an autonomous, auditable AI workforce.**

Solves the massive knowledge-work coordination tax. Target: product + early traction → $1B+ exit path within ~12 months.

## Quick start

```bash
npm install
npm run start:orchestrator
npm run start:orchestrator -- --workflow http
npm run start:orchestrator -- --workflow hitl
npm run start:orchestrator -- --list
```

Approve or reject a paused run:

```bash
npm run start:orchestrator -- --approve <runId>
npm run start:orchestrator -- --reject <runId>
```

Dashboard (two terminals):

```bash
npm run start:api
npm run dev:web
# http://localhost:3000
```

Optional env (never commit values):

```
GITHUB_TOKEN=          # enables github_create_issue
AETHER_API_PORT=8787
AETHER_CORS_ORIGIN=http://localhost:3000
NEXT_PUBLIC_AETHER_API_URL=http://127.0.0.1:8787
```

## Project structure

- `src/` – core orchestrator, types, agents, tools
- `src/api.ts` – loopback control API (runs + HITL)
- `src/tools/http.ts` – real HTTP connector
- `src/tools/github.ts` – GitHub Issues connector (env token)
- `apps/web` – Next.js dashboard (runs, audit, approve/reject)
- `packages/` – shared packages
- `PROGRESS.md` – living handoff log (read this first every session)
- `ARCHITECTURE.md` – evolving design

## Daily automation
A Grok automation runs every day at 07:00, loads PROGRESS.md + this repo, continues the highest-priority next task, and updates the handoff.

## License
MIT
