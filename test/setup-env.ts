process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.DIRECT_URL = 'postgresql://test:test@localhost:5432/test';
process.env.CORS_ORIGINS = 'http://localhost:3000';
process.env.TEMPORARY_ADMIN_AUTH = 'true';

// Prisma Client loads the developer's .env on import and fills every variable
// not already set, which handed tests the real Resend key (they emailed the
// live admin inbox), Supabase key and revalidation endpoint. Pin each outside
// integration to an inert value first; dotenv never overrides a set variable.
process.env.EMAIL_PROVIDER = 'none';
process.env.RESEND_API_KEY = 'test-disabled-key';
process.env.NOTIFICATION_ADMIN_EMAIL = 'admin@example.com';
process.env.APPOINTMENT_ADMIN_EMAIL = 'admin@example.com';
process.env.MAIL_REPLY_TO = 'admin@example.com';
process.env.MEDIA_STORAGE_DRIVER = 'local';
process.env.SUPABASE_URL = 'http://localhost:9';
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-disabled-service-role-key';
process.env.REVALIDATION_URL = 'http://localhost:9/api/revalidate';
process.env.REVALIDATION_SECRET = 'test-only-revalidation-secret-0123456789';
process.env.PUBLIC_API_URL = 'http://localhost:8080';
process.env.FRONTEND_URL = 'http://localhost:3000';
process.env.ADMIN_BOOTSTRAP_EMAIL = 'admin@example.com';
process.env.ADMIN_BOOTSTRAP_PASSWORD = 'test-only-bootstrap-password';
process.env.ADMIN_BOOTSTRAP_RESET_PASSWORD = 'false';
