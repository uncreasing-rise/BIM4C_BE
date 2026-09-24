import {
  type INestApplication,
  UnprocessableEntityException,
  ValidationPipe,
  type ValidationError,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import { json, urlencoded } from 'express';
import helmet from 'helmet';
import { ApiExceptionFilter } from './common/filters/api-exception.filter';

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

/**
 * Applies the HTTP pipeline shared by the long-running server (main.ts) and
 * the Vercel serverless entry (api/index.ts). Keep all middleware, CORS and
 * validation settings here so the two runtimes cannot drift apart.
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService);
  const origins = (
    config.get<string>('CORS_ORIGINS') ??
    config.getOrThrow<string>('FRONTEND_URL')
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  app.use(compression());
  app.use(helmet());
  app.use(cookieParser());
  app.use(json({ limit: '100kb' }));
  app.use(urlencoded({ extended: false, limit: '100kb' }));

  app.enableCors({
    origin: origins,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Origin',
      'Authorization',
      'Content-Type',
      'Accept',
      'X-Request-ID',
    ],
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

  // The OpenAPI document lists every admin route; do not publish it in production.
  if (config.get<string>('NODE_ENV') !== 'production') {
    const openApi = new DocumentBuilder()
      .setTitle('BIM4C REST API')
      .setDescription('Frontend-compatible public API for BIM4C')
      .setVersion('1.0')
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, openApi),
      { jsonDocumentUrl: 'api/docs-json' },
    );
  }
}
