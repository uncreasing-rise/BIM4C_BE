import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Hosted poolers have a small server-side session limit. This is especially
    // important on Vercel, where several serverless instances may be active at
    // once. One connection per Prisma client avoids exhausting the pool; an
    // explicit connection_limit in DATABASE_URL still wins.
    const databaseUrl = process.env.DATABASE_URL;
    const url = databaseUrl ? new URL(databaseUrl) : undefined;
    if (url) {
      const isServerless =
        process.env.VERCEL === '1' ||
        !!process.env.VERCEL_ENV ||
        !!process.env.AWS_LAMBDA_FUNCTION_NAME;
      if (isServerless) {
        // Do not let a copied DATABASE_URL with connection_limit=5 exhaust
        // Supabase's shared pool across concurrent Vercel instances.
        url.searchParams.set('connection_limit', '1');
      } else if (!url.searchParams.has('connection_limit')) {
        url.searchParams.set('connection_limit', '5');
      }
      // Supabase's transaction pooler (6543) must not use session-bound
      // prepared statements. Prisma's pgbouncer mode disables that behavior.
      if (
        url.port === '6543' &&
        url.hostname.endsWith('.pooler.supabase.com') &&
        !url.searchParams.has('pgbouncer')
      ) {
        url.searchParams.set('pgbouncer', 'true');
      }
      if (!url.searchParams.has('pool_timeout'))
        url.searchParams.set('pool_timeout', '20');
    }
    super(url ? { datasources: { db: { url: url.toString() } } } : undefined);
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }
  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
