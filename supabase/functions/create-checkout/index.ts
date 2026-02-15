import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const logStep = createLogger("CREATE-CHECKOUT");

// VynloBella pricing plans
const PLANS = {
  monthly: {
    name: "Mensal",
    amount: 7990,
    cycle: "MONTHLY",
  },
  quarterly: {
    name: "Trimestral",
    amount: 20970,
    cycle: "QUARTERLY",
  },
  annual: {
    name: "Anual",
    amount: 59880,
    cycle: "YEARLY",
  },
};

function sanitizeCpfCnpj(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

function toDueDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

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

    const { planKey } = await req.json();
    if (!planKey || !PLANS[planKey as keyof typeof PLANS]) {
      return new Response(JSON.stringify({ error: "Plano inválido" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 400,
      });
    }

    const plan = PLANS[planKey as keyof typeof PLANS];
    logStep("Plan selected", { planKey, cycle: plan.cycle });

    if (!user?.email) {
      return new Response(JSON.stringify({ error: "Usuário sem e-mail" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 403,
      });
    }
    logStep("User authenticated", { userId: user.id, email: user.email });

    const rl = await checkRateLimit(`checkout:${user.id}`, 5, 60);
    if (!rl.allowed) {
      return new Response(
        JSON.stringify({ error: "Muitas requisições. Tente novamente em alguns minutos." }),
        { status: 429, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (!supabaseUrl || !supabaseServiceRoleKey) {
      return new Response(
        JSON.stringify({ error: "Configuração do servidor incompleta" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { persistSession: false },
    });

    const { data: profileData, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      logStep("ERROR", { message: profileError.message });
      return new Response(JSON.stringify({ error: "Erro ao buscar tenant" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const tenantId = profileData?.tenant_id ?? "";
    logStep("Got tenant", { tenantId });

    if (!tenantId) {
      return new Response(JSON.stringify({ error: "Tenant não encontrado" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 403,
      });
    }

    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .select("name,email,phone,address,billing_cpf_cnpj")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      logStep("ERROR", { message: tenantError.message });
      return new Response(JSON.stringify({ error: "Erro ao buscar dados de faturamento" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const cpfCnpj = sanitizeCpfCnpj(tenantData?.billing_cpf_cnpj ?? "");
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      return new Response(
        JSON.stringify({
          error: "CPF/CNPJ obrigatório para assinatura. Preencha em Configurações > Dados do Salão.",
        }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 400 }
      );
    }

    const asaasApiKey = Deno.env.get("ASAAS_API_KEY");
    if (!asaasApiKey) {
      return new Response(JSON.stringify({ error: "ASAAS_API_KEY não configurada" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const baseUrl = req.headers.get("origin")
      || req.headers.get("referer")?.replace(/\/$/, "")
      || Deno.env.get("SITE_URL")
      || "https://vynlobella.com";

    const apiBase = Deno.env.get("ASAAS_API_BASE_URL") || "https://api-sandbox.asaas.com";
    const checkoutRequest = {
      billingTypes: ["CREDIT_CARD", "PIX", "BOLETO"],
      chargeTypes: ["RECURRENT"],
      minutesToExpire: 60,
      callback: {
        cancelUrl: `${baseUrl}/assinatura?subscription=cancelled`,
        expiredUrl: `${baseUrl}/assinatura?subscription=expired`,
        successUrl: `${baseUrl}/dashboard?subscription=success`,
      },
      items: [
        {
          name: `Plano ${plan.name}`,
          description: `Assinatura ${plan.name}`,
          quantity: 1,
          value: Number((plan.amount / 100).toFixed(2)),
        },
      ],
      customerData: {
        name: tenantData?.name || "Cliente",
        email: tenantData?.email || user.email,
        phone: tenantData?.phone || undefined,
        cpfCnpj,
        address: tenantData?.address || undefined,
      },
      subscription: {
        cycle: plan.cycle,
        nextDueDate: toDueDate(0),
        externalReference: tenantId,
      },
    };

    const checkoutResp = await fetch(`${apiBase}/v3/checkouts`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "salon-flow",
        access_token: asaasApiKey,
      },
      body: JSON.stringify(checkoutRequest),
    });

    const checkoutText = await checkoutResp.text();
    if (!checkoutResp.ok) {
      logStep("ERROR: Asaas checkout failed", { status: checkoutResp.status, body: checkoutText.slice(0, 500) });
      return new Response(
        JSON.stringify({ error: `Erro ao criar checkout Asaas (${checkoutResp.status})` }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const checkoutJson = JSON.parse(checkoutText);
    const checkoutId = checkoutJson?.id;
    if (!checkoutId || typeof checkoutId !== "string") {
      logStep("ERROR: Asaas response missing checkout id", { body: checkoutText.slice(0, 500) });
      return new Response(JSON.stringify({ error: "Resposta inesperada do Asaas" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    const checkoutUrl = `https://asaas.com/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
    logStep("Asaas checkout created", { checkoutId, checkoutUrl });

    return new Response(JSON.stringify({ url: checkoutUrl }), {
      headers: { ...cors, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage, stack: error instanceof Error ? error.stack : undefined });
    return new Response(
      JSON.stringify({ error: errorMessage }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});
