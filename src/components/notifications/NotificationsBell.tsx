import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

const _TYPE_LABELS: Record<string, string> = {
  appointment_created: "Novo agendamento",
  appointment_completed: "Atendimento concluído",
  appointment_cancelled: "Agendamento cancelado",
  goal_approved: "Meta aprovada",
  goal_rejected: "Meta rejeitada",
  goal_reminder: "Meta quase alcançada",
  goal_reached: "Meta alcançada",
  commission_paid: "Comissão paga",
};

export function NotificationsBell() {
  const { profile, user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  const fetchNotifications = async () => {
    if (!user?.id || !profile?.tenant_id) return;
    const { data } = await supabase
      .from("notifications")
      .select("id, type, title, body, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);
    setNotifications((data || []) as Notification[]);
    setUnreadCount((data || []).filter((n: Notification) => !n.read_at).length);
  };

  useEffect(() => {
    fetchNotifications();
    const channel = supabase
      .channel("notifications-changes")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user?.id}`,
        },
        fetchNotifications
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, profile?.tenant_id]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await supabase
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    fetchNotifications();
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative h-9 w-9 rounded-xl"
          title="Notificações"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <h3 className="font-semibold">Notificações</h3>
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllRead}>
              Marcar todas como lidas
            </Button>
          )}
        </div>
        <div className="max-h-[320px] overflow-y-auto">
          {notifications.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma notificação
            </div>
          ) : (
            notifications.map((n) => (
              <div
                key={n.id}
                className={`flex flex-col gap-1 px-4 py-3 border-b last:border-0 cursor-pointer hover:bg-muted/50 transition-colors ${
                  !n.read_at ? "bg-primary/5" : ""
                }`}
                onClick={() => {
                  markAsRead(n.id);
                  setOpen(false);
                }}
              >
                <p className="font-medium text-sm">{n.title}</p>
                {n.body && (
                  <p className="text-xs text-muted-foreground line-clamp-2">
                    {n.body}
                  </p>
                )}
                <p className="text-[10px] text-muted-foreground">
                  {formatDistanceToNow(new Date(n.created_at), {
                    addSuffix: true,
                    locale: ptBR,
                  })}
                </p>
              </div>
            ))
          )}
        </div>
        <div className="border-t px-4 py-2">
          <Link to="/notificacoes" onClick={() => setOpen(false)}>
            <Button variant="ghost" size="sm" className="w-full">
              Ver todas
            </Button>
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
}
