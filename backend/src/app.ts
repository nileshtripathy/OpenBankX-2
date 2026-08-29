import express, { Application } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import { env } from './config/env';
import apiRouter from './routes';
import { notFoundHandler, errorHandler } from './middleware/error.middleware';
import { apiRateLimiter } from './middleware/rateLimit.middleware';

export function createApp(): Application {
  const app = express();

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientUrl,
      credentials: true, // required so refresh-token cookie is sent
    })
  );
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());
  app.use(morgan(env.isProd ? 'combined' : 'dev'));

  // NoSQL injection defense: strips any request key starting with '$' or
  // containing '.' from body/query/params (e.g. `{ "email": { "$ne": null } }`
  // used to bypass a naive `User.findOne({ email: req.body.email })` filter).
  // Applied globally, before routes, so every handler is covered by default
  // rather than relying on each one to sanitize its own input.
  app.use(
    mongoSanitize({
      replaceWith: '_',
      onSanitize: ({ key }: { key: string }) => {
        console.warn(`[sanitize] stripped a potential NoSQL injection key: "${key}"`);
      },
    })
  );

  app.use('/api', apiRateLimiter, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
