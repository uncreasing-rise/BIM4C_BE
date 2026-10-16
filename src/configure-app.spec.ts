import type { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import type { Express } from 'express';
import { configureApp } from './configure-app';

async function appWith(
  values: Record<string, unknown>,
): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({
    providers: [
      {
        provide: ConfigService,
        useValue: new ConfigService({
          NODE_ENV: 'production',
          CORS_ORIGINS: 'http://localhost:3000',
          ...values,
        }),
      },
    ],
  }).compile();
  const app = moduleRef.createNestApplication();
  configureApp(app);
  return app;
}
const trustProxy = (app: INestApplication): unknown =>
  (app.getHttpAdapter().getInstance() as Express).get('trust proxy') as unknown;

describe('configureApp trust proxy', () => {
  it('trusts the configured number of reverse proxies so req.ip is the visitor', async () => {
    const app = await appWith({ TRUST_PROXY: 1 });
    expect(trustProxy(app)).toBe(1);
    await app.close();
  });

  it('trusts no proxy when unset (Vercel)', async () => {
    const app = await appWith({});
    expect(trustProxy(app)).toBeFalsy();
    await app.close();
  });
});
