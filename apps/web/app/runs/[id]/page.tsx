"use client";

import { useEffect, useState } from "react";
import { decideRun, fetchRun, type Run } from "../../../lib/api";

export default function RunPage({ params }: { params: { id: string } }) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const data = await fetchRun(params.id);
      setRun(data.run);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  async function onDecide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const data = await decideRun(params.id, decision);
      setRun(data.run);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }

  if (error) return <p className="err">{error}</p>;
  if (!run) return <p className="muted">Loading…</p>;

  return (
    <>
      <p>
        <a href="/">← runs</a>
      </p>
      <h1>Run {run.id.slice(0, 8)}…</h1>
      <p>
        <span className={`badge s-${run.status}`}>{run.status}</span>{" "}
        <span className="muted">{run.workflowId}</span>
      </p>
      {run.pausedStepId ? (
        <p className="muted">Paused at step {run.pausedStepId}</p>
      ) : null}
      {run.error ? <p className="err">{run.error}</p> : null}
      {run.status === "awaiting_approval" ? (
        <div className="row">
          <button className="ok" disabled={busy} onClick={() => void onDecide("approve")}>
            Approve
          </button>
          <button className="bad" disabled={busy} onClick={() => void onDecide("reject")}>
            Reject
          </button>
        </div>
      ) : null}
      <h2>Audit trail</h2>
      {run.audit.map((ev) => (
        <div className="event" key={ev.id}>
          <div className="muted">
            {ev.timestamp} · {ev.type}
            {ev.agentId ? ` · ${ev.agentId}` : ""}
            {ev.stepId ? ` · ${ev.stepId}` : ""}
          </div>
          <pre>{JSON.stringify(ev.content, null, 2)}</pre>
        </div>
      ))}
      <h2>Memory</h2>
      <pre>{JSON.stringify(run.memory, null, 2)}</pre>
    </>
  );
}
