/**
 * Cliente Supabase admin (service_role) para Edge Functions.
 * Use apenas em funções server-side (ex.: webhooks) que precisam de acesso elevado.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export function createSupabaseAdmin() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
