#!/usr/bin/env bash
# PostToolUse (Write|Edit): run the project gate after a code edit.
# Skips non-code files, skips if a run is already going, and exits 2 on failure so the
# failure is fed back to Claude (asyncRewake). Output of a passing run is discarded.
f=$(jq -r '.tool_input.file_path // .tool_response.filePath // empty')
case "$f" in
  */election-cos-app/*.ts|*/election-cos-app/*.tsx|*/election-cos-app/*.mjs|*/election-cos-app/*.json|*/election-cos-app/*.rules) ;;
  *) exit 0 ;;
esac
cd "$(dirname "$0")/../election-cos-app" || exit 0
LOG=/tmp/ecos-check.log
flock -E 99 -n /tmp/ecos-check.lock npm run check:all >"$LOG" 2>&1
rc=$?
[ "$rc" -eq 99 ] && exit 0   # a run is already in progress
if [ "$rc" -ne 0 ]; then
  echo "check:all FAILED after editing $f. Last lines:" >&2
  grep -E "error|×|FAIL|Tests " "$LOG" | head -20 >&2
  exit 2
fi
exit 0
