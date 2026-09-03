import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
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

  const port = process.env.PORT ?? 3000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`WealthMatrix Enterprise API listening on :${port}`);
}
bootstrap();
