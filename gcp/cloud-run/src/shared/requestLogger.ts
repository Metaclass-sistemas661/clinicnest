/**
 * Request Audit Logger — Enterprise-grade request/response logging.
 * 
 * Logs: method, path, status, duration, userId, tenantId, correlationId, contentLength.
 * Uses Cloud Logging severity levels for automatic parsing by GCP.
 */
import { Request, Response, NextFunction } from 'express';

const IS_PRODUCTION = process.env.NODE_ENV === 'production';

// Paths that produce excessive noise at INFO level
const QUIET_PATHS = new Set(['/health', '/favicon.ico']);

export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = process.hrtime.bigint();

  // Hook into response finish
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1e6;
    const status = res.statusCode;
    const user = (req as any).user;
    const correlationId = (req as any).correlationId;

    const isQuiet = QUIET_PATHS.has(req.path);
    const isError = status >= 500;
    const isWarn = status >= 400 && status < 500;

    // Skip health checks in production unless they fail
    if (isQuiet && !isError && IS_PRODUCTION) return;

    const entry: Record<string, any> = {
      severity: isError ? 'ERROR' : isWarn ? 'WARNING' : 'INFO',
      message: `${req.method} ${req.path} ${status} ${durationMs.toFixed(1)}ms`,
      httpRequest: {
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status,
        latency: `${(durationMs / 1000).toFixed(3)}s`,
        remoteIp: req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() || req.ip,
        userAgent: req.headers['user-agent'],
        responseSize: res.getHeader('content-length'),
      },
      ...(correlationId && { 'logging.googleapis.com/trace': correlationId }),
      ...(user?.uid && { userId: user.uid }),
      ...(user?.tenant_id && { tenantId: user.tenant_id }),
      ...(durationMs > 5000 && { slowRequest: true }),
    };

    if (IS_PRODUCTION) {
      console.log(JSON.stringify(entry));
    } else {
      const color = isError ? '\x1b[31m' : isWarn ? '\x1b[33m' : '\x1b[32m';
      console.log(
        `${color}${req.method}\x1b[0m ${req.path} → ${status} (${durationMs.toFixed(0)}ms)` +
        (user?.uid ? ` [user:${user.uid.slice(0, 8)}]` : '')
      );
    }
  });

  next();
}
