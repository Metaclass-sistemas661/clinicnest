import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

function getEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

function getHeader(req: VercelRequest, name: string): string | null {
  const v = req.headers[name.toLowerCase()];
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function getEventKey(payload: unknown): { eventKey: string; eventType: string } {
  const p = payload as any;
  const eventType = typeof p?.event === "string" ? p.event : "unknown";
  const paymentId = typeof p?.payment?.id === "string" ? p.payment.id : null;
  const subscriptionId = typeof p?.subscription?.id === "string" ? p.subscription.id : null;

  if (paymentId) {
    return { eventKey: `${eventType}:payment:${paymentId}`, eventType };
  }

  if (subscriptionId) {
    return { eventKey: `${eventType}:subscription:${subscriptionId}`, eventType };
  }

  const raw = JSON.stringify(payload ?? {});
  const hash = crypto.createHash("sha256").update(raw).digest("hex");
  return { eventKey: `${eventType}:sha256:${hash}`, eventType };
}

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const expectedToken = process.env.ASAAS_WEBHOOK_TOKEN;
  if (expectedToken) {
    const received = getHeader(req, "asaas-access-token");
    if (!received) {
      res.status(401).json({ error: "Unauthorized", detail: "Missing asaas-access-token" });
      return;
    }

    if (received !== expectedToken) {
      res.status(401).json({ error: "Unauthorized", detail: "Invalid asaas-access-token" });
      return;
    }
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
    const { eventKey, eventType } = getEventKey(payload);

    const supabaseUrl = getEnv("SUPABASE_URL");
    const serviceRole = getEnv("SUPABASE_SERVICE_ROLE_KEY");

    const supabaseAdmin = createClient(supabaseUrl, serviceRole, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("asaas_webhook_events")
      .select("status, attempts")
      .eq("event_key", eventKey)
      .maybeSingle();

    if (existingError) throw existingError;

    if (existing?.status === "processed") {
      res.status(200).json({ received: true, duplicate: true });
      return;
    }

    if (!existing) {
      const { error: insertError } = await supabaseAdmin.from("asaas_webhook_events").insert({
        event_key: eventKey,
        event_type: eventType,
        received_at: new Date().toISOString(),
        status: "processing",
        attempts: 1,
        payload,
      });

      if (insertError) {
        const msg = insertError.message ?? String(insertError);
        if (!msg.toLowerCase().includes("duplicate") && !msg.toLowerCase().includes("unique")) {
          throw insertError;
        }
      }
    } else {
      const nextAttempts = Number(existing.attempts ?? 0) + 1;
      const { error: updateAttemptsError } = await supabaseAdmin
        .from("asaas_webhook_events")
        .update({ status: "processing", attempts: nextAttempts })
        .eq("event_key", eventKey);

      if (updateAttemptsError) throw updateAttemptsError;
    }

    try {
      const subscription = (payload as any)?.subscription;
      if (subscription && typeof subscription === "object") {
        const tenantId = typeof subscription.externalReference === "string" ? subscription.externalReference : null;
        const asaasSubscriptionId = typeof subscription.id === "string" ? subscription.id : null;
        const asaasCustomerId = typeof subscription.customer === "string" ? subscription.customer : null;
        const subStatus = typeof subscription.status === "string" ? subscription.status.toLowerCase() : null;

        if (tenantId) {
          const mappedStatus = subStatus === "active" ? "active" : subStatus === "inactive" ? "inactive" : subStatus === "canceled" ? "inactive" : null;
          const update: Record<string, unknown> = {
            billing_provider: "asaas",
            asaas_subscription_id: asaasSubscriptionId,
            asaas_customer_id: asaasCustomerId,
          };

          if (mappedStatus) update.status = mappedStatus;

          await supabaseAdmin.from("subscriptions").update(update).eq("tenant_id", tenantId);
        }
      }

      const { error: markProcessedError } = await supabaseAdmin
        .from("asaas_webhook_events")
        .update({ status: "processed", processed_at: new Date().toISOString(), last_error: null })
        .eq("event_key", eventKey);

      if (markProcessedError) throw markProcessedError;

      res.status(200).json({ received: true });
    } catch (handlerError) {
      const msg = handlerError instanceof Error ? handlerError.message : String(handlerError);

      await supabaseAdmin
        .from("asaas_webhook_events")
        .update({ status: "failed", last_error: msg })
        .eq("event_key", eventKey);

      throw handlerError;
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    res.status(500).json({ ok: false, error: message });
  }
}
