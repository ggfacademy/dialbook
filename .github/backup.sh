#!/usr/bin/env bash
# Nightly backup: dumps the Supabase database and uploads one zip per day to Dropbox (/CRM by default).
# Needs the repository secrets SUPABASE_DB_URL, DROPBOX_APP_KEY and DROPBOX_REFRESH_TOKEN.
# This repository is public, so nothing here may print data or keep files as workflow artifacts.
set -euo pipefail

: "${SUPABASE_DB_URL:?Add the SUPABASE_DB_URL secret (see README, Backups)}"
: "${DROPBOX_APP_KEY:?Add the DROPBOX_APP_KEY secret (see README, Backups)}"
: "${DROPBOX_REFRESH_TOKEN:?Add the DROPBOX_REFRESH_TOKEN secret (see README, Backups)}"
FOLDER="${DROPBOX_FOLDER:-/CRM}"
KEEP_DAYS="${KEEP_DAYS:-30}"

DAY=$(TZ=Asia/Kolkata date +%F)
WORK=$(mktemp -d)
OUT="$WORK/dialbook-$DAY"
mkdir -p "$OUT/csv"
trap 'rm -rf "$WORK"' EXIT

# 1. Full copy of the CRM tables (structure + data), and the logins they belong to
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges -f "$OUT/database.sql"
pg_dump "$SUPABASE_DB_URL" --table=auth.users --data-only --no-owner --no-privileges -f "$OUT/logins.sql"

# 2. The main tables as CSV, to open in Excel
for t in leads calls activities profiles campaigns wa_messages wa_templates nurture_sequences nurture_enrollments ai_calls lead_sources settings; do
  if psql "$SUPABASE_DB_URL" -Atqc "select to_regclass('public.$t') is not null" | grep -q t; then
    psql "$SUPABASE_DB_URL" -qc "\copy (select * from public.$t) to '$OUT/csv/$t.csv' with (format csv, header)"
  fi
done

cat > "$OUT/README.txt" <<EOF
Dialbook CRM backup, $DAY (India time).
csv/          the main tables, open them in Excel (leads.csv = all leads).
database.sql  full copy of the CRM data, to restore into Supabase.
logins.sql    team logins (restore before database.sql).
Call recordings in Supabase Storage are not included.
EOF

(cd "$WORK" && zip -qr9 "dialbook-$DAY.zip" "dialbook-$DAY")
ZIP="$WORK/dialbook-$DAY.zip"
echo "Backup size: $(du -h "$ZIP" | cut -f1)"

# 3. Upload to Dropbox
TOKEN=$(curl -sS --fail https://api.dropboxapi.com/oauth2/token \
  -d grant_type=refresh_token -d refresh_token="$DROPBOX_REFRESH_TOKEN" -d client_id="$DROPBOX_APP_KEY" | jq -r .access_token)
echo "::add-mask::$TOKEN"
curl -sS --fail -o /dev/null https://content.dropboxapi.com/2/files/upload \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  -H "Dropbox-API-Arg: {\"path\":\"$FOLDER/dialbook-$DAY.zip\",\"mode\":\"overwrite\",\"mute\":true}" \
  --data-binary @"$ZIP"
echo "Uploaded $FOLDER/dialbook-$DAY.zip"

# 4. Keep the last KEEP_DAYS days; only touches files named dialbook-YYYY-MM-DD.zip
CUT=$(TZ=Asia/Kolkata date -d "-$KEEP_DAYS days" +%F)
curl -sS --fail https://api.dropboxapi.com/2/files/list_folder -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"path\":\"$FOLDER\",\"limit\":2000}" \
| jq -r '.entries[] | select(.[".tag"]=="file") | .name' \
| { grep -E '^dialbook-[0-9]{4}-[0-9]{2}-[0-9]{2}\.zip$' || true; } \
| while read -r f; do
    d=${f#dialbook-}; d=${d%.zip}
    if [[ "$d" < "$CUT" ]]; then
      curl -sS --fail -o /dev/null https://api.dropboxapi.com/2/files/delete_v2 -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" -d "{\"path\":\"$FOLDER/$f\"}" && echo "Removed old $f"
    fi
  done
