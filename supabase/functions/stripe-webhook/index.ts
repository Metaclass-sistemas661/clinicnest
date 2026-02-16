import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createLogger } from "../_shared/logging.ts";
import { getCorsHeaders } from "../_shared/cors.ts";

const _logStep = createLogger("STRIPE-WEBHOOK");

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const jsonHeaders = { ...cors, "Content-Type": "application/json" };

  return new Response(
    JSON.stringify({
      error: "Stripe webhook desativado. A plataforma agora usa Asaas (corte total).",
    }),
    { status: 410, headers: jsonHeaders }
  );
});
