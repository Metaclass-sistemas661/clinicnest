import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Download, Clock, Users, TrendingUp, Calendar } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface ApptRow {
  id: string;
  scheduled_at: string;
  started_at?: string | null;
  completed_at?: string | null;
  client_id: string | null;
  professional_id: string | null;
  status: string;
  services: { id: string; name: string; price: number; duration_minutes?: number } | null;
  profiles: { full_name: string | null } | null;
}

interface ProdutividadeData {
  professional_id: string;
  professional_name: string;
  total_slots: number;
  used_slots: number;
  occupancy_rate: number;
  avg_duration_minutes: number;
  total_atendimentos: number;
  completed: number;
  cancelled: number;
  no_show: number;
}

interface Props {
  appts: ApptRow[];
  isLoading: boolean;
  availabilityData?: { professional_id: string; total_minutes: number }[];
}

const COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4"];

function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) return;
  const cols = Object.keys(rows[0]);
  const bom = "\uFEFF";
  const header = cols.join(";");
  const body = rows
    .map((r) => cols.map((c) => `"${String(r[c] ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n");
  const blob = new Blob([bom + header + "\n" + body], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function TabProdutividade({ appts, isLoading }: Props) {
  const produtividadeData = useMemo(() => {
    const map = new Map<string, ProdutividadeData>();

    appts.forEach((a) => {
      const pid = a.professional_id;
      if (!pid) return;

      const name = a.profiles?.full_name ?? "Desconhecido";
      const prev = map.get(pid) ?? {
        professional_id: pid,
        professional_name: name,
        total_slots: 0,
        used_slots: 0,
        occupancy_rate: 0,
        avg_duration_minutes: 0,
        total_atendimentos: 0,
        completed: 0,
        cancelled: 0,
        no_show: 0,
      };

      prev.total_atendimentos += 1;

      if (a.status === "completed") {
        prev.completed += 1;
        prev.used_slots += 1;
        if (a.services?.duration_minutes) {
          prev.avg_duration_minutes += a.services.duration_minutes;
        }
      } else if (a.status === "cancelled") {
        prev.cancelled += 1;
      } else if (a.status === "no_show") {
        prev.no_show += 1;
      }

      map.set(pid, prev);
    });

    return Array.from(map.values())
      .map((p) => ({
        ...p,
        avg_duration_minutes: p.completed > 0 ? Math.round(p.avg_duration_minutes / p.completed) : 0,
        occupancy_rate: p.total_atendimentos > 0 
          ? Math.round((p.completed / p.total_atendimentos) * 100) 
          : 0,
      }))
      .sort((a, b) => b.completed - a.completed);
  }, [appts]);

  const totals = useMemo(() => {
    return produtividadeData.reduce(
      (acc, p) => ({
        total: acc.total + p.total_atendimentos,
        completed: acc.completed + p.completed,
        cancelled: acc.cancelled + p.cancelled,
        no_show: acc.no_show + p.no_show,
        avgDuration: acc.avgDuration + p.avg_duration_minutes,
      }),
      { total: 0, completed: 0, cancelled: 0, no_show: 0, avgDuration: 0 }
    );
  }, [produtividadeData]);

  const avgOccupancy = produtividadeData.length > 0
    ? Math.round(produtividadeData.reduce((s, p) => s + p.occupancy_rate, 0) / produtividadeData.length)
    : 0;

  const avgDuration = produtividadeData.length > 0
    ? Math.round(totals.avgDuration / produtividadeData.length)
    : 0;

  const handleExport = () => {
    downloadCsv(
      produtividadeData.map((p, i) => ({
        Posição: i + 1,
        Profissional: p.professional_name,
        "Total Agendamentos": p.total_atendimentos,
        Concluídos: p.completed,
        Cancelados: p.cancelled,
        "No-Show": p.no_show,
        "Taxa Ocupação (%)": p.occupancy_rate,
        "Duração Média (min)": p.avg_duration_minutes,
      })),
      "produtividade-profissionais.csv"
    );
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!produtividadeData.length) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
          Nenhum atendimento no período selecionado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs de Produtividade */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Taxa de Ocupação</p>
                <p className="text-2xl font-bold text-foreground">{avgOccupancy}%</p>
                <p className="text-xs text-muted-foreground">média geral</p>
              </div>
              <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Tempo Médio</p>
                <p className="text-2xl font-bold text-foreground">{avgDuration} min</p>
                <p className="text-xs text-muted-foreground">por atendimento</p>
              </div>
              <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Concluídos</p>
                <p className="text-2xl font-bold text-foreground">{totals.completed}</p>
                <p className="text-xs text-muted-foreground">de {totals.total} agendados</p>
              </div>
              <div className="rounded-xl p-3 bg-violet-50 dark:bg-violet-950">
                <Calendar className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Profissionais</p>
                <p className="text-2xl font-bold text-foreground">{produtividadeData.length}</p>
                <p className="text-xs text-muted-foreground">ativos no período</p>
              </div>
              <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950">
                <Users className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Gráfico de Barras */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base font-semibold">Atendimentos por Profissional</CardTitle>
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
            <Download className="h-4 w-4" /> Exportar
          </Button>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={produtividadeData.slice(0, 10)} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis type="number" tick={{ fontSize: 12 }} />
              <YAxis 
                type="category" 
                dataKey="professional_name" 
                tick={{ fontSize: 12 }} 
                width={100}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const data = payload[0].payload as ProdutividadeData;
                  return (
                    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
                      <p className="font-semibold">{data.professional_name}</p>
                      <p className="text-muted-foreground">Concluídos: {data.completed}</p>
                      <p className="text-muted-foreground">Cancelados: {data.cancelled}</p>
                      <p className="text-muted-foreground">No-show: {data.no_show}</p>
                      <p className="text-muted-foreground">Ocupação: {data.occupancy_rate}%</p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="completed" name="Concluídos" radius={[0, 4, 4, 0]}>
                {produtividadeData.slice(0, 10).map((_, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Tabela Detalhada */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Detalhamento por Profissional</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {produtividadeData.map((p, i) => (
              <div key={p.professional_id} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-muted-foreground w-6">{i + 1}º</span>
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {p.professional_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.professional_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.completed} concluídos · {p.avg_duration_minutes} min/atend.
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <p className="text-sm font-semibold">{p.occupancy_rate}%</p>
                      <p className="text-xs text-muted-foreground">ocupação</p>
                    </div>
                    <div className="flex gap-1">
                      {p.cancelled > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {p.cancelled} canc.
                        </Badge>
                      )}
                      {p.no_show > 0 && (
                        <Badge variant="destructive" className="text-xs">
                          {p.no_show} no-show
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <Progress value={p.occupancy_rate} className="h-2" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
