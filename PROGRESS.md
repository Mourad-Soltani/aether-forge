# Aether Forge – Progress & Handoff Log

## Project Goal
Private multi-agent OS for enterprises. Turns scattered tools & data into an autonomous, auditable AI workforce that executes end-to-end workflows. Target: strong product + traction → $1B+ exit path within ~12 months.

## Current Status (Session 15 — 2026-09-03)
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
- [x] Dashboard filters (status + workflow) + 5s live refresh toggle on list and run detail
- [x] Awaiting-approval count badge; live poll stops on terminal run statuses (detail page)
- [x] Packaging / demo script (`demo.sh` + `npm run demo`) walks hello → http → hitl without secrets
- [x] Orchestrator `--json` flag (Session 7) — one `RunSummary` on stdout; human logs on stderr; `demo.sh` parses JSON instead of scraping console text
- [x] Session 8 — `src/summary.ts` Zod `RunSummary` contract + `parseRunSummaryFromStdout`; `npm test` via `tsx --test tests/*.test.ts`
- [x] Session 9 — `AETHER_GITHUB_DRY_RUN` simulates `github_create_issue` (no live issue, no token). Audit redaction in `appendAudit`. `demo.sh` now includes `wf.github` dry-run pause → approve.
- [x] Session 10 — `AETHER_SLACK_DRY_RUN` simulates `slack_notify`. `slack_notify` is irreversible. `wf.slack` HITL workflow. `demo.sh` includes slack dry-run pause → approve. Tests in `tests/slack.test.ts`.
- [x] Session 11 — sandboxed `workspace_read` / `workspace_write` (`data/workspace` or `AETHER_WORKSPACE_ROOT`). `workspace_write` is irreversible. `wf.files` HITL. `AETHER_WORKSPACE_DRY_RUN`. Tests in `tests/workspace.test.ts`. `demo.sh` includes files dry-run pause → approve.
- [x] Session 12 — env-gated `llm_complete` (OpenAI-compatible). `AETHER_LLM_DRY_RUN` simulates without a provider call. `wf.llm` autoApprove demo. `demo.sh` includes llm dry-run. Tests in `tests/llm.test.ts`.
- [x] Session 13 — parallel waves (`mode: "parallel"` consecutive steps via `Promise.all`). HITL checked before the wave starts. `wf.parallel` + `wf.parallel.hitl`. Tests in `tests/parallel.test.ts`. `demo.sh` includes `wf.parallel`.
- [x] Session 14 — audit export: `src/export.ts` `aether-audit-v1` bundle, CLI `--export-audit`, `GET /runs/:id/audit`, dashboard download. Memory values omitted; events already redacted. Tests in `tests/export.test.ts`. `demo.sh` checks JSONL header.
- [x] Session 15 — vertical compose workflow `wf.vertical` / `vertical`: parallel live HTTP + research → `llm_complete` → HITL `workspace_write` → notify. Tests in `tests/vertical.test.ts`. `demo.sh` includes vertical dry-run pause → approve.
- [ ] First GitHub Issues *executed* against a real repo (workflow exists; needs human-supplied **rotated** token **outside git/chat**)
- [ ] Slack live path when operator sets `SLACK_WEBHOOK_URL` locally
- [ ] Real (non-dry-run) workspace write against local `data/workspace` is available without secrets; optional operator proof
- [ ] Landing-page copy + buyer shortlist (after one recorded live GitHub proof)

## Next Up (highest priority)
1. Execute `wf.github` once with a human-supplied **rotated**, least-privilege token **outside git/chat**. Confirm HITL pause → approve → issue URL in audit. Do not reuse any PAT that appeared in a chat prompt (including this session).
2. Optional live Slack path when operator sets `SLACK_WEBHOOK_URL` locally (do not commit the URL). Dry-run is the default proof path.
3. Optional real workspace write: unset `AETHER_WORKSPACE_DRY_RUN` and run `wf.files` or `wf.vertical` so `data/workspace/briefs/*.md` is written after approve.
4. After one live GitHub proof: landing-page copy + buyer shortlist (do not start outreach until demo is recorded).
5. Optional: live `wf.llm` / `wf.vertical` when operator sets a provider key locally (do not commit keys). Nested/DAG dependencies beyond consecutive waves still deferred. Step timeouts still deferred.

## Decisions So Far
- Stack: TypeScript (Node) for orchestrator + core, Next.js for dashboard.
- Agents are autonomous but always produce audit trails.
- Human-in-the-loop for irreversible actions by default.
- Start private / self-hostable; later add cloud multi-tenant.
- v0.1 execution is scripted sequential (explicit workflow graph). LLM planner comes after the engine is solid.
- Persistence for MVP: `data/runs/<runId>.json`.
- Arg interpolation: `{{memory.<key>}}` and `{{run.id}}` only.
- Hello-workflow uses `autoApprove: true` so daily CI / headless runs complete.
- HTTP tool blocks non-http(s) URLs. GitHub issue create is irreversible and refuses to run without env token (unless dry-run).
- HITL pause stores `pausedStepId` + `approvedStepIds` on the Run; resume continues from that step.
- Workflow registry keys: `hello` / `wf.hello`, `hitl` / `wf.hitl`, `http` / `wf.http`, `github` / `wf.github`, `slack` / `wf.slack`, `files` / `wf.files`, `llm` / `wf.llm`, `parallel` / `wf.parallel`, `parallel-hitl` / `wf.parallel.hitl`, `vertical` / `wf.vertical`.
- Dashboard never reads `data/runs` from the browser. All list/get/approve/reject go through `src/api.ts`.
- API binds to `127.0.0.1:8787` by default (`AETHER_API_PORT`, `AETHER_CORS_ORIGIN`).
- Run ids are restricted to `[a-zA-Z0-9._-]` before filesystem access.
- If `AETHER_API_TOKEN` is unset the API stays open (loopback + warning in listen log). If set, all routes except `/health` and `OPTIONS` require the token.
- Dashboard may store the API token in `localStorage` (`aether.apiToken`) for local use only.
- `wf.github` target repo defaults to `Mourad-Soltani/aether-forge` via `AETHER_DEMO_GITHUB_OWNER` / `AETHER_DEMO_GITHUB_REPO`.
- Slack webhook tool only accepts http(s). No secrets in repo.
- Session 5: dashboard filters are client-side over `/runs` summaries. Live refresh defaults on; operator can disable. Detail-page poll stops when run is `completed` or `failed`.
- Tokens that appear in chat must be treated as compromised and rotated. Daily builder must not create issues with a chat-pasted PAT.
- Session 6: `demo.sh` is the canonical secret-free proof path.
- Session 7: `--json` is the machine contract. `demo.sh` invokes `npx tsx src/orchestrator.ts --json` so npm script banners do not pollute stdout.
- Session 8: tests use Node built-in `node:test`. `RunSummary` schema is the source of truth for demo parse.
- Session 9: `AETHER_GITHUB_DRY_RUN=1|true|yes` simulates issue create. HITL still applies. Audit payloads are sanitized before persist.
- Session 10: `AETHER_SLACK_DRY_RUN=1|true|yes` simulates Slack post. `slack_notify` is irreversible. Dry-run does not weaken HITL.
- Session 11: workspace files are sandboxed. `workspace_write` is irreversible. `AETHER_WORKSPACE_DRY_RUN` skips disk I/O. Paths cannot escape the root.
- Session 12: `llm_complete` is reversible. `AETHER_LLM_DRY_RUN` skips the provider call. Keys from `AETHER_LLM_API_KEY` / `XAI_API_KEY` / `OPENAI_API_KEY` at execute time. Default base is xAI when `XAI_API_KEY` is set.
- Session 13: consecutive `mode: "parallel"` steps run as one wave. HITL applies to the wave before any sibling executes. Distinct `writeTo` keys inside a wave.
- Session 14: audit export is `aether-audit-v1`. Bundle includes metadata + events, not raw memory values. CLI `--export-audit` writes JSONL to stdout. API `GET /runs/:id/audit` returns JSON bundle. Dashboard downloads JSON.
- Session 15: `wf.vertical` is the first multi-connector product slice (HTTP + research wave → LLM → HITL file → notify). Dry-run flags stay the default demo path. Live GitHub still blocked on a rotated token supplied outside chat.

## Handoff for next session
Session 15 ships `wf.vertical` (compose HTTP + research wave → LLM → HITL file → notify) on top of Session 14 audit export. Live GitHub/Slack/LLM remain operator-env only. Any PAT pasted into chat is compromised — do not use it.

```bash
npm install
npm test
npm run demo
export AETHER_API_TOKEN=dev-local-token   # optional but recommended
npm run start:api
# other terminal:
npm run dev:web
# open http://localhost:3000 — paste the same token, Save token
# operator-only, never in chat:
# unset AETHER_GITHUB_DRY_RUN
# export GITHUB_TOKEN=...   # issues:write on Mourad-Soltani/aether-forge only; rotated
# npm run start:orchestrator -- --workflow github
# npm run start:orchestrator -- --approve <runId>
# unset AETHER_SLACK_DRY_RUN
# export SLACK_WEBHOOK_URL=...
# unset AETHER_LLM_DRY_RUN
# export XAI_API_KEY=...   # or OPENAI_API_KEY / AETHER_LLM_API_KEY
# npm run start:orchestrator -- --workflow llm
# npm run start:orchestrator -- --workflow slack
# unset AETHER_WORKSPACE_DRY_RUN
# npm run start:orchestrator -- --workflow files
# npm run start:orchestrator -- --approve <runId>
# # writes data/workspace/briefs/demo.md
# npm run start:orchestrator -- --workflow parallel
# npm run start:orchestrator -- --workflow parallel-hitl
# AETHER_LLM_DRY_RUN=1 AETHER_WORKSPACE_DRY_RUN=1 npm run start:orchestrator -- --workflow vertical
# npm run start:orchestrator -- --approve <runId>
```

API:
- `GET /health` (open; reports `authRequired`)
- `GET /workflows` (gated)
- `GET /runs`
- `GET /runs/:id`
- `GET /runs/:id/audit` (`aether-audit-v1` bundle)
- `POST /runs` `{ "workflowId": "wf.hitl" | "wf.github" | "wf.slack" | "wf.files" | "wf.parallel" | "wf.vertical" | ... }`
- `POST /runs/:id/approve`
- `POST /runs/:id/reject`

Headers when gated: `X-Aether-Token: <token>` or `Authorization: Bearer <token>`.

**Security note:** Do not paste PATs into chat or commits. Rotate any token that appeared in a previous session prompt. Prefer GitHub connector with least privilege (`issues:write` on one repo).
