import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const logStep = createLogger("CUSTOMER-PORTAL");

serve(async (req) => {
  const cors = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  const authResult = await getAuthenticatedUser(req, cors);
  if (authResult.error) return authResult.error;
  const user = authResult.user;

  try {
    logStep("Function started");
    if (!user?.email) throw new Error("User not authenticated or email not available");
    logStep("User authenticated", { userId: user.id, email: user.email });

    const rl = await checkRateLimit(`portal:${user.id}`, 10, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Too many requests" }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        error: "Portal do Stripe foi desativado. Gerenciamento de assinatura agora é via Asaas.",
      }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 410,
      }
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
