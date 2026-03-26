import { useCallback } from "react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";

type PatientEventType =
  | "login"
  | "logout"
  | "profile_update"
  | "exam_download"
  | "prescription_view"
  | "consent_sign"
  | "data_export"
  | "deletion_request"
  | "mfa_change"
  | "settings_update"
  | "report_view"
  | "certificate_view";

/**
 * Hook to log patient activity events for audit trail.
 * Fires-and-forgets — never blocks user flow.
 */
export function usePatientActivityLog() {
  const logActivity = useCallback(
    async (
      eventType: PatientEventType,
      description?: string,
      metadata?: Record<string, unknown>,
    ) => {
      try {
        await (supabasePatient as any).rpc("log_patient_activity", {
          p_event_type: eventType,
          p_event_description: description ?? null,
          p_metadata: metadata ?? {},
        });
      } catch (err) {
        // Non-blocking — never interrupt user flow
        logger.warn("[ActivityLog] Failed to log event", eventType, err);
      }
    },
    [],
  );

  return { logActivity };
}
