/**
 * No-Show Prediction Model
 * Uses local statistical analysis (no external API needed)
 * Based on historical patterns and patient behavior
 */

import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";

interface PatientHistory {
  total_appointments: number;
  no_shows: number;
  cancellations: number;
  last_no_show_days_ago: number | null;
  avg_days_between_appointments: number | null;
}

interface AppointmentFeatures {
  day_of_week: number; // 0-6
  hour_of_day: number; // 0-23
  days_until_appointment: number;
  is_first_appointment: boolean;
  is_return: boolean;
  professional_no_show_rate: number;
  time_slot_no_show_rate: number;
}

interface NoShowPrediction {
  probability: number; // 0-1
  risk_level: "baixo" | "medio" | "alto";
  risk_factors: string[];
  recommendations: string[];
}

// Risk weights based on research and common patterns
const WEIGHTS = {
  patient_history: 0.35,
  time_slot: 0.20,
  professional: 0.15,
  day_of_week: 0.15,
  lead_time: 0.10,
  first_visit: 0.05,
};

// Day of week risk multipliers (Monday = 0)
const DAY_RISK: Record<number, number> = {
  0: 1.2, // Monday - higher
  1: 1.0, // Tuesday - baseline
  2: 1.0, // Wednesday - baseline
  3: 1.0, // Thursday - baseline
  4: 1.3, // Friday - higher
  5: 1.1, // Saturday - slightly higher
  6: 1.4, // Sunday - highest
};

// Hour risk multipliers
const HOUR_RISK: Record<number, number> = {
  7: 1.1,
  8: 0.9,
  9: 0.8,
  10: 0.8,
  11: 0.9,
  12: 1.2, // Lunch time
  13: 1.3, // After lunch
  14: 1.0,
  15: 1.0,
  16: 1.1,
  17: 1.2,
  18: 1.3,
  19: 1.4,
  20: 1.5,
};

/**
 * Get patient's appointment history
 */
async function getPatientHistory(
  patientId: string,
  tenantId: string
): Promise<PatientHistory | null> {
  const { data, error } = await api
    .from("appointments")
    .select("status, scheduled_at")
    .eq("patient_id", patientId)
    .eq("tenant_id", tenantId)
    .order("scheduled_at", { ascending: false });

  if (error || !data || data.length === 0) {
    return null;
  }

  const total = data.length;
  const noShows = data.filter((a) => a.status === "no_show").length;
  const cancellations = data.filter((a) => a.status === "cancelled").length;

  // Find last no-show
  const lastNoShow = data.find((a) => a.status === "no_show");
  const lastNoShowDaysAgo = lastNoShow
    ? Math.floor(
        (Date.now() - new Date(lastNoShow.scheduled_at).getTime()) / (1000 * 60 * 60 * 24)
      )
    : null;

  // Calculate average days between appointments
  let avgDays: number | null = null;
  if (data.length >= 2) {
    const completedAppts = data.filter((a) => a.status === "completed");
    if (completedAppts.length >= 2) {
      const diffs: number[] = [];
      for (let i = 0; i < completedAppts.length - 1; i++) {
        const diff =
          new Date(completedAppts[i].scheduled_at).getTime() -
          new Date(completedAppts[i + 1].scheduled_at).getTime();
        diffs.push(diff / (1000 * 60 * 60 * 24));
      }
      avgDays = diffs.reduce((a, b) => a + b, 0) / diffs.length;
    }
  }

  return {
    total_appointments: total,
    no_shows: noShows,
    cancellations: cancellations,
    last_no_show_days_ago: lastNoShowDaysAgo,
    avg_days_between_appointments: avgDays,
  };
}

/**
 * Get professional's no-show rate
 */
async function getProfessionalNoShowRate(
  professionalId: string,
  tenantId: string
): Promise<number> {
  const { data, error } = await api
    .from("appointments")
    .select("status")
    .eq("professional_id", professionalId)
    .eq("tenant_id", tenantId)
    .gte("scheduled_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString());

  if (error || !data || data.length < 10) {
    return 0.1; // Default 10% if not enough data
  }

  const noShows = data.filter((a) => a.status === "no_show").length;
  return noShows / data.length;
}

/**
 * Get time slot no-show rate
 */
async function getTimeSlotNoShowRate(
  dayOfWeek: number,
  hour: number,
  tenantId: string
): Promise<number> {
  const { data, error } = await api.rpc("get_time_slot_no_show_rate", {
    p_tenant_id: tenantId,
    p_day_of_week: dayOfWeek,
    p_hour: hour,
  });

  if (error || data === null) {
    return 0.1; // Default 10%
  }

  return data;
}

/**
 * Calculate no-show probability
 */
function calculateProbability(
  history: PatientHistory | null,
  features: AppointmentFeatures
): number {
  let score = 0;

  // Patient history factor (35%)
  if (history) {
    const patientNoShowRate =
      history.total_appointments > 0 ? history.no_shows / history.total_appointments : 0;
    score += patientNoShowRate * WEIGHTS.patient_history;

    // Recent no-show increases risk
    if (history.last_no_show_days_ago !== null && history.last_no_show_days_ago < 30) {
      score += 0.1;
    }
  } else {
    // New patient - slightly higher risk
    score += 0.15 * WEIGHTS.patient_history;
  }

  // Time slot factor (20%)
  score += features.time_slot_no_show_rate * WEIGHTS.time_slot;

  // Professional factor (15%)
  score += features.professional_no_show_rate * WEIGHTS.professional;

  // Day of week factor (15%)
  const dayRisk = DAY_RISK[features.day_of_week] || 1.0;
  score += (dayRisk - 1) * 0.1 * WEIGHTS.day_of_week;

  // Lead time factor (10%) - appointments far in advance have higher no-show
  if (features.days_until_appointment > 14) {
    score += 0.15 * WEIGHTS.lead_time;
  } else if (features.days_until_appointment > 7) {
    score += 0.1 * WEIGHTS.lead_time;
  } else if (features.days_until_appointment > 3) {
    score += 0.05 * WEIGHTS.lead_time;
  }

  // First visit factor (5%)
  if (features.is_first_appointment) {
    score += 0.2 * WEIGHTS.first_visit;
  }

  // Hour risk adjustment
  const hourRisk = HOUR_RISK[features.hour_of_day] || 1.0;
  score *= hourRisk;

  // Clamp between 0 and 1
  return Math.min(Math.max(score, 0), 1);
}

/**
 * Generate risk factors and recommendations
 */
function generateInsights(
  probability: number,
  history: PatientHistory | null,
  features: AppointmentFeatures
): { risk_factors: string[]; recommendations: string[] } {
  const riskFactors: string[] = [];
  const recommendations: string[] = [];

  // Patient history risks
  if (history) {
    if (history.no_shows > 0) {
      const rate = ((history.no_shows / history.total_appointments) * 100).toFixed(0);
      riskFactors.push(`Histórico: ${history.no_shows} faltas em ${history.total_appointments} consultas (${rate}%)`);
      recommendations.push("Enviar lembrete extra 24h antes");
    }
    if (history.last_no_show_days_ago !== null && history.last_no_show_days_ago < 30) {
      riskFactors.push(`Faltou há ${history.last_no_show_days_ago} dias`);
      recommendations.push("Confirmar presença por telefone");
    }
  } else {
    riskFactors.push("Primeira consulta (sem histórico)");
    recommendations.push("Enviar instruções detalhadas de como chegar");
  }

  // Time-based risks
  if (features.day_of_week === 0 || features.day_of_week === 4) {
    riskFactors.push(`${features.day_of_week === 0 ? "Segunda" : "Sexta"}-feira tem maior taxa de faltas`);
  }

  if (features.hour_of_day >= 18) {
    riskFactors.push("Horário noturno tem maior taxa de faltas");
  }

  if (features.days_until_appointment > 14) {
    riskFactors.push(`Agendamento com ${features.days_until_appointment} dias de antecedência`);
    recommendations.push("Enviar lembrete 7 dias antes");
  }

  // Professional risk
  if (features.professional_no_show_rate > 0.15) {
    riskFactors.push(`Profissional com taxa de no-show acima da média (${(features.professional_no_show_rate * 100).toFixed(0)}%)`);
  }

  // General recommendations based on probability
  if (probability > 0.3) {
    recommendations.push("Considerar overbooking controlado");
    recommendations.push("Ligar para confirmar no dia anterior");
  }

  if (probability > 0.5) {
    recommendations.push("Solicitar confirmação por WhatsApp");
    recommendations.push("Considerar lista de espera para este horário");
  }

  return { risk_factors: riskFactors, recommendations };
}

/**
 * Main prediction function
 */
export async function predictNoShow(
  appointmentId: string,
  tenantId: string
): Promise<NoShowPrediction> {
  // Get appointment details
  const { data: appointment, error } = await api
    .from("appointments")
    .select(`
      id,
      patient_id,
      professional_id,
      scheduled_at,
      consultation_type
    `)
    .eq("id", appointmentId)
    .eq("tenant_id", tenantId)
    .single();

  if (error || !appointment) {
    throw new Error("Appointment not found");
  }

  const startTime = new Date(appointment.scheduled_at);
  const now = new Date();

  // Get patient history
  const history = await getPatientHistory(appointment.patient_id, tenantId);

  // Get professional no-show rate
  const professionalRate = await getProfessionalNoShowRate(
    appointment.professional_id,
    tenantId
  );

  // Get time slot no-show rate
  const timeSlotRate = await getTimeSlotNoShowRate(
    startTime.getDay(),
    startTime.getHours(),
    tenantId
  );

  // Build features
  const features: AppointmentFeatures = {
    day_of_week: startTime.getDay(),
    hour_of_day: startTime.getHours(),
    days_until_appointment: Math.ceil(
      (startTime.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
    ),
    is_first_appointment: !history || history.total_appointments === 0,
    is_return: appointment.consultation_type === "retorno",
    professional_no_show_rate: professionalRate,
    time_slot_no_show_rate: timeSlotRate,
  };

  // Calculate probability
  const probability = calculateProbability(history, features);

  // Determine risk level
  let riskLevel: "baixo" | "medio" | "alto";
  if (probability < 0.2) {
    riskLevel = "baixo";
  } else if (probability < 0.4) {
    riskLevel = "medio";
  } else {
    riskLevel = "alto";
  }

  // Generate insights
  const { risk_factors, recommendations } = generateInsights(probability, history, features);

  return {
    probability: Math.round(probability * 100) / 100,
    risk_level: riskLevel,
    risk_factors,
    recommendations,
  };
}

/**
 * Batch prediction for multiple appointments
 */
export async function predictNoShowBatch(
  appointmentIds: string[],
  tenantId: string
): Promise<Map<string, NoShowPrediction>> {
  const results = new Map<string, NoShowPrediction>();

  for (const id of appointmentIds) {
    try {
      const prediction = await predictNoShow(id, tenantId);
      results.set(id, prediction);
    } catch (error) {
      logger.error(`Error predicting no-show for ${id}:`, error);
    }
  }

  return results;
}

export type { NoShowPrediction, PatientHistory, AppointmentFeatures };
