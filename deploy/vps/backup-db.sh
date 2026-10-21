#!/usr/bin/env bash
# Nightly backup of BIM4C: the database (db service of docker-compose.prod.yml)
# and the uploaded images (media-data volume).
# Installed as /usr/local/bin/bim4c-backup-db, run by /etc/cron.d/bim4c (see README.md).
# Restore: docker compose -f docker-compose.prod.yml exec -T db \
#            pg_restore -U bim4c -d bim4c --clean --if-exists < <file>.dump
#          docker compose -f docker-compose.prod.yml exec -T api tar -xzf - -C /app/uploads < media-<date>.tgz
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

# Uploaded images (media-data volume) next to the dump of the rows that point at them.
media="$dir/media-$(date +%Y%m%d-%H%M).tgz"
docker compose -f docker-compose.prod.yml exec -T api tar -czf - -C /app/uploads . > "$media.tmp"
tar -tzf "$media.tmp" > /dev/null
mv "$media.tmp" "$media"
chmod 600 "$media"

find "$dir" \( -name 'bim4c-*.dump' -o -name 'media-*.tgz' \) -mtime +"$keep_days" -delete
echo "$(date -Is) $file $(stat -c %s "$file") bytes, $media $(stat -c %s "$media") bytes"
