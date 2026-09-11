# Aether Forge

**Private multi-agent control plane** for enterprise knowledge work.

Run multi-step agent workflows across tools with **human-in-the-loop**, an **append-only audit trail**, and **secret-free local demos**. Self-hostable TypeScript runtime — not a chatbot UI.

## Why

Enterprises do not struggle to call an LLM. They struggle to **coordinate irreversible actions** across GitHub, Slack, files, HTTP APIs, and models — with proof of what happened. Aether Forge is the execution + governance layer: scripted workflows, approvals, cancel vs reject, timeouts, retries, and exportable audit bundles.

## What works today (v0.1)

| Capability | Status |
|------------|--------|
| Sequential + parallel workflow waves | Live |
| HITL approve / reject / cancel / expire | Live |
| Retry a failed run from completed waves | Live |
| Audit log + `aether-audit-v1` export | Live |
| HTTP connector | Live (no secrets) |
| GitHub Issues, Slack, LLM | Live with env credentials; **dry-run** without secrets |
| Sandboxed workspace files | Live disk write (demo uses isolated root) |
| Loopback control API + Next.js dashboard | Live |

**Operator-only (not in default demo):** live GitHub issue create, live Slack webhook, live LLM provider keys. Never commit those values.

## Quick start

```bash
npm install
npm test
npm run demo    # secret-free path including dry-runs + live workspace write + cancel
```

```bash
npm run start:orchestrator -- --workflow http
npm run start:orchestrator -- --workflow hitl
npm run start:orchestrator -- --approve <runId>
npm run start:orchestrator -- --reject <runId>
npm run start:orchestrator -- --cancel <runId>
npm run start:orchestrator -- --retry-failed <runId>
npm run start:orchestrator -- --verify-audit <runId>
npm run start:orchestrator -- --expire <runId>
npm run start:orchestrator -- --expire-stale
```

Dry-run connectors (no tokens):

```bash
AETHER_GITHUB_DRY_RUN=1 npm run start:orchestrator -- --workflow github
AETHER_SLACK_DRY_RUN=1 npm run start:orchestrator -- --workflow slack
AETHER_LLM_DRY_RUN=1 npm run start:orchestrator -- --workflow llm
```

Dashboard (two terminals):

```bash
export AETHER_API_TOKEN=dev-local-token   # recommended
npm run start:api
npm run dev:web
# http://localhost:3000 — save the same token in the UI
```

`--json` prints one `RunSummary` on stdout (human logs on stderr). Schema: `src/summary.ts`.

## Optional env (never commit values)

See `.env.example`. Important flags:

- `AETHER_GITHUB_DRY_RUN` / `AETHER_SLACK_DRY_RUN` / `AETHER_WORKSPACE_DRY_RUN` / `AETHER_LLM_DRY_RUN`
- `GITHUB_TOKEN` / `SLACK_WEBHOOK_URL` / `AETHER_LLM_API_KEY` (or `XAI_API_KEY` / `OPENAI_API_KEY`) — operator-only
- `AETHER_API_TOKEN` — gates the control API (loopback by default)

## Project structure

- `src/` — orchestrator, types, tools, audit, export, API
- `apps/web` — Next.js dashboard (runs, audit, approve/reject/cancel)
- `tests/` — `node:test` suites
- `demo.sh` — canonical secret-free walkthrough
- `ARCHITECTURE.md` — design decisions
- `ROADMAP.md` — public milestones
- `PROGRESS.md` — detailed build log (maintainers)

## Security notes

- No secrets in git. Tokens and webhooks are env-only at execute time.
- Audit payloads are redacted before persist.
- Workspace paths cannot escape the configured root.
- Control API defaults to `127.0.0.1`.

## License

MIT
