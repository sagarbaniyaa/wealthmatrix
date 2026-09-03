import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { initSentry } from './common/sentry';

// Must run before the app (and everything it imports) boots, so Sentry
// can instrument as much as possible — see common/sentry.ts. A no-op if
// SENTRY_DSN isn't set.
initSentry();

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  // Needed for req.protocol/req.hostname to report the real public
  // scheme/host behind Render's reverse proxy — required for Twilio's
  // webhook signature validation, which checks against the exact
  // public URL it called (see TelephonyWebhookController).
  app.set('trust proxy', true);

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.enableCors({ origin: true, credentials: true });

  // Schema-only documentation: generated from the same DTOs and route
  // decorators the app already uses for validation, via the
  // @nestjs/swagger compiler plugin (nest-cli.json) reading the
  // existing class-validator annotations — no hand-written duplicate
  // schema to fall out of sync. Never renders real data (it's a static
  // description of shapes, not a data browser), so it's safe to leave
  // reachable the same way GitHub's or Stripe's own API docs are.
  const swaggerConfig = new DocumentBuilder()
    .setTitle('WealthMatrix Enterprise API')
    .setDescription(
      'REST API for the WealthMatrix adviser platform: households, ' +
        'holdings, CGT/DFM/retirement analysis, compliance, documents, ' +
        'email and telephony integration. Every endpoint below (other ' +
        'than /auth/login and the Twilio webhook) requires a JWT ' +
        `bearer token obtained from POST /auth/login.`,
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' },
      'jwt',
    )
    .build();
  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/docs', app, swaggerDocument);

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`WealthMatrix Enterprise API listening on :${port}`);
}
bootstrap();
