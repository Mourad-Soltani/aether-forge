# Aether Forge Architecture (v0.1)

## High-level
- **Orchestrator**: Central runtime that plans, schedules, and executes multi-agent workflows.
- **Agents**: Specialized (or general) workers with tools, memory, and goals.
- **Tools**: Connectors to enterprise systems (Slack, GitHub, Notion, email, DB, code exec, etc.). Start with stubs + a few real ones.
- **Memory**: Short-term (run-scoped key/value) + later long-term (vector + structured store).
- **Audit Log**: Immutable append-only record of every thought, tool call, decision, and outcome. Non-negotiable for enterprise.
- **Dashboard**: Visibility, approval queues, workflow designer, analytics.
- **Control API**: Loopback HTTP surface over persist + resume so the UI never touches run files directly.

## Agent model (v0.1)
An **Agent** is a named worker with:
- `id`, `name`, `goal`
- a list of **Tools** it is allowed to call
- optional `systemPrompt` (used when an LLM planner is wired)
- tools may be marked `irreversible` (human-in-the-loop)

v0.1 execution is **scripted / sequential**: the workflow graph is explicit. Agents do not yet self-plan with an LLM. The orchestrator walks steps, binds tools, writes audit events.

## Tool interface
```
Tool {
  name: string
  description: string
  parameters: ZodSchema
  irreversible?: boolean   // default false; if true, needs approval unless autoApprove
  execute(args, ctx): Promise<unknown>
}
```
Tools receive a `ToolContext` with `runId`, `agentId`, `memory`, and `audit`.

## Execution model (v0.1)
1. Load a `Workflow` (ordered list of `Step`s).
2. Create a `Run` with status `running` and empty memory + audit.
3. For each step:
   - resolve the agent and tool
   - if tool is irreversible and `autoApprove` is false and step is not in `approvedStepIds` → emit `human_input`, set `pausedStepId`, persist, return `awaiting_approval` (not failed)
   - validate args with Zod
   - execute tool
   - write `tool_call` + `tool_result` (or `error`) audit events
   - optionally write a named memory key from the result
4. Mark run `completed` or `failed`.
5. Persist run to `data/runs/<runId>.json`.

Resume (`--approve` / `--reject` or `POST /runs/:id/approve|reject`):
- reject → `decision` audit + `failed`
- approve → append step to `approvedStepIds`, continue from `pausedStepId`

Parallel steps: consecutive `mode: "parallel"` steps form a wave executed with `Promise.all`. HITL is checked for the whole wave before any tool in the wave runs. Distinct `writeTo` keys required inside a wave.

## Memory (v0.1)
Run-scoped `Record<string, unknown>`. Steps can `writeTo` a key. Later steps read `memory[key]` via `{{memory.key}}` interpolation in args.

## Persistence
JSON files under `data/runs/` for MVP. Postgres later (`DATABASE_URL`).
`loadRun` / `listRuns` / `listRunSummaries` / `saveRun` in `src/persist.ts`.
Run ids must match `[a-zA-Z0-9._-]` before any path join.

## Control API (Session 3–4)
`src/api.ts` — Node `http` server, no extra runtime dependency.
Default bind: `127.0.0.1:8787`.
Routes: `/health`, `/workflows`, `/runs`, `/runs/:id`, `/runs/:id/audit`, `POST /runs`, `POST /runs/:id/approve`, `POST /runs/:id/reject`.
CORS origin default `http://localhost:3000`.
Auth (Session 4): optional `AETHER_API_TOKEN`. When set, require `X-Aether-Token` or `Authorization: Bearer`. `/health` and `OPTIONS` stay open. Compare uses timing-safe equality.

## Dashboard (Session 3–5)
`apps/web` Next.js 14 app router. Client pages call the control API. Approve/reject and start-run from the UI.
Token: `NEXT_PUBLIC_AETHER_API_TOKEN` or localStorage `aether.apiToken` (local operator convenience).
Session 5: list page filters by status and workflow id (client-side). Optional 5s poll (`useIntervalRefresh`) on list + detail. Detail poll stops on terminal statuses.

## Demo packaging (Session 6)
`demo.sh` / `npm run demo` runs `wf.hello`, `wf.http`, `wf.hitl` + `--approve`, then `wf.github` with `AETHER_GITHUB_DRY_RUN=1`, then `wf.slack` with `AETHER_SLACK_DRY_RUN=1`, then `wf.files` with `AETHER_WORKSPACE_DRY_RUN=1`.
No secrets. Session 7: orchestrator `--json` emits one `RunSummary` on stdout; human logs go to stderr. `demo.sh` parses that object instead of scraping `Run <status>: <id>`.
Live `wf.github` and Slack remain operator-env only.

## RunSummary contract (Session 7–8)
`src/summary.ts` owns `RunSummarySchema` (Zod), `summarizeRun`, and `parseRunSummaryFromStdout`.
`--json` stdout is one schema-valid object. Pause (`awaiting_approval`) is `ok: true`. Failed runs are `ok: false`.
`npm test` runs `tsx --test tests/*.test.ts` (no extra test framework).

## Built-in tools
- Stubs: `research_stub`, `summarize_stub`, `create_ticket_stub` (irreversible), `notify_stub`
- Real: `http_request` (http/https only, 10s default timeout)
- Real (env-gated): `github_create_issue` (irreversible; `GITHUB_TOKEN` or `GH_TOKEN`; `AETHER_GITHUB_DRY_RUN=1` simulates without API)
- Real (env-gated): `slack_notify` (irreversible; `SLACK_WEBHOOK_URL` or `args.webhookUrl`; `AETHER_SLACK_DRY_RUN=1` simulates without HTTP)
- Real (sandboxed): `workspace_read`, `workspace_write` (irreversible write; root `data/workspace` or `AETHER_WORKSPACE_ROOT`; `AETHER_WORKSPACE_DRY_RUN=1` skips disk I/O)
- Demo: `wf.parallel` / `wf.parallel.hitl` — consecutive parallel steps (Session 13)

## MVP Scope (first 4–6 weeks of daily sessions)
1. Core types: Agent, Tool, Workflow, Step, AuditEvent, Run — **done v0.1**
2. Simple sequential execution engine — **done v0.1**; parallel waves — **Session 13**
3. 3–5 tools (file system, HTTP, GitHub, Slack webhook, LLM call) — HTTP + GitHub Issues + Slack webhook + sandboxed files **done**; LLM call still later
4. One vertical demo workflow — **hello-workflow mocked; wf.http live GET done; wf.github defined (live exec pending rotated token); wf.slack defined (live exec pending webhook); wf.files defined Session 11; demo.sh packaging done Session 6; --json Session 7; unit tests Session 8; slack dry-run Session 10; files dry-run Session 11**
5. Basic Next.js UI showing runs + audit trail — **skeleton Session 3; token field Session 4; filters + live refresh Session 5**
6. Local persistence (JSON files) → later Postgres
7. HITL resume — **CLI done Session 2; API + UI Session 3**
8. API auth gate — **Session 4**

## Non-goals for MVP
- Full multi-tenancy
- Complex RL / self-improvement loops
- Production-grade sandboxing of code execution
- LLM-driven open-ended planning (after scripted engine is solid)

## Decisions (additive)
- Human-in-the-loop for `irreversible` tools by default; hello-workflow uses `autoApprove: true` so it is runnable headless.
- Interpolation is limited to `{{memory.<key>}}` and `{{run.id}}` in step args.
- HITL pause is a first-class run status, not an exception/`failed`.
- No secrets in repo. Connectors read env at execute time.
- UI talks only to the loopback API.
- Session 4: API may be token-gated; loopback bind is still the network control.
- `wf.github` is HITL and uses env-configured owner/repo; it does not embed tokens.
- Session 5: dashboard filtering is client-side; polling is opt-out, 5s, and must keep the auth header on every request.
- Session 6: secret-free demo path is `npm run demo`. Chat-pasted PATs are compromised and must not be used by the daily builder.
- Session 7: `--json` is the machine contract for scripts. Human-readable CLI remains the default.
- Session 8: `RunSummary` schema lives in `src/summary.ts`. Tests use Node built-in `node:test` via `tsx --test`.

## Audit redaction (Session 9)
`appendAudit` runs `sanitizeAuditContent` on every event payload.
Redacts `github_pat_*`, `Bearer …`, Slack incoming-webhook URLs, and keys matching token/secret/password/authorization/api_key/webhook.
Dry-run GitHub results still go through HITL when `autoApprove` is false.

## Decisions (Session 9)
- Chat-pasted PATs remain unusable for live `wf.github`. Dry-run is the secret-free proof path.
- Dry-run does not weaken HITL. It only skips the GitHub HTTP call.

## Decisions (Session 10)
- Outbound Slack posts are irreversible. `wf.slack` is HITL (`autoApprove: false`).
- `AETHER_SLACK_DRY_RUN=1|true|yes` skips the webhook HTTP call. HITL still applies.
- Chat-pasted PATs remain unusable for live `wf.github`.

## Decisions (Session 11)
- File I/O is confined to `AETHER_WORKSPACE_ROOT` or `./data/workspace`.
- Relative paths only: segments matching `[a-zA-Z0-9._-]`.
- `workspace_write` is irreversible. `wf.files` is HITL.
- `AETHER_WORKSPACE_DRY_RUN=1|true|yes` skips disk I/O. HITL still applies.
- Max text payload 64 KiB.
- Chat-pasted PATs remain unusable for live `wf.github`.


## Decisions (Session 12)
- `llm_complete` talks to an OpenAI-compatible `/chat/completions` endpoint.
- Keys stay in env (`AETHER_LLM_API_KEY` / `XAI_API_KEY` / `OPENAI_API_KEY`). Never in repo.
- `AETHER_LLM_DRY_RUN=1|true|yes` returns a canned completion. `wf.llm` uses `autoApprove: true` because the tool is not irreversible.
- Default base URL is `https://api.x.ai/v1` when `XAI_API_KEY` is set, else OpenAI.


## Decisions (Session 13)
- Consecutive `mode: "parallel"` steps form a wave. Default / `sequential` steps are solo waves.
- A wave does not start until every irreversible step in it is approved (or `autoApprove`).
- Memory writes apply after the wave settles. Parallel siblings must use distinct `writeTo` keys.
- `wf.parallel` is autoApprove. `wf.parallel.hitl` pauses before the wave.


## Decisions (Session 14)
- External audit evidence uses format `aether-audit-v1`.
- Export includes run metadata + audit events. Raw memory values are omitted (keys only).
- Events are already redacted by `appendAudit`; export does not re-hydrate secrets.
- CLI `--export-audit <runId>` emits JSONL (header line + one event per line) on stdout.
- API `GET /runs/:id/audit` returns `{ bundle }` JSON. Dashboard downloads the JSON file.

## Decisions (Session 15)
- `wf.vertical` is the first end-to-end product slice using real + stub connectors in one graph.
- Parallel wave is HTTP + research (both reversible). HITL applies only to `workspace_write`.
- Demo path sets `AETHER_LLM_DRY_RUN` and `AETHER_WORKSPACE_DRY_RUN`. Live LLM/file/GitHub stay operator-env.
- Chat-pasted PATs remain unusable for live `wf.github`.
