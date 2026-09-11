# Aether Forge – Progress & Handoff Log

## Project Goal
Private multi-agent control plane for enterprises. Turns tools & data into auditable, human-governed agent workflows. Public milestones: ROADMAP.md.

## Current Status (Session 30 — 2026-09-11)
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
- [x] Session 16 — step `timeoutMs` + `withTimeout` (`src/timeout.ts`). `sleep_stub`. `wf.timeout.ok` / `wf.timeout.fail`. Tests in `tests/timeout.test.ts`. `demo.sh` includes timeout-ok.
- [x] Session 17 — step `retry` (`maxAttempts` + linear `backoffMs`, `src/retry.ts`). `fail_n_stub`. `wf.retry.ok` / `wf.retry.fail`. Irreversible tools cannot set retry. Tests in `tests/retry.test.ts`. `demo.sh` includes retry-ok.
- [x] Session 18 — step timeout now aborts `ToolContext.signal` (`runWithTimeout`). `http_request`, `llm_complete`, and `sleep_stub` cancel in-flight work. Tests in `tests/timeout.test.ts`.
- [x] Session 19 — remaining connectors honor `ctx.signal`: GitHub, Slack, workspace read/write. LLM merges step abort + 20s provider timeout (`src/abort.ts`). Tests in `tests/abort.test.ts` + tool suites.
- [x] Session 20 — operator `cancel` on paused runs: status `cancelled`, CLI `--cancel`, `POST /runs/:id/cancel`, dashboard button. Tests in `tests/cancel.test.ts`. `demo.sh` step 12.
- [x] Session 21 — live (non-dry-run) `wf.files` proof: isolated `AETHER_WORKSPACE_ROOT`, HITL pause → approve → `briefs/demo.md` on disk. Test in `tests/workspace.test.ts`. `demo.sh` writes `data/workspace-demo/briefs/demo.md` (`data/` gitignored).
- [x] Session 22 — public surface hygiene: product-focused README, ROADMAP.md, repo description/topics; exit-marketing removed from public copy.
- [x] Session 23 — retry failed runs from `completedStepIds` (CLI `--retry-failed`, `POST /runs/:id/retry`, dashboard).
- [x] Session 24 — exponential backoff + jitter on step retry (`wf.retry.exp`)
- [x] Session 25 — optional operator `reason` on approve / reject / cancel
- [x] Session 26 — SHA-256 hash chain on audit events (`prevHash` + `hash`, export `chain`)
- [x] Session 27 — `--verify-audit` CLI + dashboard chain badge; dashboard now sends HITL `reason`
- [x] Session 28 — `chainOk` on `RunSummary` + persist list + dashboard list column
- [x] Session 29 — HITL approval TTL (`approvalTtlMs`, `expired` status, `--expire`, `POST /runs/:id/expire`)
- [x] Session 30 — dashboard Expire control + `pausedAt` on list summaries / run detail
- [ ] First GitHub Issues *executed* against a real repo (workflow exists; needs human-supplied **rotated** token **outside git/chat**)
- [ ] Slack live path when operator sets `SLACK_WEBHOOK_URL` locally
- [ ] Landing-page copy + pilot packaging (after one recorded live GitHub proof)

## Next Up (highest priority)
1. Execute `wf.github` once with a human-supplied **rotated**, least-privilege token **outside git/chat**. Confirm HITL pause → approve → issue URL in audit. Do not reuse any PAT that appeared in a chat prompt (including this session).
2. Optional live Slack path when operator sets `SLACK_WEBHOOK_URL` locally (do not commit the URL). Dry-run is the default proof path.
3. After one live GitHub proof: landing-page copy + pilot packaging (do not start external outreach until demo is recorded).
4. Optional: live `wf.llm` / `wf.vertical` when operator sets a provider key locally (do not commit keys). Nested/DAG dependencies beyond consecutive waves still deferred.

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
- Workflow registry keys: `hello` / `wf.hello`, `hitl` / `wf.hitl`, `http` / `wf.http`, `github` / `wf.github`, `slack` / `wf.slack`, `files` / `wf.files`, `llm` / `wf.llm`, `parallel` / `wf.parallel`, `parallel-hitl` / `wf.parallel.hitl`, `vertical` / `wf.vertical`, `timeout-ok` / `wf.timeout.ok`, `timeout-fail` / `wf.timeout.fail`, `retry-ok` / `wf.retry.ok`, `retry-fail` / `wf.retry.fail`, `retry-exp` / `wf.retry.exp`.
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
- Session 16: step `timeoutMs` is an orchestrator race, not cooperative cancel. Max 120s. `sleep_stub` is a test/demo helper.
- Session 17: step `retry.maxAttempts` (1–5) with linear `backoffMs` (cap 5s). Retry is forbidden on irreversible tools. `fail_n_stub` is a test/demo helper. `wf.retry.ok` is in `demo.sh`. `wf.retry.fail` is test-only.
- Session 18: step timeout aborts `ToolContext.signal` via `runWithTimeout`. HTTP, LLM, and `sleep_stub` honor it. Other tools may still finish in the background.
- Session 19: GitHub, Slack, and workspace tools honor `ctx.signal`. LLM no longer drops the step signal behind `AbortSignal.timeout`.
- Session 20: paused runs can be cancelled (`cancelled` status). Distinct from reject/`failed`. CLI `--cancel`, API + dashboard.

- Session 21: secret-free live workspace proof uses an isolated root (`AETHER_WORKSPACE_ROOT`). Default `./data/workspace` is unchanged. HITL still applies when `autoApprove` is false.
- Session 23: failed runs can resume from the first incomplete wave via `completedStepIds`. Cancelled runs stay terminal (use a new run). Chat-pasted PATs remain unusable for live `wf.github`.
- Session 24: step retry may use `strategy: exponential` and `jitter` in [0,1]. Default remains linear / no jitter so existing demos stay deterministic.
- Session 25: HITL decisions may include a short operator `reason` (max 500) on the audit event. Empty reason is omitted.
- Session 26: audit events are SHA-256 chained; export reports `chain.ok`.
- Session 27: `--verify-audit` prints the chain report and exits 1 when broken. Dashboard shows chain status + hash prefixes. Approve/reject from the UI now forward the optional reason.
- Session 28: `summarizeRun` and `listRunSummaries` include `chainOk` from `verifyAuditChain`. List page shows ok/broken without opening the run.
- Session 29: workflows may set `approvalTtlMs`. Paused runs record `pausedAt`. After the window, `--expire` / approve / reject / cancel close the run as `expired` (not failed). Default HITL workflows have no TTL. `wf.hitl.ttl` is test-only (1ms).
- Session 30: dashboard can POST expire; list summaries include `pausedAt`. Expire still no-ops until TTL elapsed (API error if window still open).

## Handoff for next session
Session 30 ships dashboard expire + pausedAt visibility. Live GitHub/Slack/LLM remain operator-env only. Any PAT pasted into chat is compromised — do not use it.
Public narrative: control-plane MVP; see ROADMAP.md. Maintainer detail stays in this file.

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
# npm run start:orchestrator -- --approve <runId> --reason "looks good"
# unset AETHER_SLACK_DRY_RUN
# export SLACK_WEBHOOK_URL=...
# unset AETHER_LLM_DRY_RUN
# export XAI_API_KEY=...   # or OPENAI_API_KEY / AETHER_LLM_API_KEY
# npm run start:orchestrator -- --workflow llm
# npm run start:orchestrator -- --workflow slack
# live files already covered by npm run demo (data/workspace-demo)
# AETHER_WORKSPACE_ROOT=./data/workspace npm run start:orchestrator -- --workflow files
# npm run start:orchestrator -- --approve <runId> --reason "looks good"
# npm run start:orchestrator -- --workflow parallel
# npm run start:orchestrator -- --workflow parallel-hitl
# AETHER_LLM_DRY_RUN=1 AETHER_WORKSPACE_DRY_RUN=1 npm run start:orchestrator -- --workflow vertical
# npm run start:orchestrator -- --approve <runId> --reason "looks good"
# npm run start:orchestrator -- --workflow timeout-ok
# npm run start:orchestrator -- --workflow retry-ok
# npm run start:orchestrator -- --retry-failed <runId>
# npm run start:orchestrator -- --verify-audit <runId>
# npm run start:orchestrator -- --expire <runId>
```

API:
- `GET /health` (open; reports `authRequired`)
- `GET /workflows` (gated)
- `GET /runs`
- `GET /runs/:id`
- `GET /runs/:id/audit` (`aether-audit-v1` bundle)
- `POST /runs` `{ "workflowId": "wf.hitl" | "wf.github" | "wf.slack" | "wf.files" | "wf.parallel" | "wf.vertical" | ... }`
- `POST /runs/:id/approve` body `{ "reason"?: string }`
- `POST /runs/:id/reject` body `{ "reason"?: string }`
- `POST /runs/:id/cancel` body `{ "reason"?: string }`
- `POST /runs/:id/retry` (failed runs only)
- `POST /runs/:id/expire` (paused runs whose approvalTtlMs elapsed)

Headers when gated: `X-Aether-Token: <token>` or `Authorization: Bearer <token>`.

**Security note:** Do not paste PATs into chat or commits. Rotate any token that appeared in a previous session prompt. Prefer GitHub connector with least privilege (`issues:write` on one repo).


## Decisions (Session 18)
- `runWithTimeout` creates an AbortController and aborts it when `timeoutMs` elapses.
- Tools receive the signal on `ToolContext.signal` and should cancel I/O they own.
- `http_request` merges tool-level timeout abort with the step signal.
- `llm_complete` passes the signal to `fetch`.
- `sleep_stub` rejects with `sleep_stub aborted` when signaled.
- Tools that do not read the signal may still complete in the background after the run is marked failed.
- Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 19)
- Connector HTTP calls take `ctx.signal` on `fetch`.
- Workspace I/O is refused when the signal is already aborted (no partial write).
- `mergeAbortSignals` combines step abort with tool-local timeouts (`AbortSignal.any` when available).
- Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 20)
- Cancel is only valid on `awaiting_approval`. Completed / failed / cancelled refuse with the same expected-status error as resume.
- Cancel writes `cancelled`, not `failed`. Reject remains the failure path.
- `summarizeRun.ok` is true for cancelled.
- In-flight cancel of a currently executing tool is still deferred (process is single-shot per CLI invoke).
- Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 23)
- Successful waves record `completedStepIds`.
- `retryFailedRun` only accepts `failed`. Cancelled stays terminal.
- Retry continues the same run id (audit stays append-only).
- Chat-pasted PATs remain unusable for live `wf.github`.


## Decisions (Session 24)
- Default retry strategy stays linear so Session 17 demos and tests stay deterministic.
- Exponential uses `backoffMs * 2^(attempt-1)` capped at 5s.
- Jitter is equal-jitter around the computed base. `jitter: 0` (default) is exact.
- `wf.retry.exp` is registered; `demo.sh` still uses linear `wf.retry.ok` (fast, deterministic).
- Chat-pasted PATs remain unusable for live `wf.github`.


## Decisions (Session 25)
- Optional `reason` on approve / reject / cancel is an audit annotation, not a new run status.
- Normalization lives in `src/decision.ts` (trim, collapse whitespace, drop controls, cap 500).
- Omitted when empty so existing tests and exporters keep working.
- Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 26)
- New audit events carry `prevHash` + SHA-256 `hash` over a canonical body (id, timestamp, runId, agentId, stepId, type, content, prevHash).
- First event links to a 64-zero genesis hash.
- `verifyAuditChain` reports tamper (`hash mismatch` / `prevHash mismatch`). Events without `hash` (pre-Session 26 files) are skipped so old runs still export.
- `aether-audit-v1` header includes `chain: { ok, eventCount }`.
- Hashing is integrity evidence, not a secret store. Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 27)
- `--verify-audit <runId>` is a read-only operator check. It does not mutate the run.
- Exit code 1 when `chain.ok` is false so scripts can gate on integrity.
- Dashboard reads `bundle.chain` from `GET /runs/:id/audit` and shows short hash prefixes; it does not recompute hashes in the browser.
- Approve/reject buttons now pass the textarea `reason` (cancel already did).
- Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 28)
- `RunSummary.chainOk` is computed server-side via `verifyAuditChain`.
- List API (`listRunSummaries`) includes the same flag so the dashboard does not download every audit bundle.
- Pre-Session 26 events without hashes still report `chainOk: true` (legacy skip rule unchanged).
- Chat-pasted PATs remain unusable for live `wf.github`.
