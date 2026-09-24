import 'reflect-metadata';
import express, {
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/configure-app';

type ExpressApp = ReturnType<typeof express>;

const expressApp = express();
let initializationPromise: Promise<ExpressApp> | undefined;

// Vercel can invoke the same cold-started function concurrently. Keep a single
// in-flight bootstrap promise so concurrent requests do not create multiple
// Nest applications (and multiple Prisma pools).
function bootstrap(): Promise<ExpressApp> {
  initializationPromise ??= (async () => {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      { bufferLogs: true },
    );
    // Drop numeric query parameters that Vercel's catch-all rewrite appends.
    app.use((request: Request, _response: Response, next: NextFunction) => {
      for (const key of Object.keys(request.query ?? {}))
        if (/^\d+$/.test(key)) delete (request.query as Record<string, unknown>)[key];
      next();
    });
    configureApp(app);
    await app.init();
    return expressApp;
  })().catch((error: unknown) => {
    // Allow a later invocation to retry if initialization failed.
    initializationPromise = undefined;
    throw error;
  });
  return initializationPromise;
}

export default async function handler(req: Request, res: Response) {
  try {
    const server = await bootstrap();
    server(req, res);
  } catch (error) {
    Logger.error(
      'Serverless bootstrap failed',
      error instanceof Error ? error.stack : String(error),
      'Bootstrap',
    );
    res.status(500).json({
      message: 'Service temporarily unavailable',
      code: 'SERVERLESS_BOOTSTRAP_ERROR',
    });
  }
}
