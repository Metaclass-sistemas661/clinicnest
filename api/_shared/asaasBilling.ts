function mapAsaasStatusToApp(status: unknown): string | null {
  if (typeof status !== "string") return null;
  const s = status.toLowerCase();
  if (s === "active") return "active";
  if (s === "inactive") return "inactive";
  if (s === "expired") return "inactive";
  if (s === "canceled" || s === "cancelled") return "inactive";
  return null;
}

function toIsoDateStart(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function parseAsaasDate(input: any): Date | null {
  if (!input || typeof input !== "string") return null;
  const s = input.trim();

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

function mapAsaasPlan(cycle: unknown, value: unknown): string | null {
  if (typeof cycle !== "string") return null;
  const c = cycle.toUpperCase();
  const v = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  const approx = (a: number, b: number) => Math.abs(a - b) <= 0.05;

  const interval = (() => {
    if (c === "MONTHLY") return "monthly" as const;
    if (c === "QUARTERLY") return "quarterly" as const;
    if (c === "YEARLY") return "annual" as const;
    return null;
  })();
  if (!interval) return null;

  if (Number.isFinite(v)) {
    // Legacy plans (pre-2026)
    if (interval === "monthly" && approx(v, 79.9)) return "basic_monthly";
    if (interval === "quarterly" && approx(v, 219.9)) return "basic_quarterly";
    if (interval === "annual" && approx(v, 719.0)) return "basic_annual";

    if (interval === "monthly" && approx(v, 119.9)) return "pro_monthly";
    if (interval === "quarterly" && approx(v, 329.9)) return "pro_quarterly";
    if (interval === "annual" && approx(v, 1079.0)) return "pro_annual";

    if (interval === "monthly" && approx(v, 169.9)) return "premium_monthly";
    if (interval === "quarterly" && approx(v, 469.9)) return "premium_quarterly";
    if (interval === "annual" && approx(v, 1499.0)) return "premium_annual";

    // Current plans (2026+)
    if (interval === "monthly" && approx(v, 89.9)) return "starter_monthly";
    if (interval === "annual" && approx(v, 809.0)) return "starter_annual";

    if (interval === "monthly" && approx(v, 159.9)) return "solo_monthly";
    if (interval === "annual" && approx(v, 1439.1)) return "solo_annual";

    if (interval === "monthly" && approx(v, 289.9)) return "clinic_monthly";
    if (interval === "annual" && approx(v, 2609.1)) return "clinic_annual";

    if (interval === "monthly" && approx(v, 399.9)) return "premium_monthly";
    if (interval === "annual" && approx(v, 3599.0)) return "premium_annual";
  }

  return null;
}

function extractEventAt(payload: any): Date {
  const candidates = [
    payload?.dateCreated,
    payload?.payment?.dateCreated,
    payload?.subscription?.dateCreated,
    payload?.payment?.confirmedDate,
    payload?.payment?.creditDate,
    payload?.subscription?.updatedAt,
    payload?.payment?.updatedAt,
  ].filter(Boolean);

  for (const c of candidates) {
    const d = typeof c === "string" ? new Date(c) : null;
    if (d && !Number.isNaN(d.getTime())) return d;
  }
  return new Date();
}

export async function fetchSubscriptionFromAsaas(params: {
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

export async function applySubscriptionUpdate(params: {
  supabaseAdmin: any;
  tenantId: string;
  eventKey: string;
  eventAt: Date;
  status: string | null;
  plan: string | null;
  currentPeriodEnd: Date | null;
  asaasCustomerId: string | null;
  asaasSubscriptionId: string | null;
}): Promise<{ applied: boolean; reason: string } | null> {
  const { data, error } = await params.supabaseAdmin.rpc("apply_subscription_update", {
    p_tenant_id: params.tenantId,
    p_billing_provider: "asaas",
    p_event_key: params.eventKey,
    p_event_at: params.eventAt.toISOString(),
    p_status: params.status,
    p_plan: params.plan,
    p_current_period_end: params.currentPeriodEnd ? toIsoDateStart(params.currentPeriodEnd) : null,
    p_customer_id: params.asaasCustomerId,
    p_provider_subscription_id: params.asaasSubscriptionId,
  });
  if (error) throw error;

  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return { applied: Boolean(row.applied), reason: String(row.reason ?? "") };
}

export function mapSubscriptionFromAsaas(sub: any): {
  status: string | null;
  plan: string | null;
  currentPeriodEnd: Date | null;
  asaasCustomerId: string | null;
} {
  const mappedStatus = mapAsaasStatusToApp(sub?.status);
  const mappedPlan = mapAsaasPlan(sub?.cycle, sub?.value);
  const nextDue = parseAsaasDate(sub?.nextDueDate);

  return {
    status: mappedStatus,
    plan: mappedPlan,
    currentPeriodEnd: nextDue,
    asaasCustomerId: sub && typeof sub.customer === "string" ? sub.customer : null,
  };
}

export function getAsaasEventAt(payload: any): Date {
  return extractEventAt(payload);
}
