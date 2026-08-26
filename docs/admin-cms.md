# Admin CMS

All `/admin/*` endpoints use the existing error envelope. Listings return `{ data, meta }`; details return `{ data }`. Admin authentication uses an HTTP-only session cookie issued by the backend. The frontend proxy forwards that cookie, while the backend enforces session expiry, permissions, and origin checks. `AUTH_COOKIE_NAME` and `AUTH_SESSION_TTL_HOURS` have defaults and only need ENV entries when overridden.

Content modules provide list/detail/create/update/soft-delete, status changes and validated bulk publish/archive/delete. Project and post categories use `RESTRICT` behavior at the service boundary and return `409` while referenced. Project galleries and course curriculum use their existing relational tables; flexible page sections remain JSON.

Contacts and course registrations have `NEW`, `IN_PROGRESS`, `RESOLVED` and `SPAM` workflow states. Newsletter subscriptions retain idempotent public subscribe behavior and can be deactivated/reactivated by admin.

Media uses `MediaStorageService`. Local development stores image binaries outside PostgreSQL under `MEDIA_STORAGE_PATH`; PostgreSQL contains metadata only. Production uses Supabase Storage through `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_MEDIA_BUCKET` without changing the admin UI or HTTP contract.

Public APIs keep their cache headers. After an admin mutation, the backend calls `REVALIDATION_URL` with `REVALIDATION_SECRET` so affected Next.js cache tags are invalidated immediately. Time-based revalidation remains the fallback.
