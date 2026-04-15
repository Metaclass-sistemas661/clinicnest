/**
 * run-campaign — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { sendEmail } from '../shared/email';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
interface ClinicInfo {
  name: string;
  email: string | null;
  phone: string | null;
}

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
  clinic: ClinicInfo): Promise<{ ok: boolean; id?: string; error?: string }> {
  return sendEmail(to, subject, bodyHtml, text) as Promise<{ ok: boolean; id?: string; error?: string }>;
}

export async function runCampaign(req: Request, res: Response) {
  try {
    const db = createDbClient();
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Método não permitido" });
    }


    const user = (req as any).user;
    if (!user?.id) {
      return res.status(401).json({ error: "Não autenticado" });
    }
    const { data: userProfile } = await db.from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .single();

    if (!userProfile?.tenant_id) {
      return res.status(403).json({ error: "Tenant não encontrado" });
    }

    const tenantId = userProfile.tenant_id;

    const { data: roleData } = await db.from("user_roles")
      .select("role")
      .eq("tenant_id", tenantId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (roleData?.role !== "admin") {
      return res.status(403).json({ error: "Apenas admin" });
    }

      let body: Body;
      try {
        body = (req.body) as Body;
      } catch {
        return res.status(400).json({ error: "Corpo inválido" });
      }

      const campaignId = typeof body?.campaignId === "string" ? body.campaignId.trim() : "";
      const limit = clampInt(body?.limit, 1, 1000, 200);
      const afterClientId = typeof body?.afterClientId === "string" ? body.afterClientId.trim() : "";
      const testEmail = normalizeEmail(body?.testEmail);
      // Optional: send only to specific client IDs (recipient selection feature)
      const selectedClientIds: string[] | null =
        Array.isArray(body?.clientIds) && (body.clientIds as unknown[]).length > 0
          ? (body.clientIds as unknown[]).map((id: any) => String(id)).filter(Boolean)
          : null;
      if (!campaignId) {
        return res.status(400).json({ error: "campaignId é obrigatório" });
      }

      const rl = await checkRateLimit(`run-campaign:${tenantId}:${user.id}`, 5, 60);
      if (!rl.allowed) {
        return res.status(429).json({ error: "Muitas tentativas. Tente novamente em instantes." });
      }

      const { data: campaign, error: campaignError } = (await db.from("campaigns")
        .select("id, tenant_id, name, subject, html, status, banner_url, preheader")
        .eq("tenant_id", tenantId)
        .eq("id", campaignId)
        .maybeSingle()) as unknown as SelectResult<CampaignRow | null>;

      if (campaignError || !campaign) {
        return res.status(404).json({ error: "Campanha não encontrada" });
      }

      if (campaign.status !== "draft" && campaign.status !== "sending") {
        return res.status(400).json({ error: "Campanha não está pronta para envio" });
      }

      // Fetch tenant info for clinic branding + Reply-To
      const { data: tenantData } = await db.from("tenants")
        .select("name, email, phone")
        .eq("id", tenantId)
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
        const sendRes = await sendCampaignEmail(testEmail, safeSubject, html, text, clinic);
        if (!sendRes.ok) {
          return res.status(500).json({ error: sendRes.error || "Falha ao enviar teste" });
        }
        return res.status(200).json({ success: true, mode: "test", to: testEmail, provider_message_id: sendRes.id || null });
      }

      // Mark campaign as sending to allow batch runs.
      if (campaign.status === "draft") {
        await db.from("campaigns")
          .update({ status: "sending" })
          .eq("tenant_id", tenantId)
          .eq("id", campaign.id);
      }

      let recipientsQuery = db.from("clients")
        .select("id, email")
        .eq("tenant_id", tenantId)
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
        return res.status(500).json({ error: "Erro ao listar destinatários" });
      }

      const clientIds = (recipients || []).map((r: any) => String(r.id));

      const { data: prefs } = (await db.from("client_marketing_preferences")
        .select("client_id, marketing_opt_out")
        .eq("tenant_id", tenantId)
        .in("client_id", clientIds)) as unknown as SelectResult<MarketingPrefRow[] | null>;

      const optedOut = new Set(
        (prefs || [])
          .filter((p: any) => p.marketing_opt_out === true)
          .map((p: any) => String(p.client_id))
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
        const { data: existing } = await db.from("campaign_deliveries")
          .select("id,status")
          .eq("tenant_id", tenantId)
          .eq("campaign_id", campaign.id)
          .eq("client_id", clientId)
          .maybeSingle();

        if (existing?.status === "sent" || existing?.status === "delivered") {
          already_sent++;
          continue;
        }

        // Upsert delivery row (unique by campaign_id + client_id)
        const upsertRes = await db.from("campaign_deliveries")
          .upsert(
            {
              tenant_id: tenantId,
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
        const sendRes = await sendCampaignEmail(toEmail, safeSubject, html, text, clinic);

        if (sendRes.ok) {
          sent++;
          await db.from("campaign_deliveries")
            .update({ status: "sent", provider_message_id: sendRes.id || null, sent_at: new Date().toISOString() })
            .eq("id", deliveryId);
        } else {
          failed++;
          await db.from("campaign_deliveries")
            .update({ status: "failed", error: sendRes.error || "Erro" })
            .eq("id", deliveryId);
          log("EMAIL failed", { toEmail, error: sendRes.error });
        }
      }

      // In recipient-selection mode there is no pagination — always finished.
      // In batch mode, hasMore is true when the returned count equals the limit.
      const hasMore = selectedClientIds ? false : (recipients || []).length === limit;
      if (!hasMore) {
        await db.from("campaigns")
          .update({ status: "sent", sent_at: new Date().toISOString() })
          .eq("tenant_id", tenantId)
          .eq("id", campaign.id);
      }

      return res.status(200).json({
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
        });
  } catch (err: any) {
    console.error(`[run-campaign] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
