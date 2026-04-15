/**
 * Error handler middleware — logs errors and reports to Sentry.
 */
import { Request, Response, NextFunction } from 'express';
import * as Sentry from '@sentry/node';

export function errorHandler(err: any, req: Request, res: Response, _next: NextFunction) {
  const correlationId = (req as any).correlationId;

  // Report to Sentry with context
  if (process.env.SENTRY_DSN) {
    Sentry.withScope(scope => {
      if (correlationId) scope.setTag('correlationId', correlationId);
      scope.setTag('path', req.path);
      scope.setTag('method', req.method);
      const user = (req as any).user;
      if (user?.uid) scope.setUser({ id: user.uid });
      Sentry.captureException(err);
    });
  }

  console.error('[Error]', err.message || err);
  
  if (err.message === 'Not allowed by CORS') {
    return res.status(403).json({ error: 'CORS not allowed' });
  }

  const status = err.statusCode || err.status || 500;
  res.status(status).json({
    error: process.env.NODE_ENV === 'production'
      ? 'Internal server error'
      : err.message,
  });
}
