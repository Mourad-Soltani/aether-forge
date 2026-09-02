#!/usr/bin/env bash
# Aether Forge — secret-free local demo
# Walks wf.hello → wf.http → wf.hitl → wf.github dry-run → wf.slack dry-run.
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

# Call tsx directly so npm script banners do not mix with --json stdout.
run_orch() {
  npx tsx src/orchestrator.ts --json "$@"
}

parse_summary() {
  node -e '
    const fs = require("fs");
    const raw = fs.readFileSync(0, "utf8");
    const lines = raw.split(/\n/).map((l) => l.trim()).filter(Boolean);
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const j = JSON.parse(lines[i]);
        if (j && typeof j === "object") {
          process.stdout.write(JSON.stringify(j));
          process.exit(0);
        }
      } catch {}
    }
    process.stderr.write("error: no JSON summary on stdout\n");
    process.exit(1);
  '
}

expect_status() {
  local json="$1"
  local want="$2"
  node -e '
    const j = JSON.parse(process.argv[1]);
    if (j.status !== process.argv[2]) {
      console.error("error: expected status " + process.argv[2] + ", got " + j.status);
      process.exit(1);
    }
    if (!j.id) {
      console.error("error: missing run id");
      process.exit(1);
    }
    process.stdout.write(j.id);
  ' "$json" "$want"
}

echo "==> 1/5  wf.hello (autoApprove, stubs only)"
HELLO_RAW="$(run_orch --workflow hello 2> >(tee /dev/stderr >&2))"
HELLO_JSON="$(printf '%s\n' "$HELLO_RAW" | parse_summary)"
HELLO_ID="$(expect_status "$HELLO_JSON" completed)"
echo "    run: $HELLO_ID"

echo
echo "==> 2/5  wf.http (live GET jsonplaceholder, no secrets)"
HTTP_RAW="$(run_orch --workflow http 2> >(tee /dev/stderr >&2))"
HTTP_JSON="$(printf '%s\n' "$HTTP_RAW" | parse_summary)"
HTTP_ID="$(expect_status "$HTTP_JSON" completed)"
echo "    run: $HTTP_ID"

echo
echo "==> 3/5  wf.hitl (pause at irreversible stub, then approve)"
HITL_RAW="$(run_orch --workflow hitl 2> >(tee /dev/stderr >&2))"
HITL_JSON="$(printf '%s\n' "$HITL_RAW" | parse_summary)"
HITL_ID="$(expect_status "$HITL_JSON" awaiting_approval)"
echo "    paused run: $HITL_ID"

echo
echo "==> approve $HITL_ID"
APPROVE_RAW="$(run_orch --approve "$HITL_ID" 2> >(tee /dev/stderr >&2))"
APPROVE_JSON="$(printf '%s\n' "$APPROVE_RAW" | parse_summary)"
expect_status "$APPROVE_JSON" completed >/dev/null

echo
echo "==> 4/5  wf.github dry-run (HITL, no token, no live issue)"
export AETHER_GITHUB_DRY_RUN=1
GH_RAW="$(run_orch --workflow github 2> >(tee /dev/stderr >&2))"
GH_JSON="$(printf '%s\n' "$GH_RAW" | parse_summary)"
GH_ID="$(expect_status "$GH_JSON" awaiting_approval)"
echo "    paused run: $GH_ID"

echo
echo "==> approve $GH_ID (dry-run issue)"
GH_APPROVE_RAW="$(run_orch --approve "$GH_ID" 2> >(tee /dev/stderr >&2))"
GH_APPROVE_JSON="$(printf '%s\n' "$GH_APPROVE_RAW" | parse_summary)"
expect_status "$GH_APPROVE_JSON" completed >/dev/null
unset AETHER_GITHUB_DRY_RUN || true

echo
echo "==> 5/5  wf.slack dry-run (HITL, no webhook)"
export AETHER_SLACK_DRY_RUN=1
SL_RAW="$(run_orch --workflow slack 2> >(tee /dev/stderr >&2))"
SL_JSON="$(printf '%s\n' "$SL_RAW" | parse_summary)"
SL_ID="$(expect_status "$SL_JSON" awaiting_approval)"
echo "    paused run: $SL_ID"

echo
echo "==> approve $SL_ID (dry-run slack)"
SL_APPROVE_RAW="$(run_orch --approve "$SL_ID" 2> >(tee /dev/stderr >&2))"
SL_APPROVE_JSON="$(printf '%s\n' "$SL_APPROVE_RAW" | parse_summary)"
expect_status "$SL_APPROVE_JSON" completed >/dev/null
unset AETHER_SLACK_DRY_RUN || true

echo
echo "==> recent runs"
run_orch --list 2>/dev/null || true

echo
echo "Demo OK"
echo "  hello:   $HELLO_ID"
echo "  http:    $HTTP_ID"
echo "  hitl:    $HITL_ID (paused then approved)"
echo "  github:  $GH_ID (dry-run pause then approve)"
echo "  slack:   $SL_ID (dry-run pause then approve)"
echo
echo "Live GitHub issue create is still operator-only:"
echo "  # rotate any token that appeared in chat; do not paste tokens here"
echo "  unset AETHER_GITHUB_DRY_RUN"
echo "  export GITHUB_TOKEN=...   # issues:write on one repo only"
echo "  npm run start:orchestrator -- --workflow github"
echo "  npm run start:orchestrator -- --approve <runId>"
