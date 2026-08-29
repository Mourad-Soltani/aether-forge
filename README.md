# Aether Forge

**Private multi-agent OS that turns enterprise tools & data into an autonomous, auditable AI workforce.**

Solves the massive knowledge-work coordination tax. Target: product + early traction → $1B+ exit path within ~12 months.

## Quick start (after bootstrap)

```bash
npm install
npm run start:orchestrator
```

## Project structure

- `src/` – core orchestrator, types, agents, tools
- `apps/web` – Next.js dashboard (coming)
- `packages/` – shared packages
- `PROGRESS.md` – living handoff log (read this first every session)
- `ARCHITECTURE.md` – evolving design

## Daily automation
A Grok automation runs every day at 07:00, loads PROGRESS.md + this repo, continues the highest-priority next task, and updates the handoff.

## License
MIT
