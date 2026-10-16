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

## Update

```bash
cd /opt/bim4c/be && git pull && docker compose -f docker-compose.prod.yml up -d --build
cd /opt/bim4c/fe && git pull && docker compose -f docker-compose.prod.yml up -d --build
```

Migrations are never run on start. When a release adds one, back up the database
first (see the root DEPLOYMENT.md), then run it once from a machine with the repo:
`npx prisma migrate deploy` with `DIRECT_URL` (port 5432).

## Environment differences from Vercel

- `DATABASE_URL` uses Supabase's transaction pooler, port **6543** (Prisma switches to
  `pgbouncer=true` automatically). `DIRECT_URL` stays on 5432 for migrations.
- `TRUST_PROXY=1` (set in `docker-compose.prod.yml`): behind Caddy, rate limits and
  audit logs see the visitor's IP instead of the proxy's.
- FE `BACKEND_URL=http://bim4c-api:8080`: server-side rendering calls the API over the
  private network. The browser uses `NEXT_PUBLIC_API_URL`.
- `REVALIDATION_URL` must be the public HTTPS website URL (the API validates this).
- `NEXT_PUBLIC_*` are baked into the FE image: rebuild FE after changing them.

## Switching the real domains to the VPS

1. In `/opt/edge/.env` set `BIM4C_WEB_DOMAIN=www.bim4c.vn` and `BIM4C_API_DOMAIN=api.bim4c.vn`
   (add a `bim4c.vn` block redirecting to `www` in `sites/bim4c.caddy`).
2. API `.env`: `PUBLIC_API_URL=https://api.bim4c.vn`, `FRONTEND_URL=https://www.bim4c.vn`,
   `REVALIDATION_URL=https://www.bim4c.vn/api/revalidate`, keep `www.bim4c.vn` and `bim4c.vn` in `CORS_ORIGINS`.
3. FE `.env`: `NEXT_PUBLIC_APP_URL=https://www.bim4c.vn`, `NEXT_PUBLIC_API_URL=https://api.bim4c.vn`, `FRONTEND_URL=https://www.bim4c.vn`.
4. DNS: point `bim4c.vn`, `www.bim4c.vn`, `api.bim4c.vn` to the VPS IP (A records; if they
   stay proxied through Cloudflare, set SSL mode to Full (strict)).
5. Rebuild both stacks, `cd /opt/edge && docker compose up -d --force-recreate`, check
   `https://api.bim4c.vn/ready`, the home page and the admin login, then remove the Vercel projects' domains.

After editing anything mounted into Caddy (new site file, `.env`), recreate the container
(`docker compose up -d --force-recreate`); `caddy reload` alone does not pick up a new
mount or new environment values.
