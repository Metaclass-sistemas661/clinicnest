/**
 * create-checkout — Cloud Run handler */

import { Request, Response } from 'express';
import { adminQuery, userQuery } from '../shared/db';
import { checkRateLimit } from '../shared/rateLimit';
import { createLogger } from '../shared/logging';
import { createDbClient } from '../shared/db-builder';
const db = createDbClient();
const logStep = createLogger("CREATE-CHECKOUT");

async function auditLog(params: {
  tenantId: string;
  actorUserId: string;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  try {
    await db.rpc("log_tenant_action", {
      p_tenant_id: params.tenantId,
      p_actor_user_id: params.actorUserId,
      p_action: params.action,
      p_entity_type: params.entityType,
      p_entity_id: params.entityId ?? null,
      p_metadata: params.metadata ?? {},
    });
  } catch (err: any) {
    logStep("AUDIT: failed", { error: err instanceof Error ? err.message : String(err) });
  }
}

type TierKey = "starter" | "solo" | "clinic" | "premium";
type IntervalKey = "monthly" | "annual";

const tierNames: Record<TierKey, string> = {
  starter: "Starter",
  solo: "Solo",
  clinic: "Clínica",
  premium: "Premium",
};

const intervalNames: Record<IntervalKey, string> = {
  monthly: "Mensal",
  annual: "Anual",
};

const intervalToCycle: Record<IntervalKey, "MONTHLY" | "YEARLY"> = {
  monthly: "MONTHLY",
  annual: "YEARLY",
};

// Pricing matrix (amount in cents)
const PRICING: Record<TierKey, Record<IntervalKey, number>> = {
  starter: {
    monthly: 8990,
    annual: 80900,
  },
  solo: {
    monthly: 15990,
    annual: 143910,
  },
  clinic: {
    monthly: 28990,
    annual: 260910,
  },
  premium: {
    monthly: 39990,
    annual: 359900,
  },
};

/** Legado: mapeia chaves antigas (basic/pro) para novas (starter/solo/clinic) */
function parseLegacyPlanKey(planKey: unknown): { tier: TierKey; interval: IntervalKey } | null {
  if (typeof planKey !== "string") return null;
  const s = planKey.trim();
  if (s === "monthly" || s === "annual") {
    return { tier: "starter", interval: s };
  }
  return null;
}

function parseTierInterval(body: unknown): { tier: TierKey; interval: IntervalKey } | null {
  const b = (body && typeof body === "object" ? (body as Record<string, unknown>) : null) as
    | Record<string, unknown>
    | null;
  const tier = b?.tier;
  const interval = b?.interval;

  // Novos nomes
  if ((tier === "starter" || tier === "solo" || tier === "clinic" || tier === "premium") && (interval === "monthly" || interval === "annual")) {
    return { tier, interval };
  }

  // Legado: basic → starter, pro/clinica → clinic (com mapeamento de interval)
  const mappedTier: TierKey | null =
    tier === "basic" ? "starter" :
    tier === "solo" ? "solo" :
    tier === "pro" || tier === "clinica" ? "clinic" :
    tier === "premium" ? "premium" : null;
  const mappedInterval: IntervalKey | null =
    interval === "monthly" ? "monthly" :
    interval === "quarterly" ? "monthly" :   // trimestral não existe mais → mensal
    interval === "annual" ? "annual" : null;

  if (mappedTier && mappedInterval) {
    return { tier: mappedTier, interval: mappedInterval };
  }

  return null;
}

function sanitizeCpfCnpj(input: string): string {
  return String(input || "").replace(/\D/g, "");
}

function _sanitizePhoneNumber(input: string): string {
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
        "User-Agent": "clinicnest",
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

export async function createCheckout(req: Request, res: Response) {
  try {
    // CORS handled by middleware
    const user = (req as any).user;

    logStep("Function started");

    const body = req.body;

    const parsed = parseTierInterval(body) ?? parseLegacyPlanKey(body?.planKey);
    if (!parsed) {
      return res.status(400).json({ error: "Plano não informado" });
    }

    const { tier, interval } = parsed;
    const amountCents = PRICING[tier][interval];
    const cycle = intervalToCycle[interval];
    const internalPlanKey = `${tier}_${interval}`;
    logStep("User authenticated", { userId: user.id, email: user.email });

    const rl = await checkRateLimit(`checkout:${user.id}`, 5, 60);
    if (!rl.allowed) {
      return res.status(429).json({ error: "Muitas requisições. Tente novamente em alguns minutos." });
    }

    // DB accessed via shared/db module
    const { data: profileData, error: profileError } = await db.from("profiles")
      .select("tenant_id")
      .eq("user_id", user.id)
      .maybeSingle();

    if (profileError) {
      logStep("ERROR", { message: profileError.message });
      return res.status(500).json({ error: "Erro ao buscar tenant" });
    }

    const tenantId = profileData?.tenant_id ?? "";
    logStep("Plan selected", { planKey: internalPlanKey, cycle });

    if (!tenantId) {
      return res.status(403).json({ error: "Tenant não encontrado" });
    }

    await auditLog({ tenantId,
      actorUserId: user.id,
      action: "checkout_attempt",
      entityType: "subscription",
      entityId: tenantId,
      metadata: {
        planKey: internalPlanKey,
        tier,
        interval,
        cycle,
      },
    });

    const { data: tenantData, error: tenantError } = await db.from("tenants")
      .select("name,email,phone,address,billing_cpf_cnpj")
      .eq("id", tenantId)
      .maybeSingle();

    if (tenantError) {
      logStep("ERROR", { message: tenantError.message });
      return res.status(500).json({ error: "Erro ao buscar dados de faturamento" });
    }

    logStep("Tenant billing loaded", {
      hasTenant: Boolean(tenantData),
      hasBillingCpfCnpj: Boolean(tenantData?.billing_cpf_cnpj),
    });

    const cpfCnpj = sanitizeCpfCnpj(tenantData?.billing_cpf_cnpj ?? "");
    logStep("CPF/CNPJ sanitized", { length: cpfCnpj.length });
    if (!cpfCnpj || (cpfCnpj.length !== 11 && cpfCnpj.length !== 14)) {
      logStep("ERROR: Missing/invalid CPF/CNPJ", { length: cpfCnpj.length });

      await auditLog({ tenantId,
        actorUserId: user.id,
        action: "checkout_blocked_missing_billing_cpf_cnpj",
        entityType: "tenant",
        entityId: tenantId,
        metadata: {
          planKey: internalPlanKey,
          cpfCnpjLength: cpfCnpj.length,
        },
      });

      return res.status(400).json({
        error: "CPF/CNPJ obrigatório para assinatura. Preencha em Configurações > Dados da Clínica.",
      });
    }

    const asaasApiKey = process.env.ASAAS_API_KEY;
    if (!asaasApiKey) {
      return res.status(500).json({ error: "ASAAS_API_KEY não configurada" });
    }

    const baseUrl = (() => {
      const origin = (req.headers['origin'] as string);
      if (origin) return origin;

      const referer = (req.headers['referer'] as string);
      if (referer) {
        try {
          return new URL(referer).origin;
        } catch {
          // ignore
        }
      }

      return process.env.SITE_URL || "https://clinicnest.metaclass.com.br";
    })();

    const apiBase = process.env.ASAAS_API_BASE_URL || "https://api.asaas.com";
    const normalizedApiBase = apiBase.replace(/\/$/, "");
    const checkoutBaseUrl = normalizedApiBase.includes("api-sandbox.asaas.com")
      ? "https://sandbox.asaas.com"
      : "https://www.asaas.com";
    logStep("Asaas request prepared", { apiBase: normalizedApiBase, checkoutBaseUrl });

    // Important: do not pass customer/customerData.
    // For recurring checkouts, Asaas may require full address/phone if customer is provided.
    // We'll correlate payments to tenant using payment.checkoutSession + our own mapping table.

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
          name: `Plano ${tierNames[tier]} (${intervalNames[interval]})`,
          description: `Assinatura ${tierNames[tier]} (${intervalNames[interval]})`,
          quantity: 1,
          value: Number((amountCents / 100).toFixed(2)),
        },
      ],
      subscription: {
        cycle,
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
          detail = (parsed.errors as unknown[])
            .map((e: any) => {
              if (!e || typeof e !== "object") return null;
              const d = (e as Record<string, unknown>).description;
              return typeof d === "string" ? d : null;
            })
            .filter((v: any): v is string => Boolean(v))
            .join(" | ");
        }
      } catch {
        // keep raw text
      }
      logStep("ERROR: Asaas checkout failed", { status: checkoutRes.status, body: checkoutText.slice(0, 500) });

      await auditLog({ tenantId,
        actorUserId: user.id,
        action: "checkout_failed_asaas",
        entityType: "subscription",
        entityId: tenantId,
        metadata: {
          planKey: internalPlanKey,
          status: checkoutRes.status,
          detail,
        },
      });

      return res.status(500).json({ error: `Erro ao criar checkout Asaas (${checkoutRes.status}): ${detail}` });
    }

    const checkoutJson = JSON.parse(checkoutText);
    const checkoutId = checkoutJson?.id;
    if (!checkoutId || typeof checkoutId !== "string") {
      logStep("ERROR: Asaas response missing checkout id", { body: checkoutText.slice(0, 500) });
      return res.status(500).json({ error: "Resposta inesperada do Asaas" });
    }

    const { error: mapError } = await db.from("asaas_checkout_sessions")
      .upsert({ checkout_session_id: checkoutId, tenant_id: tenantId }, { onConflict: "checkout_session_id" });

    if (mapError) {
      logStep("ERROR: Failed to persist checkout mapping", { message: mapError.message });
      return res.status(500).json({ error: "Erro ao preparar checkout" });
    }

    const checkoutUrl = `${checkoutBaseUrl}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
    logStep("Asaas checkout created", { checkoutId, checkoutUrl });

    await auditLog({ tenantId,
      actorUserId: user.id,
      action: "checkout_created",
      entityType: "asaas_checkout",
      entityId: checkoutId,
      metadata: {
        planKey: internalPlanKey,
      },
    });

    return res.status(200).json({ url: checkoutUrl });
  } catch (err: any) {
    console.error(`[create-checkout] Error:`, err.message || err);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
