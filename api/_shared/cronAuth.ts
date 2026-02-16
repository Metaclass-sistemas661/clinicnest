import type { VercelRequest } from "@vercel/node";

function parseBearerToken(req: VercelRequest): string | null {
  const header = req.headers.authorization;
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match?.[1] ?? null;
}

function parseCronSecretFallback(req: VercelRequest): string | null {
  const h = req.headers["x-cron-secret"];
  if (!h) return null;
  return Array.isArray(h) ? h[0] ?? null : h;
}

export function isCronAuthorized(req: VercelRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return true;
  const bearer = parseBearerToken(req);
  const fallback = parseCronSecretFallback(req);
  const token = bearer ?? fallback;
  return Boolean(token && token === cronSecret);
}
