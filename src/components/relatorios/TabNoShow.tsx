import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, AlertTriangle, Calendar, Clock, Users } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { format, parseISO, getDay, getHours } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApptRow {
  id: string;
  scheduled_at: string;
  client_id: string | null;
  professional_id: string | null;
  status: string;
  profiles: { full_name: string | null } | null;
  clients: { name: string | null } | null;
}

interface Props {
  appts: ApptRow[];
  isLoading: boolean;
}

const COLORS = ["#ef4444", "#f59e0b", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#06b6d4"];
const DAY_NAMES = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

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

export function TabNoShow({ appts, isLoading }: Props) {
  const analysis = useMemo(() => {
    const total = appts.length;
    const noShows = appts.filter((a) => a.status === "no_show");
    const noShowCount = noShows.length;
    const noShowRate = total > 0 ? Math.round((noShowCount / total) * 100) : 0;

    const byDayOfWeek = new Map<number, { total: number; noShow: number }>();
    for (let i = 0; i < 7; i++) {
      byDayOfWeek.set(i, { total: 0, noShow: 0 });
    }

    const byHour = new Map<number, { total: number; noShow: number }>();
    for (let h = 7; h <= 20; h++) {
      byHour.set(h, { total: 0, noShow: 0 });
    }

    const byProfessional = new Map<string, { name: string; total: number; noShow: number }>();

    appts.forEach((a) => {
      const date = parseISO(a.scheduled_at);
      const dayOfWeek = getDay(date);
      const hour = getHours(date);

      const dayData = byDayOfWeek.get(dayOfWeek)!;
      dayData.total += 1;
      if (a.status === "no_show") dayData.noShow += 1;

      if (hour >= 7 && hour <= 20) {
        const hourData = byHour.get(hour)!;
        hourData.total += 1;
        if (a.status === "no_show") hourData.noShow += 1;
      }

      if (a.professional_id) {
        const profName = a.profiles?.full_name ?? "Desconhecido";
        const profData = byProfessional.get(a.professional_id) ?? {
          name: profName,
          total: 0,
          noShow: 0,
        };
        profData.total += 1;
        if (a.status === "no_show") profData.noShow += 1;
        byProfessional.set(a.professional_id, profData);
      }
    });

    const dayOfWeekData = Array.from(byDayOfWeek.entries())
      .map(([day, data]) => ({
        day: DAY_NAMES[day],
        dayNum: day,
        total: data.total,
        noShow: data.noShow,
        rate: data.total > 0 ? Math.round((data.noShow / data.total) * 100) : 0,
      }))
      .sort((a, b) => {
        const order = [1, 2, 3, 4, 5, 6, 0];
        return order.indexOf(a.dayNum) - order.indexOf(b.dayNum);
      });

    const hourData = Array.from(byHour.entries())
      .filter(([_, data]) => data.total > 0)
      .map(([hour, data]) => ({
        hour: `${hour}h`,
        hourNum: hour,
        total: data.total,
        noShow: data.noShow,
        rate: data.total > 0 ? Math.round((data.noShow / data.total) * 100) : 0,
      }));

    const professionalData = Array.from(byProfessional.values())
      .map((p) => ({
        ...p,
        rate: p.total > 0 ? Math.round((p.noShow / p.total) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    const worstDay = dayOfWeekData.reduce((max, d) => (d.rate > max.rate ? d : max), dayOfWeekData[0]);
    const worstHour = hourData.reduce((max, h) => (h.rate > max.rate ? h : max), hourData[0] ?? { hour: "-", rate: 0 });

    return {
      total,
      noShowCount,
      noShowRate,
      dayOfWeekData,
      hourData,
      professionalData,
      worstDay,
      worstHour,
      noShows,
    };
  }, [appts]);

  const handleExport = () => {
    downloadCsv(
      [
        { Métrica: "Total de Agendamentos", Valor: analysis.total },
        { Métrica: "No-Shows", Valor: analysis.noShowCount },
        { Métrica: "Taxa de No-Show (%)", Valor: analysis.noShowRate },
        { Métrica: "Pior Dia da Semana", Valor: `${analysis.worstDay?.day} (${analysis.worstDay?.rate}%)` },
        { Métrica: "Pior Horário", Valor: `${analysis.worstHour?.hour} (${analysis.worstHour?.rate}%)` },
        ...analysis.professionalData.map((p) => ({
          Métrica: `Profissional: ${p.name}`,
          Valor: `${p.noShow}/${p.total} (${p.rate}%)`,
        })),
      ],
      "relatorio-no-show.csv"
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

  if (analysis.total === 0) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
          Nenhum agendamento no período selecionado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Taxa de No-Show</p>
                <p className={`text-2xl font-bold ${analysis.noShowRate > 15 ? "text-red-600" : analysis.noShowRate > 10 ? "text-amber-600" : "text-emerald-600"}`}>
                  {analysis.noShowRate}%
                </p>
                <p className="text-xs text-muted-foreground">
                  {analysis.noShowRate <= 10 ? "Excelente" : analysis.noShowRate <= 15 ? "Atenção" : "Crítico"}
                </p>
              </div>
              <div className={`rounded-xl p-3 ${analysis.noShowRate > 15 ? "bg-red-50 dark:bg-red-950" : "bg-amber-50 dark:bg-amber-950"}`}>
                <AlertTriangle className={`h-5 w-5 ${analysis.noShowRate > 15 ? "text-red-600" : "text-amber-600"}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total No-Shows</p>
                <p className="text-2xl font-bold text-foreground">{analysis.noShowCount}</p>
                <p className="text-xs text-muted-foreground">de {analysis.total} agendamentos</p>
              </div>
              <div className="rounded-xl p-3 bg-red-50 dark:bg-red-950">
                <Calendar className="h-5 w-5 text-red-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Pior Dia</p>
                <p className="text-2xl font-bold text-foreground">{analysis.worstDay?.day || "-"}</p>
                <p className="text-xs text-muted-foreground">{analysis.worstDay?.rate || 0}% de no-show</p>
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
                <p className="text-sm font-medium text-muted-foreground">Pior Horário</p>
                <p className="text-2xl font-bold text-foreground">{analysis.worstHour?.hour || "-"}</p>
                <p className="text-xs text-muted-foreground">{analysis.worstHour?.rate || 0}% de no-show</p>
              </div>
              <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Por Dia da Semana */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">No-Show por Dia da Semana</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analysis.dayOfWeekData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold">{label}</p>
                        <p className="text-muted-foreground">Taxa: {data.rate}%</p>
                        <p className="text-muted-foreground">No-shows: {data.noShow}/{data.total}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" name="Taxa %" radius={[4, 4, 0, 0]}>
                  {analysis.dayOfWeekData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.rate > 15 ? "#ef4444" : entry.rate > 10 ? "#f59e0b" : "#10b981"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Por Horário */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">No-Show por Horário</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={analysis.hourData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="hour" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 12 }} unit="%" />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold">{label}</p>
                        <p className="text-muted-foreground">Taxa: {data.rate}%</p>
                        <p className="text-muted-foreground">No-shows: {data.noShow}/{data.total}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="rate" name="Taxa %" radius={[4, 4, 0, 0]}>
                  {analysis.hourData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.rate > 15 ? "#ef4444" : entry.rate > 10 ? "#f59e0b" : "#10b981"}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Por Profissional */}
      {analysis.professionalData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Users className="h-4 w-4" />
              No-Show por Profissional
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {analysis.professionalData.slice(0, 10).map((p, i) => (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                      {p.name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="font-medium text-sm">{p.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {p.noShow} no-shows de {p.total} agendamentos
                      </p>
                    </div>
                  </div>
                  <Badge
                    variant={p.rate > 15 ? "destructive" : p.rate > 10 ? "secondary" : "default"}
                    className="text-sm"
                  >
                    {p.rate}%
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Dicas */}
      {analysis.noShowRate > 10 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardHeader>
            <CardTitle className="text-base font-semibold flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="h-4 w-4" />
              Dicas para Reduzir No-Shows
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-amber-800 dark:text-amber-300 space-y-2">
            <p>• <strong>Confirmação automática:</strong> Ative lembretes por WhatsApp 24h e 2h antes.</p>
            <p>• <strong>Política de cancelamento:</strong> Implemente taxa para no-shows recorrentes.</p>
            <p>• <strong>Overbooking estratégico:</strong> Considere agendar 5-10% a mais nos horários críticos ({analysis.worstHour?.hour}).</p>
            <p>• <strong>Lista de espera:</strong> Mantenha pacientes em espera para preencher cancelamentos.</p>
            {analysis.worstDay && (
              <p>• <strong>Atenção especial:</strong> {analysis.worstDay.day} tem a maior taxa de no-show ({analysis.worstDay.rate}%).</p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
