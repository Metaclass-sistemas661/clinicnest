/**
 * CORS headers compartilhados para todas as Edge Functions.
 * Em produção: defina CORS_ALLOWED_ORIGINS (vírgula separada) para restringir origens.
 * Ex.: CORS_ALLOWED_ORIGINS=https://clinicnest.metaclass.com.br
 * Se não definido, usa "*" (desenvolvimento).
 */
const allowedOriginsEnv = Deno.env.get("CORS_ALLOWED_ORIGINS");
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin = (() => {
    if (allowedOrigins.length > 0) {
      return allowedOrigins.includes(origin) ? origin : "";
    }

    if (!origin) return "*";
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin)) return origin;

    return "*";
  })();
  return {
    ...(allowOrigin ? { "Access-Control-Allow-Origin": allowOrigin } : {}),
    "Vary": "Origin",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

/** Headers CORS padrão (usa CORS_ALLOWED_ORIGINS ou fallback p/ produção) */
const CORS_DEFAULT_ORIGIN =
  allowedOrigins.length > 0
    ? allowedOrigins[0]
    : "https://clinicnest.metaclass.com.br";

export const corsHeaders = {
  "Access-Control-Allow-Origin": CORS_DEFAULT_ORIGIN,
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
