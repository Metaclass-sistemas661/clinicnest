/**
 * CORS headers compartilhados para todas as Edge Functions.
 * Em produção: defina SUPABASE_CORS_ORIGINS (vírgula separada) para restringir origens.
 * Ex.: SUPABASE_CORS_ORIGINS=https://vynlobella.com,https://www.vynlobella.com
 * Se não definido, usa "*" (desenvolvimento).
 */
const allowedOriginsEnv = Deno.env.get("SUPABASE_CORS_ORIGINS");
const allowedOrigins = allowedOriginsEnv
  ? allowedOriginsEnv.split(",").map((o) => o.trim()).filter(Boolean)
  : [];

export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("origin") ?? "";
  const allowOrigin =
    allowedOrigins.length > 0
      ? allowedOrigins.includes(origin)
        ? origin
        : allowedOrigins[0]
      : "*";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  };
}

/** Headers CORS com "*" (comportamento anterior para compatibilidade) */
export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};
