import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { apiPatient } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

const CHANNEL_NAME = "patient-auth-sync";

/**
 * Syncs patient authentication state across browser tabs via BroadcastChannel.
 * When one tab logs out, all other tabs are immediately logged out too.
 */
export function usePatientAuthSync() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;

    const channel = new BroadcastChannel(CHANNEL_NAME);

    channel.onmessage = async (event) => {
      if (event.data?.type === "patient-logout") {
        logger.info("[AuthSync] Logout received from another tab");
        await apiPatient.auth.signOut();
        localStorage.removeItem("patient-session-start");
        localStorage.removeItem("sb-patient-auth-token");
        toast.info("Você foi desconectado em outra aba.");
        navigate("/paciente/login", { replace: true });
      }
    };

    // Listen for local sign-out and broadcast to other tabs
    const { data: { subscription } } = apiPatient.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        try {
          channel.postMessage({ type: "patient-logout" });
        } catch {
          // Channel may be closed
        }
      }
    });

    return () => {
      subscription.unsubscribe();
      channel.close();
    };
  }, [navigate]);
}
