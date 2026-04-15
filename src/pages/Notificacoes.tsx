import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Check, CheckCheck } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string | null;
  read_at: string | null;
  created_at: string;
}

export default function Notificacoes() {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchNotifications = async () => {
    if (!user?.id) return;
    const { data } = await api
      .from("notifications")
      .select("id, type, title, body, read_at, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });
    setNotifications((data || []) as Notification[]);
    setIsLoading(false);
  };

  useEffect(() => {
    fetchNotifications();
  }, [user?.id]);

  const markAsRead = async (id: string) => {
    if (!user?.id) return;
    await api
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("id", id)
      .eq("user_id", user.id);
    fetchNotifications();
  };

  const markAllRead = async () => {
    if (!user?.id) return;
    await api
      .from("notifications")
      .update({ read_at: new Date().toISOString() })
      .eq("user_id", user.id)
      .is("read_at", null);
    fetchNotifications();
  };

  const unreadCount = notifications.filter((n) => !n.read_at).length;

  return (
    <MainLayout title="Notificações" subtitle="Suas notificações">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Bell className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Notificações</CardTitle>
                  <CardDescription>
                    {unreadCount > 0
                      ? `${unreadCount} não lida(s)`
                      : "Todas lidas"}
                  </CardDescription>
                </div>
              </div>
              {unreadCount > 0 && (
                <Button variant="outline" size="sm" onClick={markAllRead} data-tour="notifications-mark-all-read">
                  <CheckCheck className="h-4 w-4 mr-2" />
                  Marcar todas como lidas
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="py-12 text-center text-muted-foreground">
                Carregando...
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-12 text-center text-muted-foreground">
                <Bell className="h-12 w-12 mx-auto mb-4 text-muted-foreground/50" />
                <p>Nenhuma notificação ainda.</p>
                <p className="text-sm mt-2">
                  Você receberá alertas de agendamentos, metas e comissões.
                </p>
              </div>
            ) : (
              <ul className="space-y-2">
                {notifications.map((n) => (
                  <li
                    key={n.id}
                    className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${
                      !n.read_at ? "bg-primary/5 border-primary/20" : ""
                    }`}
                  >
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm">{n.title}</p>
                      {n.body && (
                        <p className="text-sm text-muted-foreground mt-0.5">
                          {n.body}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(n.created_at), "dd/MM/yyyy 'às' HH:mm", {
                          locale: ptBR,
                        })}
                      </p>
                    </div>
                    {!n.read_at && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="shrink-0"
                        onClick={() => markAsRead(n.id)}
                        title="Marcar como lida"
                        data-tour="notifications-mark-read"
                      >
                        <Check className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
