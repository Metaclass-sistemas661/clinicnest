import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";

const log = createLogger("RUN-CAMPAIGN");

type Body = {
  campaignId: string;
  limit?: number;
};

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

async function sendEmailViaResend(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; id?: string; error?: string }> {
  const resendApiKey = Deno.env.get("RESEND_API_KEY");
  if (!resendApiKey) {
    return { ok: false, error: "RESEND_API_KEY não configurada" };
  }

  const emailFrom = Deno.env.get("EMAIL_FROM") || "BeautyGest <no-reply@metaclass.com.br>";

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: emailFrom,
        to,
        subject,
        html,
        text,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return { ok: false, error: `Resend error: ${response.status} ${errText}` };
    }

    const result = await response.json();
    return { ok: true, id: result.id };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

serve(async (req) => {
  const cors = getCorsHeaders(req);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: cors });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido" }), {
      status: 405,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
  const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  if (!supabaseUrl || !supabaseServiceRoleKey) {
    return new Response(JSON.stringify({ error: "Configuração do servidor incompleta" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const auth = await getAuthenticatedUserWithTenant(req, cors);
  if (auth.error) return auth.error;

  // Admin-only
  const isAdmin = (await (async () => {
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, { auth: { persistSession: false } });
    const { data: role } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("tenant_id", auth.tenantId)
      .eq("user_id", auth.user.id)
      .maybeSingle();
    return role?.role === "admin";
  })());

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Apenas admin" }), {
      status: 403,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: { persistSession: false },
  });

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return new Response(JSON.stringify({ error: "Corpo inválido" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const campaignId = typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
  const limit = Math.max(1, Math.min(Number(body?.limit ?? 200), 1000));
  if (!campaignId) {
    return new Response(JSON.stringify({ error: "campaignId é obrigatório" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const rl = await checkRateLimit(`run-campaign:${auth.tenantId}:${auth.user.id}`, 5, 60);
  if (!rl.allowed) {
    return new Response(JSON.stringify({ error: "Muitas tentativas. Tente novamente em instantes." }), {
      status: 429,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .select("id, tenant_id, name, subject, html, status")
    .eq("tenant_id", auth.tenantId)
    .eq("id", campaignId)
    .maybeSingle();

  if (campaignError || !campaign) {
    return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (campaign.status !== "draft") {
    return new Response(JSON.stringify({ error: "Campanha não está em draft" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from("clients")
    .select("id, email")
    .eq("tenant_id", auth.tenantId)
    .not("email", "is", null)
    .limit(limit);

  if (recipientsError) {
    return new Response(JSON.stringify({ error: "Erro ao listar destinatários" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const clientIds = (recipients || []).map((r: any) => String(r.id));

  const { data: prefs } = await supabaseAdmin
    .from("client_marketing_preferences")
    .select("client_id, marketing_opt_out")
    .eq("tenant_id", auth.tenantId)
    .in("client_id", clientIds);

  const optedOut = new Set((prefs || []).filter((p: any) => p.marketing_opt_out === true).map((p: any) => String(p.client_id)));

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const r of recipients || []) {
    const clientId = String((r as any).id);
    const toEmail = String((r as any).email || "").trim();

    if (!toEmail) {
      skipped++;
      continue;
    }

    if (optedOut.has(clientId)) {
      skipped++;
      continue;
    }

    const safeSubject = String(campaign.subject || "");
    const html = String(campaign.html || "");
    const text = `Campanha: ${campaign.name}\n\n${safeSubject}`;

    const delivery = await supabaseAdmin
      .from("campaign_deliveries")
      .insert({
        tenant_id: auth.tenantId,
        campaign_id: campaign.id,
        client_id: clientId,
        to_email: toEmail,
        status: "sending",
      })
      .select("id")
      .maybeSingle();

    const deliveryId = String((delivery.data as any)?.id || "");

    const res = await sendEmailViaResend(toEmail, safeSubject, html, text);

    if (res.ok) {
      sent++;
      await supabaseAdmin
        .from("campaign_deliveries")
        .update({ status: "sent", provider_message_id: res.id || null, sent_at: new Date().toISOString() })
        .eq("id", deliveryId);
    } else {
      failed++;
      await supabaseAdmin
        .from("campaign_deliveries")
        .update({ status: "failed", error: res.error || "Erro" })
        .eq("id", deliveryId);
      log("EMAIL failed", { toEmail, error: res.error });
    }
  }

  await supabaseAdmin
    .from("campaigns")
    .update({ status: "sent", sent_at: new Date().toISOString() })
    .eq("tenant_id", auth.tenantId)
    .eq("id", campaign.id);

  return new Response(
    JSON.stringify({ success: true, sent, skipped, failed }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
