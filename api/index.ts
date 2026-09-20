import 'reflect-metadata';
import express, { Request, Response, NextFunction } from 'express';
import { NestFactory } from '@nestjs/core';
import { ExpressAdapter } from '@nestjs/platform-express';
import {
  UnprocessableEntityException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import { AppModule } from '../src/app.module';
import { ApiExceptionFilter } from '../src/common/filters/api-exception.filter';

const expressApp = express();
let isInitialized = false;

function validationException(
  errors: ValidationError[],
): UnprocessableEntityException {
  const fields = Object.fromEntries(
    errors.map((error) => [
      error.property,
      Object.values(error.constraints ?? {}),
    ]),
  );
  return new UnprocessableEntityException({
    message: 'Validation failed',
    code: 'VALIDATION_ERROR',
    errors: fields,
  });
}

async function bootstrap() {
  if (!isInitialized) {
    const app = await NestFactory.create(
      AppModule,
      new ExpressAdapter(expressApp),
      {
        bodyParser: false,
        bufferLogs: true,
      },
    );

    const config = app.get(ConfigService);
    const origins = (
      config.get<string>('CORS_ORIGINS') ??
      config.getOrThrow<string>('FRONTEND_URL')
    )
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean);

    app.use(helmet());
    app.use(cookieParser());
    app.use(json({ limit: '100kb' }));
    app.use(urlencoded({ extended: false, limit: '100kb' }));

    // Filter out numeric query parameters added by Vercel's rewrite rule
    app.use((request: Request, response: Response, next: NextFunction) => {
      if (request.query) {
        for (const key of Object.keys(request.query)) {
          if (/^\d+$/.test(key)) {
            delete request.query[key];
          }
        }
      }
      next();
    });

    app.enableCors({
      origin: origins,
      methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Authorization', 'Content-Type', 'X-Request-ID'],
      exposedHeaders: ['X-Request-ID'],
      credentials: true,
      maxAge: 86400,
    });

    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
        stopAtFirstError: false,
        exceptionFactory: validationException,
      }),
    );

    app.useGlobalFilters(new ApiExceptionFilter());

    await app.init();
    isInitialized = true;
  }
  return expressApp;
}

export default async function handler(req: any, res: any) {
  try {
    const server = await bootstrap();
    return server(req, res);
  } catch (err: any) {
    console.error('Vercel Serverless Bootstrap Error:', err);
    res.setHeader('Content-Type', 'application/json');
    return res.status(500).send(
      JSON.stringify({
        error: 'SERVERLESS_BOOTSTRAP_ERROR',
        message: err?.message || String(err),
        stack: process.env.NODE_ENV === 'production' ? undefined : err?.stack,
      }),
    );
  }
}
