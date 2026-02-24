import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";

/**
 * Logs clinical data access events to audit_logs via RPCs.
 * Fire-and-forget — never blocks the UI.
 */
export function useClinicalAudit() {
  const { user, profile } = useAuth();
  const logged = useRef<Set<string>>(new Set());

  const logAccess = useCallback(
    (resource: string, resourceId?: string | null, patientId?: string | null) => {
      if (!user || !profile?.tenant_id) return;

      const key = `${resource}:${resourceId ?? ""}:${patientId ?? ""}`;
      if (logged.current.has(key)) return;
      logged.current.add(key);

      (supabase as any)
        .rpc("log_clinical_access", {
          p_resource: resource,
          p_resource_id: resourceId ?? null,
          p_patient_id: patientId ?? null,
        })
        .then(() => {})
        .catch((err: unknown) => {
          logger.error("Audit log_clinical_access failed:", err);
        });
    },
    [user, profile?.tenant_id]
  );

  const logAccessDenied = useCallback(
    (resource: string, action: string = "view") => {
      if (!user || !profile?.tenant_id) return;

      (supabase as any)
        .rpc("log_access_denied", {
          p_resource: resource,
          p_action: action,
        })
        .then(() => {})
        .catch((err: unknown) => {
          logger.error("Audit log_access_denied failed:", err);
        });
    },
    [user, profile?.tenant_id]
  );

  return { logAccess, logAccessDenied };
}
