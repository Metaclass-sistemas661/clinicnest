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

function toIsoDateStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function parseAsaasDate(input: unknown): Date | null {
  if (typeof input !== "string") return null;
  const s = input.trim();

  // Common Asaas formats:
  // - "2017-06-15"
  // - "22/11/2024"
  const iso = /^\d{4}-\d{2}-\d{2}$/;
  if (iso.test(s)) {
    const d = new Date(`${s}T00:00:00.000Z`);
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/;
  const m = s.match(br);
  if (m) {
    const dd = Number(m[1]);
    const mm = Number(m[2]);
    const yyyy = Number(m[3]);
    const d = new Date(Date.UTC(yyyy, mm - 1, dd, 0, 0, 0, 0));
    return Number.isNaN(d.getTime()) ? null : d;
  }

  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function mapAsaasStatusToApp(status: unknown): string | null {
  if (typeof status !== "string") return null;
  const s = status.toLowerCase();
  if (s === "active") return "active";
  if (s === "inactive") return "inactive";
  if (s === "expired") return "inactive";
  if (s === "canceled" || s === "cancelled") return "inactive";
  return null;
}

function isValidNonZeroUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(s)) return false;
  if (s === "00000000-0000-0000-0000-000000000000") return false;
  return true;
}

function mapAsaasPlan(cycle: unknown, value: unknown): string | null {
  if (typeof cycle !== "string") return null;
  const c = cycle.toUpperCase();
  const v = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  const approx = (a: number, b: number) => Math.abs(a - b) <= 0.01;

  if (c === "MONTHLY" && Number.isFinite(v) && approx(v, 79.9)) return "monthly";
  if (c === "QUARTERLY" && Number.isFinite(v) && approx(v, 209.7)) return "quarterly";
  if (c === "YEARLY" && Number.isFinite(v) && approx(v, 598.8)) return "annual";

  if (c === "MONTHLY") return "monthly";
  if (c === "QUARTERLY") return "quarterly";
  if (c === "YEARLY") return "annual";

  return null;
}

async function fetchSubscriptionFromAsaas(params: {
  subscriptionId: string;
  apiBase: string;
  apiKey: string;
}): Promise<any> {
  const resp = await fetch(
    `${params.apiBase.replace(/\/$/, "")}/v3/subscriptions/${encodeURIComponent(params.subscriptionId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "salon-flow",
        access_token: params.apiKey,
      },
    }
  );

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Asaas subscription fetch failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function fetchCustomerFromAsaas(params: {
  customerId: string;
  apiBase: string;
  apiKey: string;
}): Promise<any> {
  const resp = await fetch(
    `${params.apiBase.replace(/\/$/, "")}/v3/customers/${encodeURIComponent(params.customerId)}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        "User-Agent": "salon-flow",
        access_token: params.apiKey,
      },
    }
  );

  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Asaas customer fetch failed (${resp.status}): ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
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

    const asaasApiKey = process.env.ASAAS_API_KEY;
    const asaasApiBase = process.env.ASAAS_API_BASE_URL || "https://api-sandbox.asaas.com";

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
      const subscriptionFromPayload = (payload as any)?.subscription;
      const paymentFromPayload = (payload as any)?.payment;

      const asaasSubscriptionId: string | null =
        (subscriptionFromPayload && typeof subscriptionFromPayload.id === "string" && subscriptionFromPayload.id)
        || (paymentFromPayload && typeof paymentFromPayload.subscription === "string" && paymentFromPayload.subscription)
        || null;

      // Determine tenant_id (preferred) from subscription.externalReference
      const tenantIdFromPayload: string | null =
        subscriptionFromPayload && isValidNonZeroUuid(subscriptionFromPayload.externalReference)
          ? subscriptionFromPayload.externalReference
          : null;

      const checkoutSessionIdFromPayment: string | null =
        paymentFromPayload && typeof paymentFromPayload.checkoutSession === "string"
          ? paymentFromPayload.checkoutSession
          : null;

      if (asaasSubscriptionId) {
        // Fetch latest subscription state from Asaas on important events
        const shouldFetch = Boolean(
          asaasApiKey
          && (
            eventType.startsWith("SUBSCRIPTION_")
            || eventType.startsWith("PAYMENT_")
          )
        );

        const sub = shouldFetch
          ? await fetchSubscriptionFromAsaas({ subscriptionId: asaasSubscriptionId, apiBase: asaasApiBase, apiKey: asaasApiKey! })
          : subscriptionFromPayload;

        let tenantId =
          tenantIdFromPayload
          || (sub && isValidNonZeroUuid(sub.externalReference) ? sub.externalReference : null);

        if (!tenantId && asaasApiKey) {
          const asaasCustomerIdFromPayment =
            paymentFromPayload && typeof paymentFromPayload.customer === "string" ? paymentFromPayload.customer : null;
          const asaasCustomerIdFromSub = sub && typeof sub.customer === "string" ? sub.customer : null;
          const asaasCustomerIdForLookup = asaasCustomerIdFromPayment || asaasCustomerIdFromSub;

          if (asaasCustomerIdForLookup) {
            const customer = await fetchCustomerFromAsaas({
              customerId: asaasCustomerIdForLookup,
              apiBase: asaasApiBase,
              apiKey: asaasApiKey,
            });
            tenantId = isValidNonZeroUuid(customer?.externalReference) ? customer.externalReference : null;
          }
        }

        if (!tenantId && checkoutSessionIdFromPayment) {
          const { data: mapping, error: mappingError } = await supabaseAdmin
            .from("asaas_checkout_sessions")
            .select("tenant_id")
            .eq("checkout_session_id", checkoutSessionIdFromPayment)
            .maybeSingle();

          if (mappingError) throw mappingError;
          tenantId = mapping?.tenant_id ?? null;
        }

        const asaasCustomerId = sub && typeof sub.customer === "string" ? sub.customer : null;
        const mappedStatus = mapAsaasStatusToApp(sub?.status);
        const mappedPlan = mapAsaasPlan(sub?.cycle, sub?.value);
        const nextDue = parseAsaasDate(sub?.nextDueDate);

        const update: Record<string, unknown> = {
          billing_provider: "asaas",
          asaas_subscription_id: asaasSubscriptionId,
          asaas_customer_id: asaasCustomerId,
        };

        if (mappedStatus) update.status = mappedStatus;
        if (mappedPlan) update.plan = mappedPlan;
        if (nextDue) update.current_period_end = toIsoDateStart(nextDue);

        if (tenantId) {
          await supabaseAdmin.from("subscriptions").update(update).eq("tenant_id", tenantId);
        } else {
          // Fallback if externalReference is missing
          await supabaseAdmin
            .from("subscriptions")
            .update(update)
            .eq("asaas_subscription_id", asaasSubscriptionId);
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
