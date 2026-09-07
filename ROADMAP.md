# Roadmap (public)

## v0.1 — Control-plane MVP (current)

- [x] Scripted multi-step runtime (sequential + parallel waves)
- [x] Human-in-the-loop (approve / reject / cancel)
- [x] Append-only audit + export (`aether-audit-v1`)
- [x] Connectors: HTTP, GitHub Issues, Slack, workspace files, LLM (dry-run or env-gated)
- [x] Loopback API + local dashboard
- [x] Secret-free `npm run demo`
- [x] Retry a failed run from completed waves
- [x] Exponential backoff + optional jitter on step retries

## Next

- [ ] Recorded **live** irreversible demo (e.g. GitHub Issues with audit export)
- [ ] Optional live Slack / LLM when operators supply local credentials
- [ ] Landing page + pilot packaging (after live demo is recorded)
- [ ] Design-partner workflows in one vertical (ops / IT / finance)

## Later

- Nested / DAG dependencies beyond consecutive parallel waves
- Exponential backoff / jitter on retries (shipped Session 24; DAG still later)
- LLM planner on top of the scripted engine
- Stronger multi-tenant / packaged single-tenant deploy
- Broader connector set driven by pilot demand

See `ARCHITECTURE.md` for design constraints and `PROGRESS.md` for session-level history.
