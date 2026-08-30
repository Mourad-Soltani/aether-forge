# Aether Forge – Progress & Handoff Log

## Project Goal
Private multi-agent OS for enterprises. Turns scattered tools & data into an autonomous, auditable AI workforce that executes end-to-end workflows. Target: strong product + traction → $1B+ exit path within ~12 months.

## Current Status (Session 4 — 2026-08-31)
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
- [x] Optional API auth gate (`AETHER_API_TOKEN`) — `X-Aether-Token` or `Authorization: Bearer`; `/health` stays open
- [x] Dashboard token field (localStorage) + `NEXT_PUBLIC_AETHER_API_TOKEN`
- [x] Slack incoming-webhook tool (`slack_notify`)
- [x] Gated GitHub Issues demo workflow `wf.github` / `github` (HITL; env token at execute time)
- [ ] First vertical demo with GitHub Issues *executed* against a real repo (workflow exists; needs human-supplied token outside git)
- [ ] Dashboard polish (filters, live refresh)

## Next Up (highest priority)
1. Execute `wf.github` once with a human-supplied least-privilege token **outside git/chat**. Confirm HITL pause → approve → issue URL in audit.
2. Optional Slack demo path when `SLACK_WEBHOOK_URL` is present (do not commit the URL).
3. Dashboard filters + interval refresh; keep auth header on every client call.

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
- Workflow registry keys: `hello` / `wf.hello`, `hitl` / `wf.hitl`, `http` / `wf.http`, `github` / `wf.github`.
- Dashboard never reads `data/runs` from the browser. All list/get/approve/reject go through `src/api.ts`.
- API binds to `127.0.0.1:8787` by default (`AETHER_API_PORT`, `AETHER_CORS_ORIGIN`).
- Run ids are restricted to `[a-zA-Z0-9._-]` before filesystem access.
- If `AETHER_API_TOKEN` is unset the API stays open (loopback + warning in listen log). If set, all routes except `/health` and `OPTIONS` require the token.
- Dashboard may store the API token in `localStorage` (`aether.apiToken`) for local use only.
- `wf.github` target repo defaults to `Mourad-Soltani/aether-forge` via `AETHER_DEMO_GITHUB_OWNER` / `AETHER_DEMO_GITHUB_REPO`.
- Slack webhook tool only accepts http(s). No secrets in repo.

## Handoff for next session
Session 4 lands the local auth gate + Slack tool + GitHub HITL workflow definition.

```bash
npm install
export AETHER_API_TOKEN=dev-local-token   # optional but recommended
npm run start:api
# other terminal:
npm run dev:web
# open http://localhost:3000 — paste the same token, Save token
npm run start:orchestrator -- --workflow github
# approve after pause (requires GITHUB_TOKEN in that process env):
# npm run start:orchestrator -- --approve <runId>
```

API:
- `GET /health` (open; reports `authRequired`)
- `GET /workflows` (gated)
- `GET /runs`
- `GET /runs/:id`
- `POST /runs` `{ "workflowId": "wf.hitl" | "wf.github" | ... }`
- `POST /runs/:id/approve`
- `POST /runs/:id/reject`

Headers when gated: `X-Aether-Token: <token>` or `Authorization: Bearer <token>`.

Next: live GitHub issue execution with a rotated, least-privilege token that is never pasted into chat or commits.

**Security note:** Do not paste PATs into chat or commits. Rotate any token that appeared in a previous session prompt. Prefer GitHub connector with least privilege (`issues:write` on one repo).
