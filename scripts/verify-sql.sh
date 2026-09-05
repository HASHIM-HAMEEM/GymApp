#!/usr/bin/env bash
# Meridian SQL verification harness (no Docker required).
#
# Spins up a throwaway Postgres cluster, stubs the Supabase platform
# schemas (auth/extensions per AGENTS.md), applies every migration in
# order, and runs the business-rule verification suite. Fails fast on
# the first error; prints the pass count on success.
#
# Usage: bash scripts/verify-sql.sh [port]
set -euo pipefail

PORT="${1:-55432}"
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SCRATCH="$(mktemp -d /tmp/meridian-sqlcheck.XXXXXX)"
PSQL="$(command -v psql)"
INITDB="$(command -v initdb)"
PG_CTL="$(command -v pg_ctl)"

cleanup() {
  "$PG_CTL" -D "$SCRATCH/data" stop -m immediate >/dev/null 2>&1 || true
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

"$INITDB" -D "$SCRATCH/data" -U postgres --encoding=UTF8 >/dev/null
"$PG_CTL" -D "$SCRATCH/data" -o "-p $PORT -k $SCRATCH -c listen_addresses=''" -l "$SCRATCH/log" start >/dev/null
sleep 1
PG=( "$PSQL" -h "$SCRATCH" -p "$PORT" -U postgres )

"${PG[@]}" -d postgres -c "drop database if exists meridian_test;" -c "create database meridian_test;" >/dev/null 2>&1
"${PG[@]}" -d meridian_test -v ON_ERROR_STOP=1 -q -f "$ROOT/scripts/sql/stub.sql"

for f in "$ROOT"/supabase/migrations/*.sql; do
  if ! "${PG[@]}" -d meridian_test -v ON_ERROR_STOP=1 -q -f "$f" >/dev/null 2>&1; then
    echo "MIGRATION FAILED: $(basename "$f")" >&2
    exit 1
  fi
done

OUT="$("${PG[@]}" -d meridian_test -v ON_ERROR_STOP=1 -f "$ROOT/scripts/sql/verify-business-rules.sql" 2>&1)"
if echo "$OUT" | grep -qE "FAIL|ERROR"; then
  echo "$OUT" | grep -E "FAIL|ERROR" >&2
  exit 1
fi
echo "$OUT" | grep -cE "ok -" | xargs -I{} echo "sql verification: {} checks passed"
