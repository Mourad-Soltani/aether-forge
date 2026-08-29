# Aether Forge Architecture (v0)

## High-level
- **Orchestrator**: Central runtime that plans, schedules, and executes multi-agent workflows.
- **Agents**: Specialized (or general) workers with tools, memory, and goals.
- **Tools**: Connectors to enterprise systems (Slack, GitHub, Notion, email, DB, code exec, etc.). Start with stubs + a few real ones.
- **Memory**: Short-term (conversation) + long-term (vector + structured store). Start simple.
- **Audit Log**: Immutable record of every thought, tool call, decision, and outcome. Non-negotiable for enterprise.
- **Dashboard**: Visibility, approval queues, workflow designer, analytics.

## MVP Scope (first 4–6 weeks of daily sessions)
1. Core types: Agent, Tool, Workflow, Step, AuditEvent
2. Simple sequential + parallel execution engine
3. 3–5 tools (file system, HTTP, GitHub, Slack webhook, LLM call)
4. One vertical demo workflow
5. Basic Next.js UI showing runs + audit trail
6. Local persistence (SQLite or JSON files) → later Postgres

## Non-goals for MVP
- Full multi-tenancy
- Complex RL / self-improvement loops
- Production-grade sandboxing of code execution
