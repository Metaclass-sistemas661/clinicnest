import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { Activity } from "lucide-react";

export function TriageRealtimeListener() {
  const { profile } = useAuth();
  const channelRef = useRef<ReturnType<typeof api.channel> | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const channel = api
      .channel("triage-new-records")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "triage_records",
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          const row = payload.new as {
            priority?: string;
            chief_complaint?: string;
            clients?: { name?: string };
          };
          const priorityLabels: Record<string, string> = {
            emergencia: "EMERGÊNCIA",
            urgente: "Urgente",
            pouco_urgente: "Pouco urgente",
            nao_urgente: "Não urgente",
          };
          const priority = priorityLabels[row.priority ?? ""] || row.priority || "";
          const complaint = row.chief_complaint
            ? row.chief_complaint.slice(0, 80)
            : "";

          toast.info("Nova triagem recebida", {
            description: `${priority}${complaint ? ` — ${complaint}` : ""}`,
            duration: 8000,
            icon: <Activity className="h-4 w-4 text-primary" />,
            action: {
              label: "Ver Prontuários",
              onClick: () => {
                window.location.href = "/prontuarios";
              },
            },
          });
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [profile?.tenant_id]);

  return null;
}
