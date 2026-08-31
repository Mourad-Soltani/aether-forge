#!/usr/bin/env bash
# Aether Forge — secret-free local demo
# Walks wf.hello (headless) → wf.http (live GET) → wf.hitl (pause + approve).
# Does not require GITHUB_TOKEN or SLACK_WEBHOOK_URL.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"

need() {
  command -v "$1" >/dev/null 2>&1 || {
    echo "error: missing $1" >&2
    exit 1
  }
}

need node
need npm

if [[ ! -d node_modules ]]; then
  echo "==> npm install"
  npm install
fi

run_orch() {
  npm run start:orchestrator -- "$@"
}

extract_run_id() {
  # Orchestrator prints: Run <status>: <uuid>
  grep -Eo 'Run [a-z_]+: [a-zA-Z0-9._-]+' | tail -n1 | awk '{print $NF}'
}

echo "==> 1/3  wf.hello (autoApprove, stubs only)"
HELLO_OUT="$(run_orch -- --workflow hello 2>&1 | tee /dev/stderr || true)"
HELLO_ID="$(printf '%s\n' "$HELLO_OUT" | extract_run_id)"
if [[ -z "$HELLO_ID" ]]; then
  echo "error: could not parse hello run id" >&2
  exit 1
fi
if ! printf '%s\n' "$HELLO_OUT" | grep -q 'Run completed:'; then
  echo "error: hello workflow did not complete" >&2
  exit 1
fi
echo "    run: $HELLO_ID"

echo
echo "==> 2/3  wf.http (live GET jsonplaceholder, no secrets)"
HTTP_OUT="$(run_orch -- --workflow http 2>&1 | tee /dev/stderr || true)"
HTTP_ID="$(printf '%s\n' "$HTTP_OUT" | extract_run_id)"
if [[ -z "$HTTP_ID" ]]; then
  echo "error: could not parse http run id" >&2
  exit 1
fi
if ! printf '%s\n' "$HTTP_OUT" | grep -q 'Run completed:'; then
  echo "error: http workflow did not complete (network?)" >&2
  exit 1
fi
echo "    run: $HTTP_ID"

echo
echo "==> 3/3  wf.hitl (pause at irreversible stub, then approve)"
HITL_OUT="$(run_orch -- --workflow hitl 2>&1 | tee /dev/stderr || true)"
HITL_ID="$(printf '%s\n' "$HITL_OUT" | extract_run_id)"
if [[ -z "$HITL_ID" ]]; then
  echo "error: could not parse hitl run id" >&2
  exit 1
fi
if ! printf '%s\n' "$HITL_OUT" | grep -q 'Run awaiting_approval:'; then
  echo "error: expected HITL pause (awaiting_approval)" >&2
  exit 1
fi
echo "    paused run: $HITL_ID"

echo
echo "==> approve $HITL_ID"
APPROVE_OUT="$(run_orch -- --approve "$HITL_ID" 2>&1 | tee /dev/stderr || true)"
if ! printf '%s\n' "$APPROVE_OUT" | grep -q 'Run completed:'; then
  echo "error: HITL approve did not complete" >&2
  exit 1
fi

echo
echo "==> recent runs"
run_orch -- --list

echo
echo "Demo OK"
echo "  hello: $HELLO_ID"
echo "  http:  $HTTP_ID"
echo "  hitl:  $HITL_ID (paused then approved)"
echo
echo "Optional next (do not put tokens in git or chat):"
echo "  export GITHUB_TOKEN=...   # issues:write on one repo only"
echo "  npm run start:orchestrator -- --workflow github"
echo "  npm run start:orchestrator -- --approve <runId>"
