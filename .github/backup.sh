#!/usr/bin/env bash
# Nightly backup: dumps the Supabase database and uploads one zip per day to Dropbox (/CRM by default).
# Needs the repository secrets SUPABASE_DB_URL, DROPBOX_APP_KEY and DROPBOX_REFRESH_TOKEN.
# This repository is public, so nothing here may print data or keep files as workflow artifacts.
# Problems are reported as plain-language "::error::" lines, shown on the run's summary page.
set -euo pipefail

die() { echo "::error title=Backup failed::$1"; exit 1; }
first_line() { tr -d '\r' | grep -v '^\s*$' | head -c 300 | head -n 2 | tr '\n' ' '; }

missing=""
for v in SUPABASE_DB_URL DROPBOX_APP_KEY DROPBOX_REFRESH_TOKEN; do
  [ -n "${!v:-}" ] || missing="$missing $v"
done
[ -z "$missing" ] || die "These secrets are missing:$missing. Add them in GitHub → Settings → Secrets and variables → Actions → New repository secret (names exactly as shown)."
case "$SUPABASE_DB_URL" in
  *"[YOUR-PASSWORD]"*) die "SUPABASE_DB_URL still contains [YOUR-PASSWORD]. Replace it (and the brackets) with your database password and save the secret again." ;;
  postgres://*|postgresql://*) ;;
  *) die "SUPABASE_DB_URL must start with postgresql:// . Copy the Session pooler URI from Supabase → Connect → Direct." ;;
esac

FOLDER="${DROPBOX_FOLDER:-/CRM}"
KEEP_DAYS="${KEEP_DAYS:-30}"
DAY=$(TZ=Asia/Kolkata date +%F)
WORK=$(mktemp -d)
OUT="$WORK/dialbook-$DAY"
mkdir -p "$OUT/csv"
trap 'rm -rf "$WORK"' EXIT

# 1. Full copy of the CRM tables (structure + data), and the logins they belong to
if ! psql "$SUPABASE_DB_URL" -Atqc "select 1" >/dev/null 2>"$WORK/err"; then
  msg=$(first_line < "$WORK/err")
  case "$msg" in
    *password*) hint="The database password in SUPABASE_DB_URL is wrong. Reset it in Supabase → Project Settings → Database, put the new one in the URI and save the secret again." ;;
    *"Network is unreachable"*|*"could not translate host"*|*"timed out"*) hint="Use the Session pooler URI (host ends in pooler.supabase.com, port 5432), not the Direct connection one." ;;
    *"Tenant or user not found"*) hint="The user name in the URI must be postgres.yyrovakknsuanlolrlth (copy the Session pooler URI again)." ;;
    *) hint="Check SUPABASE_DB_URL (Session pooler URI, port 5432, password filled in)." ;;
  esac
  die "Could not connect to the database. $hint Details: $msg"
fi
pg_dump "$SUPABASE_DB_URL" --schema=public --no-owner --no-privileges -f "$OUT/database.sql" 2>"$WORK/err" \
  || die "Database copy failed: $(first_line < "$WORK/err")"
pg_dump "$SUPABASE_DB_URL" --table=auth.users --data-only --no-owner --no-privileges -f "$OUT/logins.sql" 2>"$WORK/err" \
  || die "Copy of the logins failed: $(first_line < "$WORK/err")"

# 2. The main tables as CSV, to open in Excel
for t in leads calls activities profiles campaigns wa_messages wa_templates nurture_sequences nurture_enrollments ai_calls lead_sources settings; do
  if psql "$SUPABASE_DB_URL" -Atqc "select to_regclass('public.$t') is not null" | grep -q t; then
    psql "$SUPABASE_DB_URL" -qc "\copy (select * from public.$t) to '$OUT/csv/$t.csv' with (format csv, header)" 2>"$WORK/err" \
      || die "Export of $t failed: $(first_line < "$WORK/err")"
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
echo "Database copied. Backup size: $(du -h "$ZIP" | cut -f1)"

# 3. Upload to Dropbox
TOK_JSON=$(curl -sS https://api.dropboxapi.com/oauth2/token \
  -d grant_type=refresh_token -d refresh_token="$DROPBOX_REFRESH_TOKEN" -d client_id="$DROPBOX_APP_KEY" || true)
TOKEN=$(jq -r '.access_token // empty' <<<"$TOK_JSON" 2>/dev/null || true)
if [ -z "$TOKEN" ]; then
  why=$(jq -r '(.error_description // .error // "no answer") | tostring' <<<"$TOK_JSON" 2>/dev/null || echo "no answer")
  die "Dropbox did not accept the key ($why). Open https://ggfacademy.github.io/dialbook/backup-setup.html again, get a new key and save DROPBOX_APP_KEY and DROPBOX_REFRESH_TOKEN again."
fi
echo "::add-mask::$TOKEN"
UP=$(curl -sS -w '\n%{http_code}' https://content.dropboxapi.com/2/files/upload \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/octet-stream" \
  -H "Dropbox-API-Arg: {\"path\":\"$FOLDER/dialbook-$DAY.zip\",\"mode\":\"overwrite\",\"mute\":true}" \
  --data-binary @"$ZIP" || true)
code=$(tail -n1 <<<"$UP")
if [ "$code" != "200" ]; then
  body=$(sed '$d' <<<"$UP" | head -c 300)
  case "$body" in
    *missing_scope*|*scope*) hint="In the Dropbox app → Permissions, tick files.content.write, files.content.read and files.metadata.read, press Submit, then get a new key on the setup page." ;;
    *insufficient_space*) hint="Your Dropbox is full." ;;
    *) hint="" ;;
  esac
  die "Upload to Dropbox failed (HTTP $code). $hint Details: $body"
fi
echo "Uploaded $FOLDER/dialbook-$DAY.zip"
echo "::notice title=Backup done::Saved dialbook-$DAY.zip in Dropbox $FOLDER"

# 4. Keep the last KEEP_DAYS days; only touches files named dialbook-YYYY-MM-DD.zip
CUT=$(TZ=Asia/Kolkata date -d "-$KEEP_DAYS days" +%F)
curl -sS https://api.dropboxapi.com/2/files/list_folder -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" -d "{\"path\":\"$FOLDER\",\"limit\":2000}" \
| jq -r '.entries[]? | select(.[".tag"]=="file") | .name' \
| { grep -E '^dialbook-[0-9]{4}-[0-9]{2}-[0-9]{2}\.zip$' || true; } \
| while read -r f; do
    d=${f#dialbook-}; d=${d%.zip}
    if [[ "$d" < "$CUT" ]]; then
      curl -sS --fail -o /dev/null https://api.dropboxapi.com/2/files/delete_v2 -H "Authorization: Bearer $TOKEN" \
        -H "Content-Type: application/json" -d "{\"path\":\"$FOLDER/$f\"}" && echo "Removed old $f"
    fi
  done || echo "::warning::Could not tidy old backups (the new one is saved)."
