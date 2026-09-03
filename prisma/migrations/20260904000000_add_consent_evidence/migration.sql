ALTER TABLE "contacts"
  ADD COLUMN "consent_given" BOOLEAN,
  ADD COLUMN "consent_at" TIMESTAMPTZ(3),
  ADD COLUMN "privacy_policy_version" VARCHAR(64),
  ADD COLUMN "consent_source" VARCHAR(64);

ALTER TABLE "course_registrations"
  ADD COLUMN "consent_given" BOOLEAN,
  ADD COLUMN "consent_at" TIMESTAMPTZ(3),
  ADD COLUMN "privacy_policy_version" VARCHAR(64),
  ADD COLUMN "consent_source" VARCHAR(64);

ALTER TABLE "newsletter_subscriptions"
  ADD COLUMN "consent_at" TIMESTAMPTZ(3),
  ADD COLUMN "privacy_policy_version" VARCHAR(64),
  ADD COLUMN "consent_source" VARCHAR(64);
