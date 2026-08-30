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

Parallel steps are specified in types (`mode: "parallel"`) but **not executed in parallel yet** — sequential fallback only.

## Memory (v0.1)
Run-scoped `Record<string, unknown>`. Steps can `writeTo` a key. Later steps read `memory[key]` via `{{memory.key}}` interpolation in args.

## Persistence
JSON files under `data/runs/` for MVP. Postgres later (`DATABASE_URL`).
`loadRun` / `listRuns` / `listRunSummaries` / `saveRun` in `src/persist.ts`.
Run ids must match `[a-zA-Z0-9._-]` before any path join.

## Control API (Session 3)
`src/api.ts` — Node `http` server, no extra runtime dependency.
Default bind: `127.0.0.1:8787`.
Routes: `/health`, `/workflows`, `/runs`, `/runs/:id`, `POST /runs`, `POST /runs/:id/approve`, `POST /runs/:id/reject`.
CORS origin default `http://localhost:3000`.

## Dashboard (Session 3)
`apps/web` Next.js 14 app router. Client pages call the control API. Approve/reject and start-run from the UI.

## Built-in tools (Session 2)
- Stubs: `research_stub`, `summarize_stub`, `create_ticket_stub` (irreversible), `notify_stub`
- Real: `http_request` (http/https only, 10s default timeout)
- Real (env-gated): `github_create_issue` (irreversible; `GITHUB_TOKEN` or `GH_TOKEN`)

## MVP Scope (first 4–6 weeks of daily sessions)
1. Core types: Agent, Tool, Workflow, Step, AuditEvent, Run — **done v0.1**
2. Simple sequential execution engine — **done v0.1**; parallel next
3. 3–5 tools (file system, HTTP, GitHub, Slack webhook, LLM call) — HTTP + GitHub Issues **done**
4. One vertical demo workflow — **hello-workflow mocked; wf.http live GET done**
5. Basic Next.js UI showing runs + audit trail — **skeleton done Session 3**
6. Local persistence (JSON files) → later Postgres
7. HITL resume — **CLI done Session 2; API + UI Session 3**

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
- UI talks only to the loopback API. API is unauthenticated in Session 3 (loopback bind is the control).
