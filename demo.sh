#!/usr/bin/env bash
# Aether Forge — secret-free local demo
# Walks wf.hello → wf.http → wf.hitl → wf.github/slack/files dry-run → wf.llm dry-run → wf.parallel → wf.vertical dry-run → wf.timeout.ok → wf.retry.ok.
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

echo "==> 1/10 wf.hello (autoApprove, stubs only)"
HELLO_RAW="$(run_orch --workflow hello 2> >(tee /dev/stderr >&2))"
HELLO_JSON="$(printf '%s\n' "$HELLO_RAW" | parse_summary)"
HELLO_ID="$(expect_status "$HELLO_JSON" completed)"
echo "    run: $HELLO_ID"

echo
echo "==> 2/10 wf.http (live GET jsonplaceholder, no secrets)"
HTTP_RAW="$(run_orch --workflow http 2> >(tee /dev/stderr >&2))"
HTTP_JSON="$(printf '%s\n' "$HTTP_RAW" | parse_summary)"
HTTP_ID="$(expect_status "$HTTP_JSON" completed)"
echo "    run: $HTTP_ID"

echo
echo "==> 3/10 wf.hitl (pause at irreversible stub, then approve)"
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
echo "==> 4/10 wf.github dry-run (HITL, no token, no live issue)"
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
echo "==> 5/10 wf.slack dry-run (HITL, no webhook)"
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
echo "==> 6/10 wf.files dry-run (HITL, no disk write)"
export AETHER_WORKSPACE_DRY_RUN=1
FS_RAW="$(run_orch --workflow files 2> >(tee /dev/stderr >&2))"
FS_JSON="$(printf '%s\n' "$FS_RAW" | parse_summary)"
FS_ID="$(expect_status "$FS_JSON" awaiting_approval)"
echo "    paused run: $FS_ID"

echo
echo "==> approve $FS_ID (dry-run workspace write)"
FS_APPROVE_RAW="$(run_orch --approve "$FS_ID" 2> >(tee /dev/stderr >&2))"
FS_APPROVE_JSON="$(printf '%s\n' "$FS_APPROVE_RAW" | parse_summary)"
expect_status "$FS_APPROVE_JSON" completed >/dev/null
unset AETHER_WORKSPACE_DRY_RUN || true

echo
echo "==> 7/10 wf.llm dry-run (no API key)"
export AETHER_LLM_DRY_RUN=1
LLM_RAW="$(run_orch --workflow llm 2> >(tee /dev/stderr >&2))"
LLM_JSON="$(printf '%s\n' "$LLM_RAW" | parse_summary)"
LLM_ID="$(expect_status "$LLM_JSON" completed)"
echo "    run: $LLM_ID"
unset AETHER_LLM_DRY_RUN || true

echo
echo "==> 8/10 wf.parallel (two research stubs concurrent, then summarize)"
PAR_RAW="$(run_orch --workflow parallel 2> >(tee /dev/stderr >&2))"
PAR_JSON="$(printf '%s\n' "$PAR_RAW" | parse_summary)"
PAR_ID="$(expect_status "$PAR_JSON" completed)"
echo "    run: $PAR_ID"

echo
echo "==> 9/10 wf.vertical dry-run (parallel HTTP+research → llm → HITL write)"
export AETHER_LLM_DRY_RUN=1
export AETHER_WORKSPACE_DRY_RUN=1
VERT_RAW="$(run_orch --workflow vertical 2> >(tee /dev/stderr >&2))"
VERT_JSON="$(printf '%s\n' "$VERT_RAW" | parse_summary)"
VERT_ID="$(expect_status "$VERT_JSON" awaiting_approval)"
echo "    paused run: $VERT_ID"

echo
echo "==> approve $VERT_ID (dry-run workspace write)"
VERT_APPROVE_RAW="$(run_orch --approve "$VERT_ID" 2> >(tee /dev/stderr >&2))"
VERT_APPROVE_JSON="$(printf '%s\n' "$VERT_APPROVE_RAW" | parse_summary)"
expect_status "$VERT_APPROVE_JSON" completed >/dev/null
unset AETHER_LLM_DRY_RUN || true
unset AETHER_WORKSPACE_DRY_RUN || true


echo
echo "==> 10/11 wf.timeout.ok (sleep under step timeoutMs cap)"
TO_RAW="$(run_orch --workflow timeout-ok 2> >(tee /dev/stderr >&2))"
TO_JSON="$(printf '%s\n' "$TO_RAW" | parse_summary)"
TO_ID="$(expect_status "$TO_JSON" completed)"
echo "    run: $TO_ID"

echo
echo "==> 11/11 wf.retry.ok (transient fail_n_stub then success)"
RT_RAW="$(run_orch --workflow retry-ok 2> >(tee /dev/stderr >&2))"
RT_JSON="$(printf '%s\n' "$RT_RAW" | parse_summary)"
RT_ID="$(expect_status "$RT_JSON" completed)"
echo "    run: $RT_ID"

echo
echo "==> export audit JSONL for parallel run"
EXPORT_OUT="$(npx tsx src/orchestrator.ts --export-audit "$PAR_ID")"
node -e '
  const lines = process.argv[1].trim().split(/\n/);
  const header = JSON.parse(lines[0]);
  if (header.format !== "aether-audit-v1") process.exit(1);
  if (header.eventCount !== lines.length - 1) process.exit(1);
  console.log("    events:", header.eventCount);
' "$EXPORT_OUT"

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
echo "  files:   $FS_ID (dry-run pause then approve)"
echo "  llm:     $LLM_ID (dry-run complete)"
echo "  parallel: $PAR_ID"
echo "  vertical: $VERT_ID (dry-run pause then approve)"
echo "  timeout:  $TO_ID"
echo "  retry:    $RT_ID"
echo
echo "Live GitHub issue create is still operator-only:"
echo "  # rotate any token that appeared in chat; do not paste tokens here"
echo "  unset AETHER_GITHUB_DRY_RUN"
echo "  export GITHUB_TOKEN=...   # issues:write on one repo only"
echo "  npm run start:orchestrator -- --workflow github"
echo "  npm run start:orchestrator -- --approve <runId>"
