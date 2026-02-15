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

function sanitizePhoneNumber(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

function toDueDate(daysFromNow: number): string {
  const d = new Date();
  d.setDate(d.getDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}

function createTimeoutSignal(ms: number): { signal: AbortSignal; cancel: () => void } {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return {
    signal: controller.signal,
    cancel: () => clearTimeout(t),
  };
}

async function asaasFetch(params: {
  url: string;
  method: "GET" | "POST";
  apiKey: string;
  body?: unknown;
  timeoutMs?: number;
}): Promise<{ status: number; text: string }> {
  const startedAt = Date.now();
  const timeout = createTimeoutSignal(params.timeoutMs ?? 15000);
  try {
    const resp = await fetch(params.url, {
      method: params.method,
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "salon-flow",
        access_token: params.apiKey,
      },
      body: params.body ? JSON.stringify(params.body) : undefined,
      signal: timeout.signal,
    });
    const text = await resp.text();
    return { status: resp.status, text };
  } finally {
    timeout.cancel();
    // keep for potential future metrics
    void startedAt;
  }
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

    logStep("Tenant billing loaded", {
      hasTenant: Boolean(tenantData),
      hasBillingCpfCnpj: Boolean(tenantData?.billing_cpf_cnpj),
    });

    const cpfCnpj = sanitizeCpfCnpj(tenantData?.billing_cpf_cnpj ?? "");
    logStep("CPF/CNPJ sanitized", { length: cpfCnpj.length });
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      logStep("ERROR: Missing/invalid CPF/CNPJ", { length: cpfCnpj.length });
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

    const baseUrl = (() => {
      const origin = req.headers.get("origin");
      if (origin) return origin;

      const referer = req.headers.get("referer");
      if (referer) {
        try {
          return new URL(referer).origin;
        } catch {
          // ignore
        }
      }

      return Deno.env.get("SITE_URL") || "https://vynlobella.com";
    })();

    const apiBase = Deno.env.get("ASAAS_API_BASE_URL") || "https://api-sandbox.asaas.com";
    const normalizedApiBase = apiBase.replace(/\/$/, "");
    const checkoutBaseUrl = normalizedApiBase.includes("api-sandbox.asaas.com")
      ? "https://sandbox.asaas.com"
      : "https://www.asaas.com";
    logStep("Asaas request prepared", { apiBase: normalizedApiBase, checkoutBaseUrl });

    // Create a Customer in Asaas with externalReference=tenantId.
    // This guarantees we can map webhook payment.customer -> tenantId even if subscription.externalReference is empty.
    const customerPayload = {
      name: tenantData?.name || "Cliente",
      cpfCnpj,
      email: tenantData?.email || user.email,
      externalReference: tenantId,
    };

    logStep("Creating Asaas customer");
    const customerRes = await asaasFetch({
      url: `${normalizedApiBase}/v3/customers`,
      method: "POST",
      apiKey: asaasApiKey,
      body: customerPayload,
    });

    if (customerRes.status < 200 || customerRes.status >= 300) {
      logStep("ERROR: Asaas customer create failed", { status: customerRes.status, body: customerRes.text.slice(0, 500) });
      return new Response(
        JSON.stringify({ error: `Erro ao criar cliente no Asaas (${customerRes.status})` }),
        { headers: { ...cors, "Content-Type": "application/json" }, status: 500 }
      );
    }

    const customerJson = JSON.parse(customerRes.text);
    const asaasCustomerId = customerJson?.id;
    if (!asaasCustomerId || typeof asaasCustomerId !== "string") {
      logStep("ERROR: Asaas customer response missing id", { body: customerRes.text.slice(0, 500) });
      return new Response(JSON.stringify({ error: "Resposta inesperada ao criar cliente no Asaas" }), {
        headers: { ...cors, "Content-Type": "application/json" },
        status: 500,
      });
    }

    logStep("Asaas customer created", { asaasCustomerId });

    // Important: Asaas may enforce strict validation when customerData is provided.
    // To rely on the hosted checkout to collect payer data, do not send customerData.

    const checkoutRequest = {
      // Asaas limitation: for RECURRENT, only CREDIT_CARD is allowed.
      // PIX/BOLETO require DETACHED charges (not recurring subscription charges).
      billingTypes: ["CREDIT_CARD"],
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
      customer: asaasCustomerId,
      subscription: {
        cycle: plan.cycle,
        nextDueDate: toDueDate(0),
        externalReference: tenantId,
      },
    };

    logStep("Calling Asaas /v3/checkouts");
    const checkoutRes = await asaasFetch({
      url: `${normalizedApiBase}/v3/checkouts`,
      method: "POST",
      apiKey: asaasApiKey,
      body: checkoutRequest,
    });
    logStep("Asaas responded", { status: checkoutRes.status });

    const checkoutText = checkoutRes.text;
    if (checkoutRes.status < 200 || checkoutRes.status >= 300) {
      let detail = checkoutText;
      try {
        const parsed = JSON.parse(checkoutText);
        if (Array.isArray(parsed?.errors) && parsed.errors.length > 0) {
          detail = parsed.errors.map((e: any) => e?.description).filter(Boolean).join(" | ");
        }
      } catch {
        // keep raw text
      }
      logStep("ERROR: Asaas checkout failed", { status: checkoutRes.status, body: checkoutText.slice(0, 500) });
      return new Response(
        JSON.stringify({ error: `Erro ao criar checkout Asaas (${checkoutRes.status}): ${detail}` }),
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

    const checkoutUrl = `${checkoutBaseUrl}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
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
