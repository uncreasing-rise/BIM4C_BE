import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(8080),
  DATABASE_URL: z.string().min(1),
  FRONTEND_URL: z.string().url().default('http://localhost:3000'),
  CORS_ORIGINS: z.string().min(1).optional(),
  RATE_LIMIT_TTL_MS: z.coerce.number().int().positive().default(60000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  TEMPORARY_ADMIN_AUTH: z.coerce.boolean().default(false),
  AUTH_COOKIE_NAME: z.string().min(3).default('bim4c_admin_session'),
  AUTH_SESSION_TTL_HOURS: z.coerce.number().int().min(1).max(168).default(8),
  ADMIN_BOOTSTRAP_EMAIL: z.string().email().optional(),
  ADMIN_BOOTSTRAP_PASSWORD: z.string().min(12).optional(),
  REVALIDATION_URL: z.string().url().optional(),
  REVALIDATION_SECRET: z.string().min(32).optional(),
  MEDIA_STORAGE_DRIVER: z.enum(['local', 'supabase']).default('local'),
  SUPABASE_URL: z.string().url().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20).optional(),
  SUPABASE_MEDIA_BUCKET: z.string().min(1).optional(),
  SUPABASE_STORAGE_BUCKET: z.string().min(1).default('media'),
  PUBLIC_API_URL: z.string().url().default('http://localhost:8080'),
  MEDIA_STORAGE_PATH: z.string().min(1).default('uploads'),
});
export type Environment = z.infer<typeof schema>;
export function validateEnvironment(input: Record<string, unknown>): Environment {
  const result = schema.safeParse(input);
  if (!result.success) throw new Error(`Invalid environment: ${result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ')}`);
  return result.data;
}
