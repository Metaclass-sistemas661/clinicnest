/**
 * Escuta INSERT em appointments com public_booking_token != null (agendamentos online)
 * e exibe um toast de notificação em tempo real para admins.
 */
import { useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CalendarCheck } from "lucide-react";

export function NewOnlineBookingListener() {
  const { profile, isAdmin } = useAuth();
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isAdmin || !profile?.tenant_id) return;

    const channel = supabase
      .channel(`online-bookings:${profile.tenant_id}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointments",
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          const row = payload.new as {
            public_booking_token?: string | null;
            scheduled_at?: string;
          };

          // Só notificar se for agendamento online (tem token público)
          if (!row.public_booking_token) return;

          const timeLabel = row.scheduled_at
            ? new Date(row.scheduled_at).toLocaleString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                timeZone: "America/Sao_Paulo",
              })
            : "";

          toast.success(
            timeLabel
              ? `Novo agendamento online! ${timeLabel}`
              : "Novo agendamento online recebido!",
            {
              icon: <CalendarCheck className="h-4 w-4 text-green-500" />,
              duration: 6000,
              action: {
                label: "Ver Agenda",
                onClick: () => window.location.assign("/agenda"),
              },
            }
          );
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [isAdmin, profile?.tenant_id]);

  return null;
}
