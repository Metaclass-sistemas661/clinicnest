 
import { applySubscriptionUpdate, fetchSubscriptionFromAsaas, getAsaasEventAt, mapSubscriptionFromAsaas } from "./asaasBilling.js";

function isValidNonZeroUuid(v: unknown): v is string {
  if (typeof v !== "string") return false;
  const s = v.trim();
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  if (!uuid.test(s)) return false;
  if (s === "00000000-0000-0000-0000-000000000000") return false;
  return true;
}

export async function processAsaasWebhookPayload(params: {
  supabaseAdmin: any;
  payload: any;
  eventKey: string;
  eventType: string;
  asaasApiKey: string | null;
  asaasApiBase: string;
}): Promise<{
  ok: boolean;
  updatedSubscription: boolean;
  tenantId: string | null;
  reason?: string;
}> {
  const subscriptionFromPayload = params.payload?.subscription;
  const paymentFromPayload = params.payload?.payment;

  const asaasSubscriptionId: string | null =
    (subscriptionFromPayload && typeof subscriptionFromPayload.id === "string" && subscriptionFromPayload.id) ||
    (paymentFromPayload && typeof paymentFromPayload.subscription === "string" && paymentFromPayload.subscription) ||
    null;

  const tenantIdFromPayload: string | null =
    subscriptionFromPayload && isValidNonZeroUuid(subscriptionFromPayload.externalReference)
      ? subscriptionFromPayload.externalReference
      : null;

  const checkoutSessionIdFromPayment: string | null =
    paymentFromPayload && typeof paymentFromPayload.checkoutSession === "string" ? paymentFromPayload.checkoutSession : null;

  if (!asaasSubscriptionId) {
    return { ok: true, updatedSubscription: false, tenantId: null, reason: "no_subscription_id" };
  }

  const shouldFetch = Boolean(
    params.asaasApiKey && (params.eventType.startsWith("SUBSCRIPTION_") || params.eventType.startsWith("PAYMENT_"))
  );

  const sub = shouldFetch
    ? await fetchSubscriptionFromAsaas({
        subscriptionId: asaasSubscriptionId,
        apiBase: params.asaasApiBase,
        apiKey: params.asaasApiKey!,
      })
    : subscriptionFromPayload;

  let tenantId: string | null =
    tenantIdFromPayload || (sub && isValidNonZeroUuid(sub.externalReference) ? sub.externalReference : null);

  if (!tenantId && checkoutSessionIdFromPayment) {
    const { data: mapping, error: mappingError } = await params.supabaseAdmin
      .from("asaas_checkout_sessions")
      .select("tenant_id")
      .eq("checkout_session_id", checkoutSessionIdFromPayment)
      .maybeSingle();

    if (mappingError) throw mappingError;
    tenantId = (mapping as any)?.tenant_id ?? null;
  }

  if (!tenantId) {
    return { ok: true, updatedSubscription: false, tenantId: null, reason: "tenant_id_not_resolved" };
  }

  const mapped = mapSubscriptionFromAsaas(sub);
  const eventAt = getAsaasEventAt(params.payload);

  const applyRes = await applySubscriptionUpdate({
    supabaseAdmin: params.supabaseAdmin,
    tenantId,
    eventKey: params.eventKey,
    eventAt,
    status: mapped.status,
    plan: mapped.plan,
    currentPeriodEnd: mapped.currentPeriodEnd,
    asaasCustomerId: mapped.asaasCustomerId,
    asaasSubscriptionId,
  });

  const applied = Boolean(applyRes?.applied);
  const reason = applyRes?.reason ?? "";

  return { ok: true, updatedSubscription: applied, tenantId, reason };
}
