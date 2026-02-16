import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/node";
import { isCronAuthorized } from "./_shared/cronAuth.js";
import { applySubscriptionUpdate, fetchSubscriptionFromAsaas, mapSubscriptionFromAsaas } from "./_shared/asaasBilling.js";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  if (!isCronAuthorized(req)) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const sentryDsn = process.env.SENTRY_DSN;
  if (sentryDsn) {
    Sentry.init({ dsn: sentryDsn, environment: process.env.VERCEL_ENV, release: process.env.VERCEL_GIT_COMMIT_SHA });
  }

  try {
    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");
    const asaasApiKey = getEnv("ASAAS_API_KEY");
    const asaasApiBase = process.env.ASAAS_API_BASE_URL || "https://api-sandbox.asaas.com";

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const limit = Math.max(1, Math.min(50, Number((req.query as any)?.limit ?? "20")));

    const { data: subs, error } = await supabaseAdmin
      .from("subscriptions")
      .select("tenant_id,asaas_subscription_id")
      .eq("billing_provider", "asaas")
      .not("asaas_subscription_id", "is", null)
      .limit(limit);

    if (error) throw error;

    const rows = (subs ?? []) as Array<{ tenant_id: string; asaas_subscription_id: string }>;
    if (rows.length === 0) {
      res.status(200).json({ ok: true, reconciled: 0 });
      return;
    }

    let reconciled = 0;
    let applied = 0;
    let failed = 0;

    for (const r of rows) {
      const tenantId = String(r.tenant_id);
      const asaasSubscriptionId = String(r.asaas_subscription_id);

      try {
        const sub = await fetchSubscriptionFromAsaas({
          subscriptionId: asaasSubscriptionId,
          apiBase: asaasApiBase,
          apiKey: asaasApiKey,
        });

        const mapped = mapSubscriptionFromAsaas(sub);
        const eventKey = `reconcile:asaas:${asaasSubscriptionId}:${new Date().toISOString().slice(0, 13)}`;

        const resApply = await applySubscriptionUpdate({
          supabaseAdmin,
          tenantId,
          eventKey,
          eventAt: new Date(),
          status: mapped.status,
          plan: mapped.plan,
          currentPeriodEnd: mapped.currentPeriodEnd,
          asaasCustomerId: mapped.asaasCustomerId,
          asaasSubscriptionId,
        });

        reconciled += 1;
        if (resApply?.applied) applied += 1;
      } catch (err) {
        failed += 1;
        if (sentryDsn) {
          Sentry.captureException(err, { extra: { tenant_id: tenantId, asaas_subscription_id: asaasSubscriptionId } });
          await Sentry.flush(2000);
        }
      }
    }

    res.status(200).json({ ok: true, found: rows.length, reconciled, applied, failed });
  } catch (err) {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err);
      await Sentry.flush(2000);
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
