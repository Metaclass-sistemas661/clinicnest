/**
 * DashboardEstetico — Dashboard de métricas estéticas
 * 
 * KPIs: ml preenchimento/mês, U toxina/mês, ticket médio, top procedimentos, top zonas.
 * Usa StatCard do design system + dados simulados (product_usage query quando disponível).
 */
import { useMemo } from "react";
import {
  Sparkles,
  Syringe,
  FlaskConical,
  MapPin,
  TrendingUp,
  DollarSign,
  Users,
  Calendar,
  BarChart3,
} from "lucide-react";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  AESTHETIC_PROCEDURES,
  FACE_ZONES,
  BODY_ZONES,
  type ZoneApplication,
} from "./aestheticConstants";
import { cn } from "@/lib/utils";

/* ─── Types ─── */

export interface AestheticStats {
  toxinaTotalU: number;
  preenchTotalMl: number;
  totalSessions: number;
  totalPatients: number;
  ticketMedio: number;
  totalRevenue: number;
  procedureCounts: Record<string, number>;
  zoneCounts: Record<string, number>;
  monthlyToxinaU: number[];   // últimos 6 meses
  monthlyPreenchMl: number[]; // últimos 6 meses
}

interface DashboardEsteticoProps {
  stats: AestheticStats;
  isLoading?: boolean;
  formatCurrency?: (value: number) => string;
}

const allZones = [...FACE_ZONES, ...BODY_ZONES];

const defaultFormat = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export function DashboardEstetico({
  stats,
  isLoading = false,
  formatCurrency = defaultFormat,
}: DashboardEsteticoProps) {
  // Top 5 procedimentos
  const topProcedures = useMemo(() => {
    return Object.entries(stats.procedureCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        label: AESTHETIC_PROCEDURES.find(p => p.value === key)?.label ?? key,
        color: AESTHETIC_PROCEDURES.find(p => p.value === key)?.color ?? "#6b7280",
        count,
      }));
  }, [stats.procedureCounts]);

  // Top 5 zonas
  const topZones = useMemo(() => {
    return Object.entries(stats.zoneCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5)
      .map(([key, count]) => ({
        key,
        label: allZones.find(z => z.id === key)?.label ?? key,
        count,
      }));
  }, [stats.zoneCounts]);

  // Max for bar width
  const maxProcCount = topProcedures[0]?.count ?? 1;
  const maxZoneCount = topZones[0]?.count ?? 1;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2 mb-2">
        <Sparkles className="h-5 w-5 text-pink-500" />
        <h2 className="text-lg font-bold">Dashboard Estético</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Toxina Botulínica"
          value={`${stats.toxinaTotalU}U`}
          icon={Syringe}
          variant="info"
          description="Total aplicado no mês"
        />
        <StatCard
          title="Preenchimento"
          value={`${stats.preenchTotalMl.toFixed(1)}ml`}
          icon={FlaskConical}
          variant="default"
          description="Volume aplicado no mês"
        />
        <StatCard
          title="Sessões"
          value={stats.totalSessions}
          icon={Calendar}
          description="Procedimentos realizados"
        />
        <StatCard
          title="Pacientes"
          value={stats.totalPatients}
          icon={Users}
          description="Pacientes atendidos"
        />
        <StatCard
          title="Ticket Médio"
          value={formatCurrency(stats.ticketMedio)}
          icon={DollarSign}
          variant="success"
          description="Valor médio por sessão"
        />
        <StatCard
          title="Receita Total"
          value={formatCurrency(stats.totalRevenue)}
          icon={TrendingUp}
          variant="success"
          description="Faturamento estético no mês"
        />
      </div>

      {/* Rankings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Top procedimentos */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
              Top Procedimentos
            </CardTitle>
            <CardDescription className="text-xs">Mais realizados no mês</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topProcedures.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado</p>
            ) : (
              topProcedures.map((proc, i) => (
                <div key={proc.key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}.</span>
                  <div className="w-3 h-3 rounded-full" style={{ backgroundColor: proc.color }} />
                  <span className="text-xs flex-1">{proc.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(proc.count / maxProcCount) * 100}%`,
                          backgroundColor: proc.color,
                        }}
                      />
                    </div>
                    <Badge variant="outline" className="text-[10px] min-w-[32px] justify-center">
                      {proc.count}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Top zonas */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <MapPin className="h-4 w-4 text-muted-foreground" />
              Top Zonas Tratadas
            </CardTitle>
            <CardDescription className="text-xs">Zonas mais frequentes</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {topZones.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">Nenhum dado</p>
            ) : (
              topZones.map((zone, i) => (
                <div key={zone.key} className="flex items-center gap-2">
                  <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}.</span>
                  <span className="text-xs flex-1">{zone.label}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-20 h-2 bg-muted rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-pink-500"
                        style={{ width: `${(zone.count / maxZoneCount) * 100}%` }}
                      />
                    </div>
                    <Badge variant="outline" className="text-[10px] min-w-[32px] justify-center">
                      {zone.count}
                    </Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Mini sparkline bars — monthly trend */}
      {(stats.monthlyToxinaU.length > 0 || stats.monthlyPreenchMl.length > 0) && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Tendência Mensal (últimos 6 meses)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-6">
              {/* Toxina trend */}
              <div>
                <span className="text-xs text-muted-foreground">Toxina (U)</span>
                <div className="flex items-end gap-1 h-16 mt-1">
                  {stats.monthlyToxinaU.map((v, i) => {
                    const max = Math.max(...stats.monthlyToxinaU, 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full bg-violet-500 rounded-t"
                          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 4 : 0 }}
                        />
                        <span className="text-[8px] text-muted-foreground">{v}</span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Preenchimento trend */}
              <div>
                <span className="text-xs text-muted-foreground">Preenchimento (ml)</span>
                <div className="flex items-end gap-1 h-16 mt-1">
                  {stats.monthlyPreenchMl.map((v, i) => {
                    const max = Math.max(...stats.monthlyPreenchMl, 1);
                    return (
                      <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
                        <div
                          className="w-full bg-pink-500 rounded-t"
                          style={{ height: `${(v / max) * 100}%`, minHeight: v > 0 ? 4 : 0 }}
                        />
                        <span className="text-[8px] text-muted-foreground">{v.toFixed(1)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
