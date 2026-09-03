# Frontend integration

Backend intentionally has no global API prefix because the current FE endpoint constants are `/projects`, `/services`, `/courses`, `/posts`, `/contact`, `/course-registrations` and `/newsletter/subscriptions`.

```env
NEXT_PUBLIC_API_URL=http://localhost:8080
NEXT_PUBLIC_CDN_URL=
NEXT_PUBLIC_USE_MOCK_API=false
```

Seed media paths point to existing FE assets (`/images/...`), so CDN URL remains empty locally. A production Backend/CDN can return absolute URLs or configure `NEXT_PUBLIC_CDN_URL`; remote hosts must be added to FE `next.config.ts`.

## Contract reconciliation

| Endpoint                         | FE expected                        | BE implementation | Status |
| -------------------------------- | ---------------------------------- | ----------------- | ------ |
| GET `/services[/:slug]`          | array/detail, 404                  | exact             | Match  |
| GET `/projects[/:slug]`          | filters, envelope/detail, 404      | exact             | Match  |
| GET `/courses[/:slug]`           | array/detail, 404                  | exact             | Match  |
| GET `/posts[/:slug]`             | filters, envelope/detail, 404      | exact             | Match  |
| POST `/contact`                  | validated success/error            | exact             | Match  |
| POST `/course-registrations`     | course UUID and success/error      | exact             | Match  |
| POST `/newsletter/subscriptions` | email, consent, idempotent success | exact             | Match  |

The prose request mentioned `/newsletter-subscriptions`, but FE source and FE contract use `/newsletter/subscriptions`; Backend follows FE source. Course response includes `id`, but the current FE content mapper discards it and no course-registration UI exists. A future registration UI must retain that existing DTO `id`; the Backend contract does not need to change.
