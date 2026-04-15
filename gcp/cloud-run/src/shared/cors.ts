/**
 * CORS middleware
 * Replaces: _shared/.ts (dynamic CORS whitelist)
 */
import { Request, Response, NextFunction } from 'express';

const ALLOWED_ORIGINS = [
  process.env.FRONTEND_URL || 'https://clinicnest.metaclass.com.br',
  'https://clinicnest.metaclass.com.br',
  'https://clinicnest-app.web.app',
  'https://clinicnest-app.firebaseapp.com',
];

// Allow localhost in development
if (process.env.NODE_ENV !== 'production') {
  ALLOWED_ORIGINS.push('http://localhost:5173', 'http://localhost:3000', 'http://127.0.0.1:5173');
}

export function corsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const origin = req.headers.origin || '';
  const allowed = !origin || ALLOWED_ORIGINS.includes(origin) || origin.endsWith('.metaclass.com.br');

  if (allowed) {
    res.setHeader('Access-Control-Allow-Origin', origin || '*');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-secret-key,x-tenant-id');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Max-Age', '86400');

  if (req.method === 'OPTIONS') {
    res.status(204).end();
    return;
  }

  if (!allowed) {
    res.status(403).json({ error: 'Not allowed by CORS' });
    return;
  }

  next();
}
