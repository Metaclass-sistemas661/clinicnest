import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@18.5.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getWelcomeEmailHtml, getWelcomeEmailText, sendEmailViaResend } from "./email-templates.ts";

const logStep = (step: string, details?: unknown) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[STRIPE-WEBHOOK] ${step}${detailsStr}`);
};

// Mapeamento de price IDs para plan keys
const PRICE_TO_PLAN: Record<string, string> = {
  "price_1SwMlSQ6oE5cHTfzFOnfAuVi": "monthly",
  "price_1SwMluQ6oE5cHTfzOY5oVLFN": "quarterly",
  "price_1SwMmXQ6oE5cHTfzrZy5P01K": "annual",
};

serve(async (req) => {
  try {
    logStep("Webhook recebido");

    const signature = req.headers.get("stripe-signature");
    if (!signature) {
      logStep("ERROR: Sem assinatura do Stripe");
      return new Response(JSON.stringify({ error: "No signature" }), { status: 400 });
    }

    const stripeSecretKey = Deno.env.get("STRIPE_SECRET_KEY");
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!stripeSecretKey || !webhookSecret || !supabaseUrl || !supabaseServiceRoleKey) {
      logStep("ERROR: Variáveis de ambiente faltando");
      return new Response(JSON.stringify({ error: "Missing env vars" }), { status: 500 });
    }

    const stripe = new Stripe(stripeSecretKey, { apiVersion: "2025-08-27.basil" });
    const body = await req.text();

    // Validar assinatura do webhook (constructEventAsync para Deno/Edge)
    let event: Stripe.Event;
    try {
      event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret, 300);
      logStep("Assinatura validada", { type: event.type });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      logStep("ERROR: Assinatura inválida", { error: errMsg, bodyLength: body?.length ?? 0 });
      return new Response(JSON.stringify({ error: "Invalid signature", details: errMsg }), { status: 400 });
    }

    // Cliente Supabase com service_role (admin)
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Processar eventos
    switch (event.type) {
      case "checkout.session.completed": {
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session, stripe, supabaseAdmin);
        break;
      }

      case "customer.subscription.updated": {
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription, supabaseAdmin);
        break;
      }

      case "customer.subscription.deleted": {
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription, supabaseAdmin);
        break;
      }

      default:
        logStep("Evento não tratado", { type: event.type });
    }

    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR", { message: errorMessage });
    return new Response(JSON.stringify({ error: errorMessage }), { status: 500 });
  }
});

// ========== HANDLERS DE EVENTOS ==========

async function handleCheckoutCompleted(
  session: Stripe.Checkout.Session,
  stripe: Stripe,
  supabaseAdmin: any
) {
  logStep("checkout.session.completed", { sessionId: session.id });

  const email = session.customer_email || session.customer_details?.email;
  if (!email) {
    logStep("ERROR: Sem e-mail no checkout");
    return;
  }

  logStep("E-mail extraído", { email });

  // Buscar customer no Stripe para pegar nome
  let customerName = "Cliente";
  if (session.customer) {
    try {
      const customer = await stripe.customers.retrieve(session.customer as string);
      if (customer && !customer.deleted) {
        customerName = customer.name || customer.email?.split("@")[0] || "Cliente";
      }
    } catch (err) {
      logStep("WARN: Erro ao buscar customer", { error: (err as Error).message });
    }
  }

  // Verificar se usuário já existe
  const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
  const userExists = existingUser?.users?.find((u: any) => u.email === email);

  let userId: string;
  let tenantId: string;

  if (userExists) {
    logStep("Usuário já existe", { userId: userExists.id, email });
    userId = userExists.id;

    // Buscar tenant_id do profile existente
    const { data: profile } = await supabaseAdmin
      .from("profiles")
      .select("tenant_id")
      .eq("user_id", userId)
      .single();

    if (!profile?.tenant_id) {
      logStep("ERROR: Perfil sem tenant_id", { userId });
      return;
    }
    tenantId = profile.tenant_id;
  } else {
    logStep("Criando novo usuário", { email });

    // 1. Criar usuário no Supabase Auth
    // source: 'stripe' evita que o trigger handle_new_user() duplique tenant/profile/role
    const { data: userData, error: userError } = await supabaseAdmin.auth.admin.createUser({
      email: email,
      email_confirm: true, // Confirma e-mail automaticamente
      user_metadata: {
        full_name: customerName,
        salon_name: `Salão ${customerName}`,
        source: "stripe",
      },
    });

    if (userError || !userData.user) {
      logStep("ERROR: Falha ao criar usuário", { error: userError?.message });
      return;
    }
    userId = userData.user.id;
    logStep("Usuário criado", { userId });

    // 2. Criar tenant (salão)
    const { data: tenantData, error: tenantError } = await supabaseAdmin
      .from("tenants")
      .insert({
        name: `Salão ${customerName}`,
        email: email,
      })
      .select("id")
      .single();

    if (tenantError || !tenantData) {
      logStep("ERROR: Falha ao criar tenant", { error: tenantError?.message });
      return;
    }
    tenantId = tenantData.id;
    logStep("Tenant criado", { tenantId });

    // 3. Criar profile
    const { error: profileError } = await supabaseAdmin.from("profiles").insert({
      user_id: userId,
      tenant_id: tenantId,
      full_name: customerName,
      email: email,
    });

    if (profileError) {
      logStep("ERROR: Falha ao criar profile", { error: profileError.message });
      return;
    }
    logStep("Profile criado");

    // 4. Criar user_role (admin)
    const { error: roleError } = await supabaseAdmin.from("user_roles").insert({
      user_id: userId,
      tenant_id: tenantId,
      role: "admin",
    });

    if (roleError) {
      logStep("ERROR: Falha ao criar role", { error: roleError.message });
      return;
    }
    logStep("Role criado (admin)");
  }

  // 5. Criar ou atualizar subscription
  const stripeCustomerId = session.customer as string;
  const stripeSubscriptionId = session.subscription as string;

  // Buscar detalhes da subscription no Stripe
  let planKey = "monthly";
  let currentPeriodEnd: Date = new Date();
  // Fallback: 1 mês a partir de agora (para pagamentos one-time ou quando period_end não existe)
  const oneMonthFromNow = new Date();
  oneMonthFromNow.setMonth(oneMonthFromNow.getMonth() + 1);

  if (stripeSubscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve(stripeSubscriptionId);
      const priceId = subscription.items.data[0]?.price.id;
      planKey = PRICE_TO_PLAN[priceId] || "monthly";
      const periodEnd = subscription.current_period_end;
      if (periodEnd && typeof periodEnd === "number") {
        currentPeriodEnd = new Date(periodEnd * 1000);
      } else {
        currentPeriodEnd = oneMonthFromNow;
      }
      logStep("Detalhes da subscription", { planKey, currentPeriodEnd: currentPeriodEnd.toISOString() });
    } catch (err) {
      logStep("WARN: Erro ao buscar subscription", { error: (err as Error).message });
      currentPeriodEnd = oneMonthFromNow;
    }
  } else {
    // Pagamento one-time (Payment Link sem subscription)
    currentPeriodEnd = oneMonthFromNow;
  }

  // Verificar se já existe subscription para esse tenant
  const { data: existingSubscription } = await supabaseAdmin
    .from("subscriptions")
    .select("id")
    .eq("tenant_id", tenantId)
    .single();

  if (existingSubscription) {
    // Atualizar
    const { error: updateError } = await supabaseAdmin
      .from("subscriptions")
      .update({
        status: "active",
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        current_period_end: currentPeriodEnd.toISOString(),
        plan: planKey,
      })
      .eq("id", existingSubscription.id);

    if (updateError) {
      logStep("ERROR: Falha ao atualizar subscription", { error: updateError.message });
    } else {
      logStep("Subscription atualizada");
    }
  } else {
    // Criar
    const { error: subError } = await supabaseAdmin.from("subscriptions").insert({
      tenant_id: tenantId,
      status: "active",
      stripe_customer_id: stripeCustomerId,
      stripe_subscription_id: stripeSubscriptionId,
      current_period_end: currentPeriodEnd.toISOString(),
      plan: planKey,
    });

    if (subError) {
      logStep("ERROR: Falha ao criar subscription", { error: subError.message });
    } else {
      logStep("Subscription criada");
    }
  }

  // 6. Enviar e-mail com magic link (se for usuário novo)
  if (!userExists) {
    await sendWelcomeEmail(email, customerName, supabaseAdmin);
  }
}

async function handleSubscriptionUpdated(subscription: Stripe.Subscription, supabaseAdmin: any) {
  logStep("customer.subscription.updated", { subscriptionId: subscription.id });

  const stripeCustomerId = subscription.customer as string;
  const status = subscription.status === "active" ? "active" : subscription.status === "trialing" ? "trialing" : "inactive";
  const currentPeriodEnd = new Date(subscription.current_period_end * 1000);
  const priceId = subscription.items.data[0]?.price.id;
  const planKey = PRICE_TO_PLAN[priceId] || "monthly";

  // Atualizar subscription no banco
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({
      status: status,
      current_period_end: currentPeriodEnd.toISOString(),
      plan: planKey,
    })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    logStep("ERROR: Falha ao atualizar subscription", { error: error.message });
  } else {
    logStep("Subscription atualizada", { status, planKey });
  }
}

async function handleSubscriptionDeleted(subscription: Stripe.Subscription, supabaseAdmin: any) {
  logStep("customer.subscription.deleted", { subscriptionId: subscription.id });

  // Marcar como inativa
  const { error } = await supabaseAdmin
    .from("subscriptions")
    .update({ status: "inactive" })
    .eq("stripe_subscription_id", subscription.id);

  if (error) {
    logStep("ERROR: Falha ao deletar subscription", { error: error.message });
  } else {
    logStep("Subscription marcada como inativa");
  }
}

async function sendWelcomeEmail(email: string, name: string, supabaseAdmin: any) {
  logStep("Gerando magic link", { email });

  try {
    // Gerar magic link para acesso direto
    const { data: magicLinkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "magiclink",
      email: email,
      options: {
        redirectTo: `${Deno.env.get("SITE_URL") || "https://vynlobella.vercel.app"}/dashboard`,
      },
    });

    if (linkError || !magicLinkData) {
      logStep("ERROR: Falha ao gerar magic link", { error: linkError?.message });
      return;
    }

    const magicLink = magicLinkData.properties.action_link;
    logStep("Magic link gerado", { link: magicLink.substring(0, 50) + "..." });

    // Preparar e-mail
    const subject = "Bem-vindo ao VynloBella! 🎉";
    const html = getWelcomeEmailHtml(name, magicLink);
    const text = getWelcomeEmailText(name, magicLink);

    // Enviar via Resend (se configurado)
    const sent = await sendEmailViaResend(email, subject, html, text);

    if (sent) {
      logStep("E-mail enviado com sucesso", { to: email });
    } else {
      logStep("E-mail não enviado (Resend não configurado ou erro)", { to: email });
      logStep("Magic link para teste", { magicLink });
    }

  } catch (error) {
    logStep("ERROR: Falha ao enviar e-mail", { error: (error as Error).message });
  }
}
