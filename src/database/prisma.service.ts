import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  constructor() {
    // Hosted poolers have a small server-side session limit. Prisma's default
    // pool is based on CPU count and can otherwise open too many sessions per
    // backend process. Keep this safe by default; explicit URL values still win.
    const databaseUrl = process.env.DATABASE_URL;
    const url = databaseUrl ? new URL(databaseUrl) : undefined;
    if (url) {
      if (!url.searchParams.has('connection_limit'))
        url.searchParams.set('connection_limit', '5');
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
