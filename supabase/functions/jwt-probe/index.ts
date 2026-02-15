import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const authResult = await getAuthenticatedUser(req, cors);
  if (authResult.error) return authResult.error;

  return new Response(
    JSON.stringify({ ok: true, userId: authResult.user.id }),
    { headers: { ...cors, "Content-Type": "application/json" }, status: 200 }
  );
});
