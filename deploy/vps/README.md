# BIM4C on the VPS

The VPS (157.66.218.174) runs BIM4C only: the website (FE repo) and the API with its
PostgreSQL database (this repo), as two Docker stacks behind one Caddy. Each stack is
deployed on its own. BIM 4D/5D is a separate system and does not run here.

Nothing runs on Supabase: the database is the `db` service of `docker-compose.prod.yml` and
uploaded images are on the `media-data` volume, both on the VPS.

| Path on the server | What |
|---|---|
| `/opt/bim4c/be` | this repo; `.env` holds the API secrets and `POSTGRES_PASSWORD` (chmod 600, git-ignored) |
| `/opt/bim4c/fe` | FE repo; `.env` holds the website values (chmod 600, git-ignored) |
| `/opt/edge` | Caddy: copy of `deploy/vps/edge` (`bim4c.caddy` goes to `sites/`) |
| `/var/backups/bim4c-db` | nightly database dumps and image archives, 14 days (`backup-db.sh`) |

Containers: `be-api-1` (alias `bim4c-api:8080`), `fe-web-1` (alias `bim4c-web:3000`),
both on the Docker network `edge`, and `be-db-1` (PostgreSQL 16, volume `be_db-data`) on the
API stack's private network only. Nothing publishes a port; only Caddy listens on 80/443.

## Deploying (CI/CD)

Pushing to `main` deploys automatically once CI is green (`.github/workflows/ci.yml`):

1. **verify**: typecheck, lint, tests, e2e, build, migrations on an empty database, schema drift, npm audit.
2. **image**: builds `ghcr.io/uncreasing-rise/bim4c_be:<commit>` (FE: `bim4c_fe`, built with the repository
   variables `NEXT_PUBLIC_API_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_CDN_URL`) and pushes it to GHCR.
3. **deploy**: SSH with the `VPS_DEPLOY_KEY` secret. On the server that key can only run
   `/usr/local/bin/deploy-app <app> <commit>` (forced command in root's `authorized_keys`). deploy-app checks out
   that commit, pulls the image with the job's short-lived token, swaps the container, waits until it is healthy and
   running that exact image, and otherwise rolls back to the previous image.

**Migrations stop the deploy.** If the release adds a migration that the commit running on the VPS does not have,
the deploy job fails before touching anything. Back up, run `npx prisma migrate deploy` against production
(`docker compose -f docker-compose.prod.yml run --rm api npx prisma migrate deploy`), then run the workflow by hand (Actions → CI/CD → Run workflow) with
**migrations_applied** checked.

On the server:

```bash
deploy-app bim4c-api status          # commit running now (bim4c-web too)
cat /var/lib/deploy/bim4c-api.previous   # image to go back to
# Roll back by hand: put that image in BE_IMAGE= in /opt/bim4c/be/.env, then
cd /opt/bim4c/be && docker compose -f docker-compose.prod.yml up -d --no-build api
```

Manual deploy without CI (emergency): `git pull`, remove the `BE_IMAGE=` line from `.env`, then
`docker compose -f docker-compose.prod.yml up -d --build`.

## Environment notes

- `DATABASE_URL` and `DIRECT_URL` are both `postgresql://bim4c:<POSTGRES_PASSWORD>@db:5432/bim4c?schema=public`.
- Uploaded images: `MEDIA_STORAGE_DRIVER=local`, `MEDIA_STORAGE_PATH=/app/uploads` (set in
  `docker-compose.prod.yml`, volume `be_media-data`), served at `https://api.bim4c.vn/media/files/<key>`.
- The container healthcheck calls `/ready` (database reachable and schema compatible), so a
  release that cannot reach the database is rolled back by deploy-app.
- `TRUST_PROXY=1` (set in `docker-compose.prod.yml`): behind Caddy, rate limits and
  audit logs see the visitor's IP instead of the proxy's.
- FE `BACKEND_URL=http://bim4c-api:8080`: server-side rendering calls the API over the
  private network. The browser uses `NEXT_PUBLIC_API_URL`.
- `REVALIDATION_URL` must be the public HTTPS website URL (the API validates this).
- `NEXT_PUBLIC_*` are baked into the FE image: rebuild FE after changing them.

## Backups and monitoring

`backup-db.sh` and `monitor.sh` are installed as `/usr/local/bin/bim4c-backup-db` and
`/usr/local/bin/bim4c-monitor`, run by `/etc/cron.d/bim4c`:

```
30 2 * * * root /usr/local/bin/bim4c-backup-db >> /var/log/bim4c-backup.log 2>&1
*/5 * * * * root /usr/local/bin/bim4c-monitor > /dev/null 2>&1
```

The monitor emails `NOTIFICATION_ADMIN_EMAIL` (else `APPOINTMENT_ADMIN_EMAIL`) through Resend when
`/ready` or the website fails twice in a row or the newest dump is older than 36 hours, and again
when everything is back. Backups stay on the VPS: copy them off the server now and then
(`scp bim4c-vps:/var/backups/bim4c-db/<file> .`).

Restore a dump and the images:

```bash
cd /opt/bim4c/be
docker compose -f docker-compose.prod.yml exec -T db pg_restore -U bim4c -d bim4c --clean --if-exists < /var/backups/bim4c-db/<file>.dump
docker compose -f docker-compose.prod.yml exec -T api tar -xzf - -C /app/uploads < /var/backups/bim4c-db/media-<date>.tgz
```

## Domains

Since 17 Oct 2026 `www.bim4c.vn`, `bim4c.vn` (301 to www) and `api.bim4c.vn` are Cloudflare A records
(DNS only) pointing at the VPS; Caddy obtains and renews the Let's Encrypt certificates. Email records (MX, SPF,
DKIM for Resend, DMARC) live in the same Cloudflare zone and must not be touched.

If the zone is switched to proxied (orange cloud): set SSL to Full (strict), and make Caddy trust Cloudflare's
ranges and read `CF-Connecting-IP`, otherwise rate limits and analytics see Cloudflare's IPs. Analytics then
also gets the visitor's country from `CF-IPCountry`.

After editing anything mounted into Caddy (new site file, `.env`), recreate the container
(`docker compose up -d --force-recreate`); `caddy reload` alone does not pick up a new
mount or new environment values.
