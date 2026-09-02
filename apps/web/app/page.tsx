"use client";

import { useEffect, useMemo, useState } from "react";
import {
  decideRun,
  fetchRuns,
  fetchWorkflows,
  getStoredApiToken,
  setStoredApiToken,
  startRun,
  type RunStatus,
  type RunSummary,
} from "../lib/api";
import { useIntervalRefresh } from "../lib/useIntervalRefresh";

const STATUSES: Array<RunStatus | "all"> = [
  "all",
  "awaiting_approval",
  "running",
  "pending",
  "completed",
  "failed",
];

function badge(status: string) {
  return <span className={`badge s-${status}`}>{status}</span>;
}

export default function HomePage() {
  const [runs, setRuns] = useState<RunSummary[]>([]);
  const [workflows, setWorkflows] = useState<{ id: string; name: string }[]>([]);
  const [wf, setWf] = useState("wf.hitl");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [token, setToken] = useState("");
  const [statusFilter, setStatusFilter] = useState<RunStatus | "all">("all");
  const [workflowFilter, setWorkflowFilter] = useState("all");
  const [live, setLive] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);

  async function refresh() {
    try {
      const data = await fetchRuns();
      setRuns(data.runs);
      setError(null);
      setUpdatedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useIntervalRefresh(refresh, live, 5000);

  useEffect(() => {
    setToken(getStoredApiToken());
    void refresh();
    void fetchWorkflows()
      .then((d) => setWorkflows(d.workflows))
      .catch(() => undefined);
  }, []);

  function saveToken() {
    setStoredApiToken(token);
    void refresh();
    void fetchWorkflows()
      .then((d) => setWorkflows(d.workflows))
      .catch(() => undefined);
  }

  async function onStart() {
    setBusy(true);
    try {
      await startRun(wf);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  async function onDecide(id: string, decision: "approve" | "reject") {
    setBusy(true);
    try {
      await decideRun(id, decision);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  const visible = useMemo(() => {
    return runs.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (workflowFilter !== "all" && r.workflowId !== workflowFilter) return false;
      return true;
    });
  }, [runs, statusFilter, workflowFilter]);

  const workflowIds = useMemo(() => {
    const ids = new Set(runs.map((r) => r.workflowId));
    for (const w of workflows) ids.add(w.id);
    return Array.from(ids).sort();
  }, [runs, workflows]);

  const pendingCount = runs.filter((r) => r.status === "awaiting_approval").length;

  return (
    <>
      <h1>Runs</h1>
      <p className="muted">
        Dashboard reads persisted runs through the local API only — never from
        the browser filesystem. Auth header is attached on every call.
      </p>
      {error ? (
        <p className="err">
          {error}. Start the API with <code>npm run start:api</code>. If auth is
          on, save the same token used as <code>AETHER_API_TOKEN</code>.
        </p>
      ) : null}
      <div className="row">
        <input
          type="password"
          placeholder="API token (local only)"
          value={token}
          onChange={(e) => setToken(e.target.value)}
        />
        <button onClick={saveToken}>Save token</button>
        <select value={wf} onChange={(e) => setWf(e.target.value)}>
          {(workflows.length
            ? workflows
            : [
                { id: "wf.hello", name: "hello" },
                { id: "wf.hitl", name: "hitl" },
                { id: "wf.http", name: "http" },
                { id: "wf.github", name: "github" },
                { id: "wf.slack", name: "slack" },
              ]
          ).map((w) => (
            <option key={w.id} value={w.id}>
              {w.name} ({w.id})
            </option>
          ))}
        </select>
        <button onClick={() => void onStart()} disabled={busy}>
          Start run
        </button>
        <button onClick={() => void refresh()} disabled={busy}>
          Refresh
        </button>
        <label className="muted">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
          />{" "}
          live 5s
        </label>
        {updatedAt ? (
          <span className="muted">updated {updatedAt.slice(11, 19)}Z</span>
        ) : null}
        {pendingCount > 0 ? (
          <span className="badge s-awaiting_approval">{pendingCount} awaiting</span>
        ) : null}
      </div>
      <div className="row">
        <label className="muted">
          status{" "}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as RunStatus | "all")}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
        <label className="muted">
          workflow{" "}
          <select
            value={workflowFilter}
            onChange={(e) => setWorkflowFilter(e.target.value)}
          >
            <option value="all">all</option>
            {workflowIds.map((id) => (
              <option key={id} value={id}>
                {id}
              </option>
            ))}
          </select>
        </label>
        <span className="muted">
          showing {visible.length} / {runs.length}
        </span>
      </div>
      <table>
        <thead>
          <tr>
            <th>Started</th>
            <th>Workflow</th>
            <th>Status</th>
            <th>Audit</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {visible.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                No runs match the current filters.
              </td>
            </tr>
          ) : (
            visible.map((r) => (
              <tr key={r.id}>
                <td>{r.startedAt.replace("T", " ").slice(0, 19)}</td>
                <td>{r.workflowId}</td>
                <td>{badge(r.status)}</td>
                <td>{r.auditCount}</td>
                <td>
                  <a href={`/runs/${r.id}`}>open</a>
                  {r.status === "awaiting_approval" ? (
                    <>
                      {" "}
                      <button
                        className="ok"
                        disabled={busy}
                        onClick={() => void onDecide(r.id, "approve")}
                      >
                        approve
                      </button>{" "}
                      <button
                        className="bad"
                        disabled={busy}
                        onClick={() => void onDecide(r.id, "reject")}
                      >
                        reject
                      </button>
                    </>
                  ) : null}
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </>
  );
}
