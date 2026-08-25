# Admin CMS

All `/admin/*` endpoints use the existing error envelope. Listings return `{ data, meta }`; details return `{ data }`. P0 authorization is intentionally temporary: the frontend server-side proxy reads `ADMIN_API_KEY` and sends `X-Admin-Key` to the backend. The key is never exposed to browser code. Set `TEMPORARY_ADMIN_AUTH=true`; users, roles and sessions remain P1.

Content modules provide list/detail/create/update/soft-delete, status changes and validated bulk publish/archive/delete. Project and post categories use `RESTRICT` behavior at the service boundary and return `409` while referenced. Project galleries and course curriculum use their existing relational tables; flexible page sections remain JSON.

Contacts and course registrations have `NEW`, `IN_PROGRESS`, `RESOLVED` and `SPAM` workflow states. Newsletter subscriptions retain idempotent public subscribe behavior and can be deactivated/reactivated by admin.

Media uses `MediaStorageService`. The P0 adapter stores image binaries outside PostgreSQL under `MEDIA_STORAGE_PATH`; PostgreSQL contains metadata only. This abstraction can be replaced by Supabase Storage without changing the admin UI or HTTP contract. Local files need persistent mounted storage in production.

Public APIs keep their cache headers. Admin mutations become visible to the public API immediately; the Next.js public pages may retain previously rendered data until their existing 1–10 minute revalidation interval. A tag/webhook invalidation endpoint is intentionally deferred until deployment has an authenticated revalidation strategy.
