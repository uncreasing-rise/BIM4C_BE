import { z } from 'zod';

const environmentBoolean = z.preprocess((value) => value === 'true' ? true : value === 'false' ? false : value, z.boolean()).default(false);

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().url().refine((value) => ['postgres:', 'postgresql:'].includes(new URL(value).protocol), 'Must be a PostgreSQL URL'),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().min(1).optional(),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  TEMPORARY_ADMIN_AUTH: environmentBoolean,
  AUTH_COOKIE_NAME: z.string().min(3).default('bim4c_admin_session'),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
  ADMIN_BOOTSTRAP_RESET_PASSWORD: environmentBoolean,
  REVALIDATION_URL: z.string().url().optional(),
  REVALIDATION_SECRET: z.string().min(32).optional(),
  MEDIA_STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_MEDIA_BUCKET: z.string().min(1).optional(),
  PUBLIC_API_URL: z.string().url().default('http://localhost:8080'),
  MEDIA_STORAGE_PATH: z.string().min(1).default('uploads'),
}).superRefine((env, context) => {
  if (env.NODE_ENV !== 'production') return;
  const issue = (path: string, message: string) => context.addIssue({ code: 'custom', path: [path], message });
  const publicHttps = (value: string) => {
    const url = new URL(value);
    return url.protocol === 'https:' && !['localhost', '127.0.0.1', '::1'].includes(url.hostname) && !/^192\.168\./.test(url.hostname);
  };
  if (!publicHttps(env.FRONTEND_URL)) issue('FRONTEND_URL', 'Production frontend origin must be public HTTPS');
  for (const origin of (env.CORS_ORIGINS ?? env.FRONTEND_URL).split(',').map((value) => value.trim())) {
    if (!publicHttps(origin)) issue('CORS_ORIGINS', 'Every production CORS origin must be public HTTPS');
  }
  if (env.REVALIDATION_URL && !publicHttps(env.REVALIDATION_URL)) issue('REVALIDATION_URL', 'Production revalidation URL must be public HTTPS');
  if (!env.REVALIDATION_SECRET) issue('REVALIDATION_SECRET', 'Required in production');
  if (env.MEDIA_STORAGE_DRIVER !== 'supabase') issue('MEDIA_STORAGE_DRIVER', 'Production media storage must use Supabase');
  if (!env.SUPABASE_URL) issue('SUPABASE_URL', 'Required in production');
  if (!env.SUPABASE_SERVICE_ROLE_KEY) issue('SUPABASE_SERVICE_ROLE_KEY', 'Required in production');
  if (!env.SUPABASE_MEDIA_BUCKET) issue('SUPABASE_MEDIA_BUCKET', 'Required in production');
  if (!publicHttps(env.PUBLIC_API_URL)) issue('PUBLIC_API_URL', 'Production public API URL must be public HTTPS');
  const databaseHost = new URL(env.DATABASE_URL).hostname;
  if (['localhost', '127.0.0.1', '::1'].includes(databaseHost) || /^192\.168\./.test(databaseHost)) issue('DATABASE_URL', 'Production database must not use a loopback or LAN host');
  if (env.TEMPORARY_ADMIN_AUTH) issue('TEMPORARY_ADMIN_AUTH', 'Must be false in production');
  if (env.ADMIN_BOOTSTRAP_RESET_PASSWORD) issue('ADMIN_BOOTSTRAP_RESET_PASSWORD', 'Must be false in production');
});
export type Environment = z.infer<typeof schema>;
export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  return result.data;
}
