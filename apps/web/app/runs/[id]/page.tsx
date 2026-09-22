"use client";

import { useEffect, useState } from "react";
import {
  archiveRun,
  cancelRun,
  decideRun,
  expireRun,
  fetchAuditBundle,
  fetchRun,
  noteRun,
  pinRun,
  retryFailedRun,
  unarchiveRun,
  unpinRun,
  type AuditChainReport,
  type Run,
} from "../../../lib/api";
import { useIntervalRefresh } from "../../../lib/useIntervalRefresh";

export default function RunPage({ params }: { params: { id: string } }) {
  const [run, setRun] = useState<Run | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [live, setLive] = useState(true);
  const [reason, setReason] = useState("");
  const [chain, setChain] = useState<AuditChainReport | null>(null);

  async function load() {
    try {
      const data = await fetchRun(params.id);
      setRun(data.run);
      setError(null);
      try {
        const audit = await fetchAuditBundle(params.id);
        setChain(audit.bundle.chain);
      } catch {
        setChain(null);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  useEffect(() => {
    void load();
  }, [params.id]);

  useIntervalRefresh(
    load,
    live &&
      !!run &&
      run.status !== "completed" &&
      run.status !== "failed" &&
      run.status !== "cancelled" &&
      run.status !== "expired",
    5000,
  );

  async function onDecide(decision: "approve" | "reject") {
    setBusy(true);
    try {
      const data = await decideRun(params.id, decision, reason || undefined);
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
        <span className="muted">{run.workflowId}</span>{" "}
        <label className="muted">
          <input
            type="checkbox"
            checked={live}
            onChange={(e) => setLive(e.target.checked)}
          />{" "}
          live 5s
        </label>
      </p>
      {run.pausedStepId ? (
        <p className="muted">Paused at step {run.pausedStepId}</p>
      ) : null}
      {run.approvalExpiresAt ? (
        <p className="muted">Approval expires {run.approvalExpiresAt.replace("T", " ").slice(0, 19)}</p>
      ) : null}
      {run.error ? <p className="err">{run.error}</p> : null}
      {run.archivedAt ? (
        <p className="muted">Archived {run.archivedAt.replace("T", " ").slice(0, 19)}</p>
      ) : null}
      {run.pinnedAt ? (
        <p className="muted">Pinned {run.pinnedAt.replace("T", " ").slice(0, 19)}</p>
      ) : null}
      {run.status === "awaiting_approval" ? (
        <div>
        <p>
          <label className="muted">
            Decision note (optional)
            <br />
            <textarea
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why approve, reject, or cancel?"
              style={{ width: "100%", marginTop: 4 }}
            />
          </label>
        </p>
        <div className="row">
          <button className="ok" disabled={busy} onClick={() => void onDecide("approve")}>
            Approve
          </button>
          <button className="bad" disabled={busy} onClick={() => void onDecide("reject")}>
            Reject
          </button>
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const data = await cancelRun(params.id, reason || undefined);
                  setRun(data.run);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Cancel
          </button>
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const data = await expireRun(params.id);
                  setRun(data.run);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Expire if stale
          </button>
        </div>
        </div>
      ) : null}
      {["completed", "failed", "cancelled", "expired"].includes(run.status) ? (
        <div className="row">
          {run.archivedAt ? (
            <button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const data = await unarchiveRun(params.id, reason || undefined);
                    setRun(data.run);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Unarchive
            </button>
          ) : (
            <button
              disabled={busy}
              onClick={() => {
                void (async () => {
                  setBusy(true);
                  try {
                    const data = await archiveRun(params.id, reason || undefined);
                    setRun(data.run);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : String(err));
                  } finally {
                    setBusy(false);
                  }
                })();
              }}
            >
              Archive
            </button>
          )}
        </div>
      ) : null}
      <p>
        <label className="muted">
          Operator note
          <br />
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Append a comment to the audit trail"
            style={{ width: "100%", marginTop: 4 }}
          />
        </label>
      </p>
      <div className="row">
        <button
          disabled={busy || !reason.trim()}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                const data = await noteRun(params.id, reason);
                setRun(data.run);
                setReason("");
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Add note
        </button>
        {run.pinnedAt ? (
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const data = await unpinRun(params.id, reason || undefined);
                  setRun(data.run);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Unpin
          </button>
        ) : (
          <button
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const data = await pinRun(params.id, reason || undefined);
                  setRun(data.run);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Pin
          </button>
        )}
      </div>
      {run.status === "failed" ? (
        <div className="row">
          <button
            className="ok"
            disabled={busy}
            onClick={() => {
              void (async () => {
                setBusy(true);
                try {
                  const data = await retryFailedRun(params.id);
                  setRun(data.run);
                } catch (err) {
                  setError(err instanceof Error ? err.message : String(err));
                } finally {
                  setBusy(false);
                }
              })();
            }}
          >
            Retry failed
          </button>
        </div>
      ) : null}
      <p>
        <button
          disabled={busy}
          onClick={() => {
            void (async () => {
              setBusy(true);
              try {
                const data = await fetchAuditBundle(params.id);
                const blob = new Blob([JSON.stringify(data.bundle, null, 2)], {
                  type: "application/json",
                });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `aether-audit-${params.id}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } catch (err) {
                setError(err instanceof Error ? err.message : String(err));
              } finally {
                setBusy(false);
              }
            })();
          }}
        >
          Export audit
        </button>
      </p>
      <h2>Audit trail</h2>
      {chain ? (
        <p className="muted">
          chain {chain.ok ? "ok" : `broken${chain.reason ? ` (${chain.reason})` : ""}`} · {chain.eventCount} events
          {chain.brokenAt != null ? ` · brokenAt ${chain.brokenAt}` : ""}
        </p>
      ) : null}
      {run.audit.map((ev) => (
        <div className="event" key={ev.id}>
          <div className="muted">
            {ev.timestamp} · {ev.type}
            {ev.agentId ? ` · ${ev.agentId}` : ""}
            {ev.stepId ? ` · ${ev.stepId}` : ""}
            {ev.hash ? ` · hash ${ev.hash.slice(0, 12)}…` : ""}
          </div>
          <pre>{JSON.stringify(ev.content, null, 2)}</pre>
        </div>
      ))}
      <h2>Memory</h2>
      <pre>{JSON.stringify(run.memory, null, 2)}</pre>
    </>
  );
}
