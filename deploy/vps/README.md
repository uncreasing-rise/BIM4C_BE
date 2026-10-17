# BIM4C on the VPS

Website (FE repo) and API (this repo) run as two Docker stacks on the VPS, behind
one shared Caddy that also serves BIM4C 4D/5D. Each stack is deployed on its own.

| Path on the server | What |
|---|---|
| `/opt/bim4c/be` | this repo; `.env` holds the API secrets (chmod 600, git-ignored) |
| `/opt/bim4c/fe` | FE repo; `.env` holds the website values (chmod 600, git-ignored) |
| `/opt/edge` | shared Caddy (from the 4D/5D repo `deploy/edge`); `sites/bim4c.caddy` is this folder's file; domains in `/opt/edge/.env` |

Containers: `be-api-1` (alias `bim4c-api:8080`), `fe-web-1` (alias `bim4c-web:3000`),
both on the Docker network `edge`. Neither publishes a port; only Caddy listens on 80/443.

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
(`DIRECT_URL`, port 5432), then run the workflow by hand (Actions → CI/CD → Run workflow) with
**migrations_applied** checked.

On the server:

```bash
deploy-app bim4c-api status          # commit running now (bim4c-web, bim4d5d too)
cat /var/lib/deploy/bim4c-api.previous   # image to go back to
# Roll back by hand: put that image in BE_IMAGE= in /opt/bim4c/be/.env, then
cd /opt/bim4c/be && docker compose -f docker-compose.prod.yml up -d --no-build api
```

Manual deploy without CI (emergency): `git pull`, remove the `BE_IMAGE=` line from `.env`, then
`docker compose -f docker-compose.prod.yml up -d --build`.

## Environment notes

- `DATABASE_URL` uses Supabase's transaction pooler, port **6543** (Prisma switches to
  `pgbouncer=true` automatically). `DIRECT_URL` stays on 5432 for migrations.
- `TRUST_PROXY=1` (set in `docker-compose.prod.yml`): behind Caddy, rate limits and
  audit logs see the visitor's IP instead of the proxy's.
- FE `BACKEND_URL=http://bim4c-api:8080`: server-side rendering calls the API over the
  private network. The browser uses `NEXT_PUBLIC_API_URL`.
- `REVALIDATION_URL` must be the public HTTPS website URL (the API validates this).
- `NEXT_PUBLIC_*` are baked into the FE image: rebuild FE after changing them.

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
