/**
 * AI Plan Gating — Verifies subscription tier access and daily AI quota.
 *
 * Usage pattern inside edge functions:
 *   const access = await checkAiAccess(tenantId, user.id, 'triage');
 *   if (!access.allowed) return new Response(JSON.stringify({ error: access.reason }), { status: 403, ... });
 *   // ... do AI work ...
 *   await logAiUsage(tenantId, user.id, 'triage', inputTokens, outputTokens).catch(() => {});
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

export type AiFeature =
  | "triage"
  | "cid_suggest"
  | "summary"
  | "transcribe"
  | "sentiment"
  | "agent_chat"
  | "patient_chat";

/** Server-side AI plan config (mirrors frontend subscription-plans.ts) */
const AI_PLAN_CONFIG: Record<
  string,
  { features: AiFeature[]; dailyLimit: number; transcribeMinPerMonth: number }
> = {
  starter: {
    features: ["triage", "cid_suggest", "agent_chat", "patient_chat"],
    dailyLimit: 10,
    transcribeMinPerMonth: 0,
  },
  solo: {
    features: ["triage", "cid_suggest", "agent_chat", "patient_chat", "summary", "sentiment"],
    dailyLimit: 25,
    transcribeMinPerMonth: 0,
  },
  clinica: {
    features: ["triage", "cid_suggest", "agent_chat", "patient_chat", "summary", "sentiment", "transcribe"],
    dailyLimit: 60,
    transcribeMinPerMonth: 60,
  },
  premium: {
    features: ["triage", "cid_suggest", "agent_chat", "summary", "sentiment", "transcribe", "patient_chat"],
    dailyLimit: -1, // unlimited
    transcribeMinPerMonth: -1,
  },
};

export interface AiAccessResult {
  allowed: boolean;
  reason?: string;
  tier: string;
  dailyUsed: number;
  dailyLimit: number;
}

function getAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}

/** Parse tier from plan key, e.g. "clinica_monthly" → "clinica" */
function parseTier(plan: string | null): string {
  if (!plan) return "starter";
  const lower = plan.toLowerCase();
  if (lower.startsWith("premium")) return "premium";
  if (lower.startsWith("clinica") || lower.startsWith("clinic")) return "clinica";
  if (lower.startsWith("solo")) return "solo";
  return "starter";
}

/**
 * Check if a tenant's plan allows a specific AI feature and daily quota.
 * Returns { allowed: true } on success, or { allowed: false, reason } on denial.
 */
export async function checkAiAccess(
  tenantId: string,
  userId: string,
  feature: AiFeature,
): Promise<AiAccessResult> {
  const admin = getAdminClient();

  // 1. Get subscription
  const { data: sub } = await admin
    .from("subscriptions")
    .select("plan, status")
    .eq("tenant_id", tenantId)
    .maybeSingle();

  // Allow trialing users too
  if (!sub || !["active", "trialing"].includes(sub.status ?? "")) {
    return {
      allowed: false,
      reason: "Assinatura inativa. Ative seu plano para usar a IA.",
      tier: "none",
      dailyUsed: 0,
      dailyLimit: 0,
    };
  }

  // 2. Determine tier
  const tier = parseTier(sub.plan);
  const config = AI_PLAN_CONFIG[tier];

  if (!config) {
    return { allowed: false, reason: "Plano não reconhecido.", tier, dailyUsed: 0, dailyLimit: 0 };
  }

  // 3. Feature access
  if (!config.features.includes(feature)) {
    const tierNames: Record<string, string> = {
      starter: "Starter",
      solo: "Solo",
      clinica: "Clínica",
      premium: "Premium",
    };
    return {
      allowed: false,
      reason: `Este recurso de IA não está disponível no plano ${tierNames[tier] ?? tier}. Faça upgrade para acessar.`,
      tier,
      dailyUsed: 0,
      dailyLimit: config.dailyLimit,
    };
  }

  // 4. Skip quota check for unlimited plans
  if (config.dailyLimit === -1) {
    return { allowed: true, tier, dailyUsed: 0, dailyLimit: -1 };
  }

  // 5. Count today's usage for this tenant (all AI features combined)
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const { count } = await admin
    .from("ai_usage_log")
    .select("id", { count: "exact", head: true })
    .eq("tenant_id", tenantId)
    .gte("created_at", todayStart.toISOString());

  const dailyUsed = count ?? 0;

  if (dailyUsed >= config.dailyLimit) {
    return {
      allowed: false,
      reason: `Limite diário de IA atingido (${dailyUsed}/${config.dailyLimit}). Tente novamente amanhã ou faça upgrade.`,
      tier,
      dailyUsed,
      dailyLimit: config.dailyLimit,
    };
  }

  return { allowed: true, tier, dailyUsed, dailyLimit: config.dailyLimit };
}

/**
 * Log AI usage after a successful request (for quota tracking & billing).
 * Should be called in a fire-and-forget pattern: logAiUsage(...).catch(() => {})
 */
export async function logAiUsage(
  tenantId: string,
  userId: string,
  feature: AiFeature,
  inputTokens = 0,
  outputTokens = 0,
  costUsd = 0,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  const admin = getAdminClient();

  const { error } = await admin.from("ai_usage_log").insert({
    tenant_id: tenantId,
    user_id: userId,
    feature,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    cost_usd: costUsd,
    metadata,
  });

  if (error) {
    console.warn(`[planGating] Failed to log AI usage: ${error.message}`);
  }
}
