#!/usr/bin/env bash
# Runs db/schedule1_quota.sql in a throwaway Postgres cluster against the 2021 NW405 IEC result
# and checks it reproduces the published quota (1,515) and every party's total (67 of 67).
# Needs the Postgres server binaries (e.g. /usr/lib/postgresql/16/bin) and permission to run as
# the 'postgres' OS user, or any non-root user: set PGBIN. Nothing is left behind.
set -euo pipefail
PGBIN="${PGBIN:-/usr/lib/postgresql/16/bin}"
HERE="$(cd "$(dirname "$0")" && pwd)"
DIR="$(mktemp -d)"; chmod 777 "$DIR"
RUN=(); if [ "$(id -u)" = 0 ]; then RUN=(su postgres -c); fi
run() { if [ "${#RUN[@]}" -gt 0 ]; then su postgres -c "$*"; else bash -c "$*"; fi; }
trap 'run "$PGBIN/pg_ctl -D $DIR/d stop -m immediate >/dev/null 2>&1" || true; rm -rf "$DIR"' EXIT
run "$PGBIN/initdb -D $DIR/d -A trust >/dev/null"
run "$PGBIN/pg_ctl -D $DIR/d -o '-p 55432 -k $DIR' -l $DIR/log -w start >/dev/null"
P="psql -h $DIR -p 55432 -U postgres -v ON_ERROR_STOP=1 -X -q -t -A -F,"
H="$(printf '0%.0s' {1..64})"
run "$P -f $HERE/schedule1_quota.sql postgres"
run "$P postgres -c \"INSERT INTO demarcation_version VALUES ('LGE-2021','NW405',67,0,0,'2021-11-01');\""
# Votes are the published party totals (PR + ward); ward seats are the 2021 ward winners.
for row in "ABC,340,0" "ANC,48911,24" "ATM,330,0" "BLF,428,0" "DA,25837,9" "EFF,9200,0" "F4SD,204,0" "PA,2389,0" "VFP,13800,1"; do
  IFS=, read -r id v w <<<"$row"
  run "$P postgres -c \"INSERT INTO party_electoral_result VALUES ('LGE-2021','$id',0,$v,$w,'$H');\""
done
OUT="$(run "$P postgres -c \"SELECT party_id,total_seats FROM fn_calculate_schedule1_quotas('LGE-2021')\"")"
QUOTA="$(run "$P postgres -c \"SELECT DISTINCT quota FROM fn_calculate_schedule1_quotas('LGE-2021')\"")"
TOTAL="$(run "$P postgres -c \"SELECT SUM(total_seats) FROM fn_calculate_schedule1_quotas('LGE-2021')\"")"
EXPECT=$'ABC,0\nANC,33\nATM,0\nBLF,0\nDA,17\nEFF,6\nF4SD,0\nPA,2\nVFP,9'
[ "$QUOTA" = "1515" ] || { echo "FAIL quota $QUOTA"; exit 1; }
[ "$TOTAL" = "67" ]   || { echo "FAIL total $TOTAL"; exit 1; }
[ "$OUT" = "$EXPECT" ] || { echo "FAIL seats"; echo "$OUT"; exit 1; }
# a version that would violate the constraints is refused
if run "$P postgres -c \"INSERT INTO party_electoral_result VALUES ('LGE-2021','X',-1,0,0,'$H')\"" 2>/dev/null; then echo "FAIL negative votes accepted"; exit 1; fi
if run "$P postgres -c \"INSERT INTO party_electoral_result VALUES ('LGE-2021','Y',1,0,0,'nothex')\"" 2>/dev/null; then echo "FAIL bad provenance hash accepted"; exit 1; fi
echo "OK: quota 1515, 67 of 67 seats, every party matches the IEC result"
