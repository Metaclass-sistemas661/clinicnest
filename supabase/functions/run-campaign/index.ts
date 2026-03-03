import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createLogger } from "../_shared/logging.ts";
import { checkRateLimit } from "../_shared/rateLimit.ts";
import { getAuthenticatedUserWithTenant } from "../_shared/auth.ts";
import {
  sendClinicEmail,
  buildClinicEmailHtml,
  type ClinicInfo,
} from "../_shared/clinicEmail.ts";

const log = createLogger("RUN-CAMPAIGN");

type Body = {
  campaignId: string;
  limit?: number;
  afterClientId?: string;
  testEmail?: string;
  clientIds?: string[]; // optional: restrict to these client IDs
};

type CampaignRow = {
  id: string;
  tenant_id: string;
  name: string | null;
  subject: string | null;
  html: string | null;
  status: string;
  banner_url: string | null;
  preheader: string | null;
};

type RecipientRow = { id: string; email: string | null };

type MarketingPrefRow = { client_id: string; marketing_opt_out: boolean | null };

type SelectResult<T> = { data: T; error: unknown };

function escapeHtml(raw: string): string {
  return raw
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeEmail(input: unknown): string {
  if (typeof input !== "string") return "";
  return input.trim().toLowerCase();
}

function clampInt(n: unknown, min: number, max: number, fallback: number): number {
  const v = Number(n);
  if (!Number.isFinite(v)) return fallback;
  return Math.max(min, Math.min(Math.floor(v), max));
}

function renderHtmlWithHeader(params: {
  name: string;
  subject: string;
  bannerUrl?: string | null;
  preheader?: string | null;
  html: string;
}): string {
  const preheader = (params.preheader ?? "").trim();
  const bannerUrl = (params.bannerUrl ?? "").trim();
  const preheaderHtml = preheader
    ? `<div style="display:none!important;visibility:hidden;opacity:0;color:transparent;height:0;width:0;overflow:hidden;mso-hide:all;">${escapeHtml(preheader)}</div>`
    : "";
  const bannerHtml = bannerUrl
    ? `<div style="margin:0 0 16px 0;"><img src="${escapeHtml(bannerUrl)}" alt="${escapeHtml(params.name)}" style="width:100%;max-width:640px;height:auto;border-radius:14px;display:block;" /></div>`
    : "";

  // Se o admin já colou um HTML completo, não embrulhar em outro html/body.
  const raw = String(params.html || "").trim();
  const looksLikeFullDoc = /<html[\s>]/i.test(raw) || /<body[\s>]/i.test(raw);
  if (looksLikeFullDoc) return raw;

  return `${preheaderHtml}${bannerHtml}${raw}`;
}

async function sendCampaignEmail(
  to: string,
  subject: string,
  bodyHtml: string,
  text: string,
  clinic: ClinicInfo,
): Promise<{ ok: boolean; id?: string; error?: string }> {
  return sendClinicEmail({
    to,
    subject,
    clinic,
    headline: subject,
    icon: "📢",
    bodyHtml,
    bodyText: text,
  });
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
  const limit = clampInt(body?.limit, 1, 1000, 200);
  const afterClientId = typeof body?.afterClientId === "string" ? body.afterClientId.trim() : "";
  const testEmail = normalizeEmail(body?.testEmail);
  // Optional: send only to specific client IDs (recipient selection feature)
  const selectedClientIds: string[] | null =
    Array.isArray(body?.clientIds) && (body.clientIds as unknown[]).length > 0
      ? (body.clientIds as unknown[]).map((id) => String(id)).filter(Boolean)
      : null;
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

  const { data: campaign, error: campaignError } = (await supabaseAdmin
    .from("campaigns")
    .select("id, tenant_id, name, subject, html, status, banner_url, preheader")
    .eq("tenant_id", auth.tenantId)
    .eq("id", campaignId)
    .maybeSingle()) as unknown as SelectResult<CampaignRow | null>;

  if (campaignError || !campaign) {
    return new Response(JSON.stringify({ error: "Campanha não encontrada" }), {
      status: 404,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (campaign.status !== "draft" && campaign.status !== "sending") {
    return new Response(JSON.stringify({ error: "Campanha não está pronta para envio" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // Fetch tenant info for clinic branding + Reply-To
  const { data: tenantData } = await supabaseAdmin
    .from("tenants")
    .select("name, email, phone")
    .eq("id", auth.tenantId)
    .single();

  const clinic: ClinicInfo = {
    name: tenantData?.name || "Clínica",
    email: tenantData?.email || null,
    phone: tenantData?.phone || null,
  };

  const safeSubject = String(campaign.subject || "");
  const html = renderHtmlWithHeader({
    name: String(campaign.name || ""),
    subject: safeSubject,
    bannerUrl: campaign.banner_url ?? null,
    preheader: campaign.preheader ?? null,
    html: String(campaign.html || ""),
  });

  // Test send: does not create deliveries, does not change campaign status.
  if (testEmail) {
    const text = `Campanha (teste): ${campaign.name}\n\n${safeSubject}`;
    const res = await sendCampaignEmail(testEmail, safeSubject, html, text, clinic);
    if (!res.ok) {
      return new Response(JSON.stringify({ error: res.error || "Falha ao enviar teste" }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    return new Response(
      JSON.stringify({ success: true, mode: "test", to: testEmail, provider_message_id: res.id || null }),
      { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
    );
  }

  // Mark campaign as sending to allow batch runs.
  if (campaign.status === "draft") {
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "sending" })
      .eq("tenant_id", auth.tenantId)
      .eq("id", campaign.id);
  }

  let recipientsQuery = supabaseAdmin
    .from("clients")
    .select("id, email")
    .eq("tenant_id", auth.tenantId)
    .not("email", "is", null)
    .order("id", { ascending: true });

  if (selectedClientIds) {
    // Recipient-selection mode: ignore pagination, send only to chosen clients
    recipientsQuery = recipientsQuery.in("id", selectedClientIds);
  } else {
    // Batch mode: support cursor-based pagination
    if (afterClientId) {
      recipientsQuery = recipientsQuery.gt("id", afterClientId);
    }
  }

  const { data: recipients, error: recipientsError } = (await (
    selectedClientIds ? recipientsQuery : recipientsQuery.limit(limit)
  )) as unknown as SelectResult<RecipientRow[] | null>;

  if (recipientsError) {
    return new Response(JSON.stringify({ error: "Erro ao listar destinatários" }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  const clientIds = (recipients || []).map((r) => String(r.id));

  const { data: prefs } = (await supabaseAdmin
    .from("client_marketing_preferences")
    .select("client_id, marketing_opt_out")
    .eq("tenant_id", auth.tenantId)
    .in("client_id", clientIds)) as unknown as SelectResult<MarketingPrefRow[] | null>;

  const optedOut = new Set(
    (prefs || [])
      .filter((p) => p.marketing_opt_out === true)
      .map((p) => String(p.client_id))
  );

  let sent = 0;
  let skipped = 0;
  let failed = 0;
  let opted_out = 0;
  let already_sent = 0;
  let last_client_id: string | null = null;

  for (const r of recipients || []) {
    const clientId = String(r.id);
    const toEmail = String(r.email || "").trim();
    last_client_id = clientId;

    if (!toEmail) {
      skipped++;
      continue;
    }

    if (optedOut.has(clientId)) {
      opted_out++;
      continue;
    }

    // Idempotência: se já tiver delivery sent, não reenviar.
    const { data: existing } = await supabaseAdmin
      .from("campaign_deliveries")
      .select("id,status")
      .eq("tenant_id", auth.tenantId)
      .eq("campaign_id", campaign.id)
      .eq("client_id", clientId)
      .maybeSingle();

    if (existing?.status === "sent" || existing?.status === "delivered") {
      already_sent++;
      continue;
    }

    // Upsert delivery row (unique by campaign_id + client_id)
    const upsertRes = await supabaseAdmin
      .from("campaign_deliveries")
      .upsert(
        {
          tenant_id: auth.tenantId,
          campaign_id: campaign.id,
          client_id: clientId,
          to_email: toEmail,
          status: "sending",
          error: null,
        },
        { onConflict: "campaign_id,client_id" }
      )
      .select("id")
      .maybeSingle();

    const deliveryId = String((upsertRes.data as { id?: unknown } | null)?.id || "");

    const text = `Campanha: ${campaign.name}\n\n${safeSubject}`;
    const res = await sendCampaignEmail(toEmail, safeSubject, html, text, clinic);

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

  // In recipient-selection mode there is no pagination — always finished.
  // In batch mode, hasMore is true when the returned count equals the limit.
  const hasMore = selectedClientIds ? false : (recipients || []).length === limit;
  if (!hasMore) {
    await supabaseAdmin
      .from("campaigns")
      .update({ status: "sent", sent_at: new Date().toISOString() })
      .eq("tenant_id", auth.tenantId)
      .eq("id", campaign.id);
  }

  return new Response(
    JSON.stringify({
      success: true,
      mode: "batch",
      sent,
      skipped,
      failed,
      opted_out,
      already_sent,
      last_client_id,
      has_more: hasMore,
      next_after_client_id: hasMore ? last_client_id : null,
      campaign_status: hasMore ? "sending" : "sent",
    }),
    { status: 200, headers: { ...cors, "Content-Type": "application/json" } }
  );
});
