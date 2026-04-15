/**
 * DentalDashboard — KPIs e métricas do módulo odontológico (F14)
 * 
 * Exibe estatísticas de dentes tratados, planos pendentes, condições mais frequentes,
 * periogramas realizados e dentes urgentes.
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import {
  Smile, ClipboardList, Activity, AlertTriangle, TrendingUp,
  BarChart3, Calendar,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { TOOTH_CONDITIONS } from "./odontogramConstants";

interface DashboardData {
  teeth_treated: number;
  odontograms_created: number;
  periograms_created: number;
  plans_pending: number;
  plans_in_progress: number;
  plans_completed: number;
  top_conditions: Array<{ condition: string; count: number }>;
  urgent_teeth: number;
}

export function DentalDashboard() {
  const { profile } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    loadDashboard();
  }, [profile?.tenant_id]);

  const loadDashboard = async () => {
    try {
      const { data: result, error } = await (api.rpc as any)("get_dental_dashboard", {
        p_tenant_id: profile!.tenant_id,
      });
      if (error) throw error;
      setData(result as DashboardData);
    } catch (err) {
      logger.error("Erro ao carregar dashboard odontológico:", err);
    } finally {
      setLoading(false);
    }
  };

  const getConditionLabel = (condition: string) =>
    TOOTH_CONDITIONS.find(c => c.value === condition)?.label ?? condition;

  const getConditionColor = (condition: string) =>
    TOOTH_CONDITIONS.find(c => c.value === condition)?.color ?? "#6b7280";

  if (loading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Spinner size="sm" />
          <span className="text-muted-foreground">Carregando dashboard...</span>
        </CardContent>
      </Card>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Smile className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-2xl font-bold">{data.teeth_treated}</p>
            <p className="text-xs text-muted-foreground">Dentes Tratados</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <BarChart3 className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-2xl font-bold">{data.odontograms_created}</p>
            <p className="text-xs text-muted-foreground">Odontogramas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Activity className="h-5 w-5 mx-auto mb-1 text-purple-600" />
            <p className="text-2xl font-bold">{data.periograms_created}</p>
            <p className="text-xs text-muted-foreground">Periogramas</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <ClipboardList className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-2xl font-bold">{data.plans_pending}</p>
            <p className="text-xs text-muted-foreground">Planos Pendentes</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <TrendingUp className="h-5 w-5 mx-auto mb-1 text-emerald-600" />
            <p className="text-2xl font-bold">{data.plans_completed}</p>
            <p className="text-xs text-muted-foreground">Planos Concluídos</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <AlertTriangle className="h-5 w-5 mx-auto mb-1 text-red-600" />
            <p className="text-2xl font-bold text-red-600">{data.urgent_teeth}</p>
            <p className="text-xs text-muted-foreground">Dentes Urgentes</p>
          </CardContent>
        </Card>
      </div>

      {/* Condições mais frequentes */}
      {data.top_conditions.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Condições Mais Frequentes (últimos 30 dias)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data.top_conditions.map((item, idx) => {
                const maxCount = data.top_conditions[0]?.count || 1;
                const pct = (item.count / maxCount) * 100;
                return (
                  <div key={idx} className="flex items-center gap-3">
                    <span className="text-sm w-40 truncate">{getConditionLabel(item.condition)}</span>
                    <div className="flex-1 h-5 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: getConditionColor(item.condition) }}
                      />
                    </div>
                    <Badge variant="outline" className="text-xs min-w-[40px] text-center">
                      {item.count}
                    </Badge>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
