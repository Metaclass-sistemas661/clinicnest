import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import * as Sentry from "@sentry/node";
import { isCronAuthorized } from "./_shared/cronAuth";
import { processAsaasWebhookPayload } from "./_shared/asaasWebhookProcessor";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function computeNextRetryAt(attempts: number): Date {
  const a = Math.max(1, Number(attempts || 1));
  const minutes = a <= 1 ? 1 : a === 2 ? 5 : a === 3 ? 30 : a === 4 ? 120 : 360;
  return new Date(Date.now() + minutes * 60_000);
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
    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const limit = Math.max(1, Math.min(25, Number((req.query as any)?.limit ?? "10")));
    const maxAttempts = Math.max(1, Math.min(20, Number(process.env.ASAAS_WEBHOOK_MAX_ATTEMPTS ?? "8")));

    const nowIso = new Date().toISOString();

    const { data: failed, error } = await supabaseAdmin
      .from("asaas_webhook_events")
      .select("event_key,event_type,payload,attempts,status,next_retry_at")
      .eq("status", "failed")
      .lt("attempts", maxAttempts)
      .or(`next_retry_at.is.null,next_retry_at.lte.${nowIso}`)
      .order("received_at", { ascending: true })
      .limit(limit);

    if (error) throw error;

    const events = (failed ?? []) as Array<any>;
    if (events.length === 0) {
      res.status(200).json({ ok: true, retried: 0 });
      return;
    }

    let retried = 0;
    let processed = 0;
    let skipped = 0;

    for (const e of events) {
      const eventKey = String(e.event_key);
      const eventType = String(e.event_type ?? "unknown");
      const payload = e.payload;
      const attempts = Number(e.attempts ?? 0);

      const nextRetryAt = computeNextRetryAt(attempts + 1);
      await supabaseAdmin
        .from("asaas_webhook_events")
        .update({ last_attempt_at: new Date().toISOString(), next_retry_at: nextRetryAt.toISOString() })
        .eq("event_key", eventKey);

      retried += 1;

      try {
        const { data: claimRows, error: claimError } = await supabaseAdmin.rpc("claim_asaas_webhook_event", {
          p_event_key: eventKey,
          p_event_type: eventType,
          p_payload: payload,
        });
        if (claimError) throw claimError;

        const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
        if (claim?.already_processed || (claim && claim.claimed === false)) {
          skipped += 1;
          continue;
        }

        const asaasApiKey = process.env.ASAAS_API_KEY ?? null;
        const asaasApiBase = process.env.ASAAS_API_BASE_URL || "https://api-sandbox.asaas.com";

        const result = await processAsaasWebhookPayload({
          supabaseAdmin,
          payload,
          eventKey,
          eventType,
          asaasApiKey,
          asaasApiBase,
        });

        if (result.reason === "tenant_id_not_resolved") {
          await supabaseAdmin.from("asaas_webhook_alerts").insert({
            event_id: null,
            event_type: eventType,
            reason: "tenant_id_not_resolved",
            asaas_subscription_id: null,
            asaas_payment_id: null,
            checkout_session_id: null,
            payload,
          });
        }

        await supabaseAdmin
          .from("asaas_webhook_events")
          .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
          .eq("event_key", eventKey);
        processed += 1;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await supabaseAdmin
          .from("asaas_webhook_events")
          .update({ status: "failed", last_error: msg })
          .eq("event_key", eventKey);

        if (sentryDsn) {
          Sentry.captureException(err, { extra: { event_key: eventKey, event_type: eventType } });
          await Sentry.flush(2000);
        }
      }
    }

    res.status(200).json({ ok: true, found: events.length, retried, processed, skipped });
  } catch (err) {
    if (process.env.SENTRY_DSN) {
      Sentry.captureException(err);
      await Sentry.flush(2000);
    }
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
