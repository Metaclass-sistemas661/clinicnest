/**
 * Plan Gating — Subscription tier checking & quota tracking
 * Replaces: _shared/planGating.ts
 */
import { adminQuery } from './db';

export type TierKey = 'free' | 'starter' | 'solo' | 'clinic' | 'premium';

interface FeatureAccess {
  allowed: boolean;
  reason?: string;
  tier: TierKey;
  dailyUsed?: number;
  dailyLimit?: number;
}

const FEATURE_TIERS: Record<string, TierKey[]> = {
  triage: ['free', 'starter', 'solo', 'clinic', 'premium'],
  cid_suggest: ['free', 'starter', 'solo', 'clinic', 'premium'],
  agent_chat: ['starter', 'solo', 'clinic', 'premium'],
  patient_chat: ['starter', 'solo', 'clinic', 'premium'],
  summary: ['solo', 'clinic', 'premium'],
  sentiment: ['solo', 'clinic', 'premium'],
  drug_interactions: ['solo', 'clinic', 'premium'],
  explain_patient: ['solo', 'clinic', 'premium'],
  transcribe: ['clinic', 'premium'],
  copilot: ['clinic', 'premium'],
  cancel_prediction: ['clinic', 'premium'],
  weekly_summary: ['clinic', 'premium'],
  benchmarking: ['premium'],
  revenue_intelligence: ['premium'],
};

const DAILY_LIMITS: Record<TierKey, number> = {
  free: 5,
  starter: 10,
  solo: 25,
  clinic: 60,
  premium: 999999,
};

const SUPERADMIN_IDS = (process.env.SUPERADMIN_USER_IDS || '').split(',').filter(Boolean);

export function parseTierFromPlan(plan: unknown): TierKey {
  if (typeof plan !== 'string') return 'free';
  const s = plan.trim().toLowerCase();
  if (!s) return 'free';
  const [tierRaw] = s.split('_');
  if (tierRaw === 'basic') return 'starter';
  if (tierRaw === 'pro' || tierRaw === 'clinica') return 'clinic';
  if (['free', 'starter', 'solo', 'clinic', 'premium'].includes(tierRaw)) return tierRaw as TierKey;
  return 'free';
}

export async function checkAiAccess(
  userId: string,
  tenantId: string,
  feature: string
): Promise<FeatureAccess> {
  if (SUPERADMIN_IDS.includes(userId)) {
    return { allowed: true, tier: 'premium' };
  }

  const subResult = await adminQuery(
    `SELECT s.plan, s.status, s.trial_end
     FROM subscriptions s WHERE s.tenant_id = $1 LIMIT 1`,
    [tenantId]
  );
  const sub = subResult.rows[0];

  let tier: TierKey = 'free';
  if (sub) {
    if (sub.status === 'trialing' && sub.trial_end && new Date(sub.trial_end) > new Date()) {
      tier = 'premium';
    } else if (sub.status === 'active') {
      tier = parseTierFromPlan(sub.plan);
    }
  }

  const allowedTiers = FEATURE_TIERS[feature];
  if (allowedTiers && !allowedTiers.includes(tier)) {
    return { allowed: false, reason: 'Recurso não disponível no seu plano.', tier };
  }

  const today = new Date().toISOString().slice(0, 10);
  const usageResult = await adminQuery(
    `SELECT COUNT(*) as cnt FROM ai_usage_log
     WHERE user_id = $1 AND tenant_id = $2 AND created_at::date = $3::date`,
    [userId, tenantId, today]
  );
  const dailyUsed = parseInt(usageResult.rows[0]?.cnt || '0', 10);
  const dailyLimit = DAILY_LIMITS[tier];

  if (dailyUsed >= dailyLimit) {
    return { allowed: false, reason: 'Limite diário de uso de IA atingido.', tier, dailyUsed, dailyLimit };
  }

  return { allowed: true, tier, dailyUsed, dailyLimit };
}

export async function logAiUsage(
  userId: string,
  tenantId: string,
  feature: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  await adminQuery(
    `INSERT INTO ai_usage_log (user_id, tenant_id, feature, metadata) VALUES ($1, $2, $3, $4)`,
    [userId, tenantId, feature, JSON.stringify(metadata || {})]
  );
}
