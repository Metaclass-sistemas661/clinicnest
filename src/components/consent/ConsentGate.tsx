import { ReactNode, useEffect, useState, useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { supabasePatient } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { logger } from "@/lib/logger";

interface ConsentGateProps {
  children: ReactNode;
}

/**
 * Wraps patient portal pages. If the patient has pending required consents,
 * redirects to /paciente/termos to force signing before accessing any page.
 * The signing page itself is excluded from this gate.
 */
export function ConsentGate({ children }: ConsentGateProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [checking, setChecking] = useState(true);
  const [allowed, setAllowed] = useState(false);

  // The consent signing page itself must not be gated
  const isConsentPage = location.pathname === "/paciente/termos";

  const checkConsents = useCallback(async () => {
    if (isConsentPage) {
      setAllowed(true);
      setChecking(false);
      return;
    }

    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user?.email) {
        // No user or no email — let PatientProtectedRoute handle redirect
        setAllowed(true);
        setChecking(false);
        return;
      }

      // Resolve client_id
      const { data: client } = await supabasePatient
        .from("clients")
        .select("id")
        .eq("email", user.email)
        .limit(1)
        .maybeSingle();

      if (!client?.id) {
        // Not linked to a clinic yet — allow through (no consents to sign)
        setAllowed(true);
        setChecking(false);
        return;
      }

      // Check pending consents
      const { data: pending, error } = await supabasePatient.rpc("get_pending_consents", {
        p_client_id: client.id,
      });

      if (error) {
        logger.error("[ConsentGate] rpc error", error);
        // On error, allow through to avoid blocking permanently
        setAllowed(true);
        setChecking(false);
        return;
      }

      const hasPending = Array.isArray(pending) && pending.length > 0;

      if (hasPending) {
        navigate("/paciente/termos", { replace: true });
        return;
      }

      setAllowed(true);
    } catch (err) {
      logger.error("[ConsentGate] check error", err);
      setAllowed(true);
    } finally {
      setChecking(false);
    }
  }, [isConsentPage, navigate]);

  useEffect(() => {
    setChecking(true);
    setAllowed(false);
    checkConsents();
  }, [checkConsents, location.pathname]);

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
      </div>
    );
  }

  if (!allowed) return null;

  return <>{children}</>;
}
