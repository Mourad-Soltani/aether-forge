# Aether Forge – Progress & Handoff Log

## Project Goal
Private multi-agent OS for enterprises. Turns scattered tools & data into an autonomous, auditable AI workforce that executes end-to-end workflows. Target: strong product + traction → $1B+ exit path within ~12 months.

## Current Status (Session 2 — 2026-08-30)
- [x] Repository created
- [x] Initial structure + core docs
- [x] Define detailed architecture & agent runtime MVP (v0.1 in ARCHITECTURE.md)
- [x] Implement first tool connectors (stub): research, summarize, create_ticket, notify
- [x] Build simple orchestrator that can run a multi-step workflow (sequential + audit + JSON persist)
- [x] Session 1 committed to main (`5393f40`)
- [x] Real HTTP tool (`http_request`) — http/https only, timeout, JSON/text body
- [x] Optional GitHub Issues connector (`github_create_issue`) — token from `GITHUB_TOKEN` / `GH_TOKEN` env only
- [x] HITL resume path: pause is `awaiting_approval` (not failed); CLI `--approve` / `--reject` / `--list`
- [x] Live HTTP demo workflow `wf.http` (jsonplaceholder, no secrets)
- [x] HITL demo workflow `wf.hitl` (same graph as hello, `autoApprove: false`)
- [ ] Web dashboard skeleton (Next.js)
- [ ] Auth + audit log basics (API / UI; file audit exists)
- [ ] First vertical demo with GitHub Issues *executed* against a real repo (tool exists; needs token at runtime)

## Next Up (highest priority)
1. Scaffold `apps/web` Next.js dashboard that lists `data/runs/*.json` and shows the audit trail + approve/reject.
2. Thin HTTP API in front of persist + resume (so the dashboard is not reading files from the browser).
3. Optional: wire `github_create_issue` into a gated demo workflow (still env-token only).

## Decisions So Far
- Stack: TypeScript (Node) for orchestrator + core, Next.js for dashboard.
- Agents are autonomous but always produce audit trails.
- Human-in-the-loop for irreversible actions by default.
- Start private / self-hostable; later add cloud multi-tenant.
- v0.1 execution is scripted sequential (explicit workflow graph). LLM planner comes after the engine is solid.
- Persistence for MVP: `data/runs/<runId>.json`.
- Arg interpolation: `{{memory.<key>}}` and `{{run.id}}` only.
- Hello-workflow uses `autoApprove: true` so daily CI / headless runs complete.
- HTTP tool blocks non-http(s) URLs. GitHub issue create is irreversible and refuses to run without env token.
- HITL pause stores `pausedStepId` + `approvedStepIds` on the Run; resume continues from that step.
- Workflow registry keys: `hello` / `wf.hello`, `hitl` / `wf.hitl`, `http` / `wf.http`.

## Handoff for next session
Session 2 lands real HTTP + GitHub Issues tools and a working HITL approve/reject CLI.

```bash
npm install
npm run start:orchestrator
npm run start:orchestrator -- --workflow http
npm run start:orchestrator -- --workflow hitl
npm run start:orchestrator -- --list
npm run start:orchestrator -- --approve <runId>
```

Next: Next.js dashboard skeleton over persisted runs.

**Security note:** Do not paste PATs into chat or commits. Rotate any token that appeared in a previous session prompt. Prefer GitHub connector with `contents:write`.
