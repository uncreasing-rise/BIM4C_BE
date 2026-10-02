# Transactional notifications and customer-selected appointments

Customers propose a start time in their device time zone and a duration of 30, 45, 60, 90 or 120 minutes, up to 120 days ahead. Requests remain pending until an administrator confirms. Active bookings cannot overlap; booking checks and inserts run in a serializable transaction. Availability rules and exceptions are no longer consulted or editable in the admin interface. Existing database records are retained.

## Languages and delivery

Public forms send `locale: vi | en`. Contact, course enquiries and newsletter welcome messages use that language. Appointments persist it for all subsequent status emails. Older bookings default to Vietnamese. Customer emails include their time zone and localized links. Internal notifications are in Vietnamese.

The shared template provides responsive table layout, inline styles, preheader, escaped customer content, summary, next steps, contextual action, request reference, support reply address and a plain-text alternative.

Notifications cover new appointment requests and confirmed, cancelled, completed and no-show statuses; contact and course enquiries notify both customer and team; newsletter signup sends a welcome message only when not already active. This does not send marketing campaigns or automatically email existing records.

Requests are saved before mail is attempted. Mail calls are awaited, with a timeout and one transient-error retry using the same Resend idempotency key. Provider failure does not undo a saved enquiry. API `notification.customer` / `notification.admin` values are `sent`, `failed` or `skipped`; `sent` means provider acceptance, not confirmed inbox delivery. The UI does not claim successful delivery for skipped/failed requests. There is no durable email queue or webhook delivery tracking yet; failed notifications are logged for operator follow-up.

## Configuration

- `EMAIL_PROVIDER=resend`, `RESEND_API_KEY`, and a sender authorized by Resend in `MAIL_FROM`.
- `NOTIFICATION_ADMIN_EMAIL`: recipient for internal notifications; falls back to `APPOINTMENT_ADMIN_EMAIL` for existing installations.
- `MAIL_REPLY_TO`: monitored support inbox; falls back to the internal notification address, then `bim4c.lab@gmail.com`. Admin notifications reply directly to the customer.
- `FRONTEND_URL`: public website origin used in email links. Set the production website origin on hosting.
- There is no calendar integration: confirmation emails explain that the BIM4C team will contact the customer directly.

Apply migrations with `npm run db:migrate` before deploying this backend, then regenerate Prisma (`npm run db:generate`) and build. The new migration adds `appointments.locale` with a backward-compatible default.

## Preview and validation

Run `npm run email:preview` to generate `.email-previews/index.html` and individual HTML/text samples in both languages. The preview generator uses fictional fixtures and never sends mail.

Run `npm test` and `npm run typecheck`. Provider tests mock network requests. Validate a real delivery separately with an authorized recipient after configuring the sender domain; browser previews cannot guarantee identical rendering in every version of Outlook or Gmail.
