# Aether Forge – Progress & Handoff Log

## Project Goal
Private multi-agent OS for enterprises. Turns scattered tools & data into an autonomous, auditable AI workforce that executes end-to-end workflows. Target: strong product + traction → $1B+ exit path within ~12 months.

## Current Status (Session 1 — 2026-08-30)
- [x] Repository created
- [x] Initial structure + core docs
- [x] Define detailed architecture & agent runtime MVP (v0.1 in ARCHITECTURE.md)
- [x] Implement first tool connectors (stub): research, summarize, create_ticket, notify
- [x] Build simple orchestrator that can run a multi-step workflow (sequential + audit + JSON persist)
- [x] Session 1 committed to main (`5393f40`)
- [ ] Web dashboard skeleton (Next.js)
- [ ] Auth + audit log basics (API / UI; file audit exists)
- [ ] First vertical demo with at least one *real* connector (currently all mocked)

## Next Up (highest priority)
1. Add a real HTTP tool + optional GitHub Issues connector (token from env, no secrets in repo).
2. Wire HITL resume path for `awaiting_approval` runs (CLI flag or small HTTP endpoint).
3. Scaffold `apps/web` Next.js dashboard that lists `data/runs/*.json` and shows the audit trail.

## Decisions So Far
- Stack: TypeScript (Node) for orchestrator + core, Next.js for dashboard.
- Agents are autonomous but always produce audit trails.
- Human-in-the-loop for irreversible actions by default.
- Start private / self-hostable; later add cloud multi-tenant.
- v0.1 execution is scripted sequential (explicit workflow graph). LLM planner comes after the engine is solid.
- Persistence for MVP: `data/runs/<runId>.json`.
- Arg interpolation: `{{memory.<key>}}` and `{{run.id}}` only.
- Hello-workflow uses `autoApprove: true` so daily CI / headless runs complete.

## Handoff for next session
Session 1 is on `main` (`5393f40`). Runnable with `npm install && npm run start:orchestrator` (4 mocked tools, audit log, JSON persist). Next: one real connector (HTTP or GitHub Issues) and/or HITL resume, then dashboard skeleton.

**Security note:** A PAT was used once to land this commit after connector 403. Rotate/revoke that PAT; do not paste tokens into chat again. Prefer reconnecting the GitHub connector with `contents:write`.
