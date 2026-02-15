import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const logStep = createLogger("CANCEL-SUBSCRIPTION");

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

    if (!user?.id || !user.email) {
      return new Response(JSON.stringify({ error: "Usuário não autenticado" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const rl = await checkRateLimit(`cancel-sub:${user.id}`, 5, 60);
    if (!rl.allowed) {
      return new Response(JSON.stringify({ error: "Muitas requisições" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 429,
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (profileError) {
      logStep("ERROR", { message: profileError.message });
      return new Response(JSON.stringify({ error: "Erro ao buscar tenant" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const tenantId = profileData?.tenant_id;
    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { data: subscriptionData, error: subscriptionError } = await supabaseAdmin
      .from("subscriptions")
      .select("id,status,asaas_subscription_id,billing_provider")
      .eq("tenant_id", tenantId)
      .maybeSingle();

    if (subscriptionError) {
      logStep("ERROR", { message: subscriptionError.message });
      return new Response(JSON.stringify({ error: "Erro ao buscar assinatura" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    if (!subscriptionData?.id) {
      return new Response(JSON.stringify({ error: "Assinatura não encontrada" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 404,
      });
    }

    if (!subscriptionData.asaas_subscription_id) {
      return new Response(
        JSON.stringify({ error: "Assinatura Asaas não vinculada neste tenant" }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 },
      );
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurada" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const apiBase = Deno.env.get("ASAAS_API_BASE_URL") || "https://api-sandbox.asaas.com";

    const asaasResp = await fetch(
      `${apiBase}/v3/subscriptions/${encodeURIComponent(subscriptionData.asaas_subscription_id)}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          "User-Agent": "salon-flow",
          access_token: asaasApiKey,
        },
        body: JSON.stringify({ status: "INACTIVE" }),
      },
    );

    const asaasText = await asaasResp.text();
    if (!asaasResp.ok) {
      logStep("ERROR: Asaas cancel failed", { status: asaasResp.status, body: asaasText.slice(0, 500) });
      return new Response(
        JSON.stringify({ error: `Erro ao cancelar no Asaas (${asaasResp.status})` }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 500 },
      );
    }

    await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "inactive",
        billing_provider: "asaas",
      })
      .eq("id", subscriptionData.id);

    logStep("Subscription inactivated", { tenantId, asaasSubscriptionId: subscriptionData.asaas_subscription_id });

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
