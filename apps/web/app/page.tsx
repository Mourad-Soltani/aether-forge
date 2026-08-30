"use client";

import { useEffect, useState } from "react";
import {
  decideRun,
  fetchRuns,
  fetchWorkflows,
  getStoredApiToken,
  setStoredApiToken,
  startRun,
  type RunSummary,
} from "../lib/api";

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

  async function refresh() {
    try {
      const data = await fetchRuns();
      setRuns(data.runs);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

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

  return (
    <>
      <h1>Runs</h1>
      <p className="muted">
        Dashboard reads persisted runs through the local API only — never from
        the browser filesystem.
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
          {runs.length === 0 ? (
            <tr>
              <td colSpan={5} className="muted">
                No runs yet.
              </td>
            </tr>
          ) : (
            runs.map((r) => (
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
