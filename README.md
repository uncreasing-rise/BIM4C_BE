# BIM4C Backend

NestJS 11 REST API, Prisma 6 and PostgreSQL 16 for the BIM4C frontend.

## Requirements

- Node.js 22+
- npm 10+
- PostgreSQL 16, or Docker with Compose

## Installation

```bash
npm install
copy .env.example .env
npm run db:generate
npm run db:migrate
npm run db:seed
npm run start:dev
```

## Environment variables

`DATABASE_URL` is required. `PORT`, `FRONTEND_URL`, `CORS_ORIGINS`, `RATE_LIMIT_TTL_MS` and `RATE_LIMIT_MAX` have explicit development defaults in `.env.example`. `CORS_ORIGINS` accepts a comma-separated allowlist. No secret is exposed to FE.

## Database

Production uses committed migrations:

```bash
npm run db:migrate
npm run db:seed
```

Use `npm run db:migrate:dev` only while authoring a new development migration. Seed uses slug upserts and is safe to rerun.

## Development and production

```bash
npm run start:dev
npm run build
npm run start:prod
```

Docker development:

```bash
docker compose build
docker compose up -d postgres
docker compose run --rm backend npx prisma migrate deploy
docker compose run --rm backend npm run db:seed
docker compose up backend
```

## API and operations

- Swagger UI: `http://localhost:8080/api/docs`
- OpenAPI JSON: `http://localhost:8080/api/docs-json`
- Liveness: `GET /health`
- Readiness/DB: `GET /ready`

Public content has HTTP cache headers; mutations are not cached. Global validation uses a 100 KB body limit, strict DTO whitelist, normalized error envelope, CORS allowlist, request IDs and rate limiting. Contact payload bodies and personal data are never logged.

## Quality

```bash
npm run lint
npm run typecheck
npm test
npm run test:e2e
npm run test:smoke
```

`test:e2e` verifies the complete HTTP/controller/service contract with an isolated Prisma test double. `test:smoke` verifies a running, migrated and seeded PostgreSQL-backed API at `API_URL` (default `http://localhost:8080`). Production must additionally define backup/restore policy, migration rollout/rollback, error monitoring and secret management.

See [architecture](docs/architecture.md) and [frontend integration](docs/frontend-integration.md).
Admin CMS endpoints, temporary authentication, media storage and cache behavior are documented in [admin CMS](docs/admin-cms.md).
