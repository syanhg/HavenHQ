#!/usr/bin/env bash
#
# Print the private-access requests, newest first.
#
#   scripts/requests.sh          the last 50
#   scripts/requests.sh 200      the last 200
#   scripts/requests.sh 50 csv   as CSV, to pipe somewhere
#
# It reads the table through PostgREST with the project's service_role key,
# fetched from the Supabase CLI at run time — nothing is written to disk and no
# key is stored in this repo. `supabase db query --linked` would be the obvious
# way to do this and is not: it provisions a temporary login role through the
# Management API first, and that step returns 403 on this account.

set -euo pipefail

PROJECT_REF="bddtlvdifhimpqnontal"
LIMIT="${1:-50}"
FORMAT="${2:-table}"

KEY=$(supabase projects api-keys --project-ref "$PROJECT_REF" -o json 2>/dev/null | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(next(k['api_key'] for k in data if k.get('name') == 'service_role'))
")

if [ -z "$KEY" ]; then
  echo "Could not read the service key. Try: supabase login" >&2
  exit 1
fi

URL="https://${PROJECT_REF}.supabase.co/rest/v1/access_requests"
QUERY="select=created_at,name,email,organization,x_handle&order=created_at.desc&limit=${LIMIT}"

curl -sS -m 30 -H "apikey: $KEY" -H "Authorization: Bearer $KEY" "${URL}?${QUERY}" \
  | FORMAT="$FORMAT" python3 -c '
import csv, json, os, sys

rows = json.load(sys.stdin)

if not rows:
    print("No requests yet.")
    sys.exit()

cols = ["created_at", "name", "email", "organization", "x_handle"]

if os.environ.get("FORMAT") == "csv":
    out = csv.DictWriter(sys.stdout, fieldnames=cols)
    out.writeheader()
    out.writerows({c: r.get(c) or "" for c in cols} for r in rows)
    sys.exit()

for r in rows:
    r["created_at"] = (r.get("created_at") or "")[:16].replace("T", " ")

width = {c: max(len(c), max(len(str(r.get(c) or "")) for r in rows)) for c in cols}
line = "  ".join(c.upper().ljust(width[c]) for c in cols)

print(line)
print("-" * len(line))

for r in rows:
    print("  ".join(str(r.get(c) or "").ljust(width[c]) for c in cols))

print()
print(f"{len(rows)} request(s)")
'
