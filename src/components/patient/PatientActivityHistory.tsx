import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  History,
  LogIn,
  LogOut,
  UserCog,
  Download,
  Eye,
  FileSignature,
  FileJson,
  Trash2,
  Shield,
  Settings,
  FileText,
  ClipboardList,
  Loader2,
} from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ActivityEntry {
  id: string;
  event_type: string;
  event_description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

const EVENT_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  login: { icon: LogIn, label: "Login", color: "text-green-600" },
  logout: { icon: LogOut, label: "Logout", color: "text-gray-500" },
  profile_update: { icon: UserCog, label: "Perfil atualizado", color: "text-blue-600" },
  exam_download: { icon: Download, label: "Exame baixado", color: "text-purple-600" },
  prescription_view: { icon: Eye, label: "Receita visualizada", color: "text-indigo-600" },
  consent_sign: { icon: FileSignature, label: "Termo assinado", color: "text-teal-600" },
  data_export: { icon: FileJson, label: "Dados exportados", color: "text-blue-600" },
  deletion_request: { icon: Trash2, label: "Exclusão solicitada", color: "text-red-600" },
  mfa_change: { icon: Shield, label: "2FA alterado", color: "text-amber-600" },
  settings_update: { icon: Settings, label: "Configurações", color: "text-gray-600" },
  report_view: { icon: FileText, label: "Laudo visualizado", color: "text-indigo-600" },
  certificate_view: { icon: ClipboardList, label: "Atestado visualizado", color: "text-purple-600" },
};

export function PatientActivityHistory() {
  const [entries, setEntries] = useState<ActivityEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const fetchEntries = useCallback(async (offset = 0) => {
    try {
      const { data, error } = await (apiPatient as any).rpc("get_patient_activity_log", {
        p_limit: 20,
        p_offset: offset,
      });

      if (error) throw error;
      const items = (data as ActivityEntry[]) ?? [];
      setHasMore(items.length === 20);

      if (offset === 0) {
        setEntries(items);
      } else {
        setEntries((prev) => [...prev, ...items]);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
      setIsLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const loadMore = () => {
    setIsLoadingMore(true);
    fetchEntries(entries.length);
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          Histórico de atividade
        </CardTitle>
        <CardDescription className="mt-1">
          Suas ações recentes no portal
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : entries.length === 0 ? (
          <div className="text-center py-8">
            <History className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
            <p className="text-sm text-muted-foreground">
              Nenhuma atividade registrada ainda
            </p>
          </div>
        ) : (
          <div className="space-y-1">
            {entries.map((entry) => {
              const config = EVENT_CONFIG[entry.event_type] ?? {
                icon: History,
                label: entry.event_type,
                color: "text-gray-500",
              };
              const Icon = config.icon;

              return (
                <div
                  key={entry.id}
                  className="flex items-center gap-3 py-2.5 border-b border-border/40 last:border-0"
                >
                  <div className={`flex-shrink-0 ${config.color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                        {config.label}
                      </Badge>
                    </div>
                    {entry.event_description && (
                      <p className="text-xs text-muted-foreground mt-0.5 truncate">
                        {entry.event_description}
                      </p>
                    )}
                  </div>
                  <time className="text-[11px] text-muted-foreground flex-shrink-0 tabular-nums">
                    {format(new Date(entry.created_at), "dd/MM HH:mm", { locale: ptBR })}
                  </time>
                </div>
              );
            })}

            {hasMore && (
              <div className="flex justify-center pt-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs gap-1.5"
                  onClick={loadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <History className="h-3.5 w-3.5" />
                  )}
                  Carregar mais
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
