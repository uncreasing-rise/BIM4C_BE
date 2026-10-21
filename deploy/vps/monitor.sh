#!/usr/bin/env bash
# Checks BIM4C every few minutes and emails the team when something breaks and
# when it recovers. Installed as /usr/local/bin/bim4c-monitor, run by /etc/cron.d/bim4c.
# Mail goes through Resend with the API's own settings in /opt/bim4c/be/.env.
#
# Checks: the API can reach its database (/ready), the website answers, and the
# newest database backup is less than a day and a half old.
set -uo pipefail

env_file=/opt/bim4c/be/.env
state_dir=/var/lib/bim4c-monitor
mkdir -p "$state_dir"

setting() { grep -E "^$1=" "$env_file" | head -1 | cut -d= -f2- | sed -E 's/^"(.*)"$/\1/'; }

problems=()
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://api.bim4c.vn/ready)
[ "$code" = 200 ] || problems+=("API/database: https://api.bim4c.vn/ready trả về HTTP $code")
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 https://www.bim4c.vn/vi)
[ "$code" = 200 ] || problems+=("Website: https://www.bim4c.vn/vi trả về HTTP $code")
newest=$(find /var/backups/bim4c-db -name 'bim4c-*.dump' -mmin -2160 2>/dev/null | head -1)
[ -n "$newest" ] || problems+=("Sao lưu: không có bản sao lưu database nào trong 36 giờ qua (/var/backups/bim4c-db)")

# One failed run can be a blip: alert after two in a row, and once on recovery.
fails=$(cat "$state_dir/fails" 2>/dev/null || echo 0)
alerted=$(cat "$state_dir/alerted" 2>/dev/null || echo 0)
if [ ${#problems[@]} -gt 0 ]; then
  fails=$((fails + 1))
  subject="[BIM4C] Hệ thống đang lỗi"
  body=$(printf '%s\n' "${problems[@]}")
  send=$([ "$fails" -ge 2 ] && [ "$alerted" = 0 ] && echo 1 || echo 0)
  [ "$send" = 1 ] && alerted=1
else
  fails=0
  subject="[BIM4C] Hệ thống đã hoạt động lại"
  body="Mọi kiểm tra đều bình thường."
  send=$alerted
  alerted=0
fi
echo "$fails" > "$state_dir/fails"

if [ "$send" = 1 ]; then
  to=$(setting NOTIFICATION_ADMIN_EMAIL)
  [ -n "$to" ] || to=$(setting APPOINTMENT_ADMIN_EMAIL)
  payload=$(FROM="$(setting MAIL_FROM)" TO="$to" SUBJECT="$subject" \
    TEXT="$body"$'\n\n'"Máy chủ: $(hostname), $(date -Is)" python3 -c \
    'import json, os; print(json.dumps({"from": os.environ["FROM"], "to": [os.environ["TO"]], "subject": os.environ["SUBJECT"], "text": os.environ["TEXT"]}))')
  if ! curl -fsS --max-time 20 https://api.resend.com/emails \
      -H "Authorization: Bearer $(setting RESEND_API_KEY)" \
      -H 'Content-Type: application/json' -d "$payload" > /dev/null; then
    # Not sent: keep the previous alert state so the next run tries again.
    [ ${#problems[@]} -gt 0 ] && alerted=0 || alerted=1
  fi
fi
echo "$alerted" > "$state_dir/alerted"
[ ${#problems[@]} -eq 0 ] || { printf '%s\n' "${problems[@]}" >&2; exit 1; }
