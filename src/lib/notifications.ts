import { supabase } from "@/integrations/supabase/client";

export type NotificationType =
  | "appointment_created"
  | "appointment_completed"
  | "appointment_cancelled"
  | "goal_approved"
  | "goal_rejected"
  | "goal_reminder"
  | "goal_reached"
  | "commission_paid";

const PREF_MAP: Record<NotificationType, keyof { goal_approved: boolean; goal_rejected: boolean; appointment_created: boolean; appointment_completed: boolean; appointment_cancelled: boolean; goal_reminder: boolean; goal_reached: boolean; commission_paid: boolean }> = {
  appointment_created: "appointment_created",
  appointment_completed: "appointment_completed",
  appointment_cancelled: "appointment_cancelled",
  goal_approved: "goal_approved",
  goal_rejected: "goal_rejected",
  goal_reminder: "goal_reminder",
  goal_reached: "goal_reached",
  commission_paid: "commission_paid",
};

/** Verifica preferências e insere notificação se o usuário optou por receber */
export async function notifyUser(
  tenantId: string,
  userId: string,
  type: NotificationType,
  title: string,
  body: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const prefKey = PREF_MAP[type];
    const { data: prefs } = await supabase
      .from("user_notification_preferences")
      .select(prefKey)
      .eq("user_id", userId)
      .maybeSingle();

    const enabled = prefs?.[prefKey] !== false; // default true se não tiver prefs

    if (!enabled) return;

    await supabase.from("notifications").insert({
      tenant_id: tenantId,
      user_id: userId,
      type,
      title,
      body: body || null,
      metadata: metadata ?? {},
    });
  } catch (e) {
    console.warn("Erro ao enviar notificação:", e);
  }
}
