import { useEffect, useRef } from "react";
import { api, RealtimeChannel } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";


interface UseConsentRealtimeOptions {
  /** ID do tenant para filtrar atualizações */
  tenantId: string | undefined;
  /** Callback quando um consent é selado (sealed_pdf_path preenchido) */
  onSealed?: (consentId: string) => void;
  /** Se true, exibe toast automático ao selar */
  showToast?: boolean;
  /** Se habilitado */
  enabled?: boolean;
}

/**
 * Hook que escuta atualizações em patient_consents via Realtime channel.
 * Dispara callback e/ou toast quando um PDF é selado (sealed_pdf_path preenchido).
 */
export function useConsentRealtime({
  tenantId,
  onSealed,
  showToast = true,
  enabled = true,
}: UseConsentRealtimeOptions) {
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!enabled || !tenantId) return;

    const channel = api
      .channel(`consent-sealed-${tenantId}`)
      .on(
        "postgres_changes" as any,
        {
          event: "UPDATE",
          schema: "public",
          table: "patient_consents",
          filter: `tenant_id=eq.${tenantId}`,
        },
        (payload: any) => {
          const newRow = payload.new;
          const oldRow = payload.old;

          // Disparar apenas se sealed_pdf_path mudou de null para valor
          if (newRow?.sealed_pdf_path && !oldRow?.sealed_pdf_path) {
            logger.info("[ConsentRealtime] Consent sealed", { id: newRow.id });

            if (showToast) {
              toast.success("Termo assinado e selado com sucesso!", {
                description: "O PDF com validade jurídica foi gerado.",
                duration: 5000,
              });
            }

            onSealed?.(newRow.id);
          }
        },
      )
      .subscribe((status: string) => {
        if (status === "SUBSCRIBED") {
          logger.info("[ConsentRealtime] Subscribed", { tenantId });
        }
      });

    channelRef.current = channel;

    return () => {
      if (channelRef.current) {
        api.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [tenantId, enabled, onSealed, showToast]);
}
