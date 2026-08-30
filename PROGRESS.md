# Aether Forge – Progress & Handoff Log

## Project Goal
Private multi-agent OS for enterprises. Turns scattered tools & data into an autonomous, auditable AI workforce that executes end-to-end workflows. Target: strong product + traction → $1B+ exit path within ~12 months.

## Current Status (Session 3 — 2026-08-30)
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
- [x] Thin HTTP API over persist + resume (`src/api.ts`, port 8787)
- [x] Next.js dashboard skeleton (`apps/web`) — run list, audit trail, approve/reject, start workflow
- [ ] Auth + audit log basics (API / UI; file audit exists, API is local-only / no auth yet)
- [ ] First vertical demo with GitHub Issues *executed* against a real repo (tool exists; needs token at runtime)

## Next Up (highest priority)
1. Optional auth gate on the API (local token header) so the dashboard is not an open control plane.
2. Wire `github_create_issue` into a gated demo workflow (still env-token only) and run it once with a human-supplied token outside git.
3. Slack webhook notify tool + polish dashboard UX (filters, live refresh).

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
- Dashboard never reads `data/runs` from the browser. All list/get/approve/reject go through `src/api.ts`.
- API binds to `127.0.0.1:8787` by default (`AETHER_API_PORT`, `AETHER_CORS_ORIGIN`).
- Run ids are restricted to `[a-zA-Z0-9._-]` before filesystem access.

## Handoff for next session
Session 3 lands the local control plane: HTTP API + Next.js run viewer / HITL buttons.

```bash
npm install
npm run start:orchestrator -- --workflow hitl
npm run start:api
# other terminal:
npm run dev:web
# open http://localhost:3000
```

API:
- `GET /health`
- `GET /workflows`
- `GET /runs`
- `GET /runs/:id`
- `POST /runs` `{ "workflowId": "wf.hitl" }`
- `POST /runs/:id/approve`
- `POST /runs/:id/reject`

Next: local API token + GitHub Issues gated demo workflow.

**Security note:** Do not paste PATs into chat or commits. Rotate any token that appeared in a previous session prompt. Prefer GitHub connector with least privilege. API is loopback-only and unauthenticated in this session.
