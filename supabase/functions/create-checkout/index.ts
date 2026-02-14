import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getAuthenticatedUser } from "../_shared/auth.ts";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";

const logStep = createLogger("CREATE-CHECKOUT");

// VynloBella pricing plans
const PLANS = {
  monthly: {
    priceId: "price_1SwMlSQ6oE5cHTfzFOnfAuVi",
    productId: "prod_TuB7bc1lxNBAoz",
    name: "Mensal",
    amount: 7990,
  },
  quarterly: {
    priceId: "price_1SwMluQ6oE5cHTfzOY5oVLFN",
    productId: "prod_TuB8arh8d4qyt2",
    name: "Trimestral",
    amount: 20970,
  },
  annual: {
    priceId: "price_1SwMmXQ6oE5cHTfzrZy5P01K",
    productId: "prod_TuB88hjDHGS60T",
    name: "Anual",
    amount: 59880,
  },
};

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
    logStep("Plan selected", { planKey, priceId: plan.priceId });

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

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey || !stripeKey.startsWith("sk_")) {
      return new Response(
        JSON.stringify({ error: "STRIPE_SECRET_KEY não configurada ou inválida" }),
        { status: 500, headers: { ...cors, "Content-Type": "application/json" } }
      );
    }

    const stripe = new Stripe(stripeKey);

    // Check for existing customer
    const customers = await stripe.customers.list({ email: user.email, limit: 1 });
    let customerId;
    if (customers.data.length > 0) {
      customerId = customers.data[0].id;
      logStep("Found existing customer", { customerId });
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

    const baseUrl = req.headers.get("origin") || req.headers.get("referer")?.replace(/\/$/, "") || "https://vynlobella.com";
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      customer_email: customerId ? undefined : user.email,
      line_items: [
        {
          price: plan.priceId,
          quantity: 1,
        },
      ],
      mode: "subscription",
      success_url: `${baseUrl}/dashboard?subscription=success`,
      cancel_url: `${baseUrl}/assinatura?subscription=cancelled`,
      metadata: {
        user_id: user.id,
        tenant_id: tenantId || "",
        plan_key: planKey,
      },
    });

    logStep("Checkout session created", { sessionId: session.id, url: session.url });

    return new Response(JSON.stringify({ url: session.url }), {
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
