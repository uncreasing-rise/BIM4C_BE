#!/usr/bin/env bash
# Nightly dump of the BIM4C database (the db service of docker-compose.prod.yml).
# Installed as /usr/local/bin/bim4c-backup-db, run by /etc/cron.d/bim4c (see README.md).
# Restore: docker compose -f docker-compose.prod.yml exec -T db \
#            pg_restore -U bim4c -d bim4c --clean --if-exists < <file>.dump
set -euo pipefail

dir=/var/backups/bim4c-db
keep_days=${KEEP_DAYS:-14}
mkdir -p "$dir"
chmod 700 "$dir"

file="$dir/bim4c-$(date +%Y%m%d-%H%M).dump"
cd /opt/bim4c/be
docker compose -f docker-compose.prod.yml exec -T db pg_dump -U bim4c -d bim4c -Fc > "$file.tmp"
# A dump that pg_restore cannot list is not a backup.
docker compose -f docker-compose.prod.yml exec -T db pg_restore --list < "$file.tmp" > /dev/null
mv "$file.tmp" "$file"
chmod 600 "$file"
find "$dir" -name 'bim4c-*.dump' -mtime +"$keep_days" -delete
echo "$(date -Is) $file $(stat -c %s "$file") bytes"
