import { useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Download, UserPlus, Users, RefreshCw, TrendingUp } from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { format, parseISO, startOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ApptRow {
  id: string;
  scheduled_at: string;
  patient_id: string | null;
  status: string;
  clients: { id: string; name: string | null; created_at?: string; referral_source?: string | null } | null;
}

interface Props {
  appts: ApptRow[];
  allAppts: ApptRow[];
  isLoading: boolean;
  periodStart: string;
}

const COLORS = {
  novos: "#10b981",
  retornos: "#3b82f6",
};

const SOURCE_COLORS = ["#10b981", "#3b82f6", "#8b5cf6", "#f59e0b", "#ef4444", "#06b6d4", "#ec4899"];

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

export function TabPacientes({ appts, allAppts, isLoading, periodStart }: Props) {
  const analysis = useMemo(() => {
    const periodStartDate = parseISO(periodStart);
    const patientsInPeriod = new Map<string, { isNew: boolean; visits: number; source: string | null }>();
    const patientFirstVisit = new Map<string, string>();

    allAppts
      .filter((a) => a.status === "completed" && a.patient_id)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .forEach((a) => {
        if (!patientFirstVisit.has(a.patient_id!)) {
          patientFirstVisit.set(a.patient_id!, a.scheduled_at);
        }
      });

    appts
      .filter((a) => a.status === "completed" && a.patient_id)
      .forEach((a) => {
        const patientId = a.patient_id!;
        const firstVisit = patientFirstVisit.get(patientId);
        const isNew = firstVisit ? parseISO(firstVisit) >= periodStartDate : false;
        const source = a.patient?.referral_source || "Não informado";

        const prev = patientsInPeriod.get(patientId);
        if (prev) {
          prev.visits += 1;
        } else {
          patientsInPeriod.set(patientId, { isNew, visits: 1, source });
        }
      });

    let novos = 0;
    let retornos = 0;
    const sourceCount = new Map<string, number>();

    patientsInPeriod.forEach((data) => {
      if (data.isNew) {
        novos += 1;
        const src = data.source || "Não informado";
        sourceCount.set(src, (sourceCount.get(src) || 0) + 1);
      } else {
        retornos += 1;
      }
    });

    const total = novos + retornos;
    const retentionRate = total > 0 ? Math.round((retornos / total) * 100) : 0;

    const sourceData = Array.from(sourceCount.entries())
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);

    return {
      novos,
      retornos,
      total,
      retentionRate,
      sourceData,
      pieData: [
        { name: "Novos", value: novos },
        { name: "Retornos", value: retornos },
      ],
    };
  }, [appts, allAppts, periodStart]);

  const monthlyTrend = useMemo(() => {
    const monthMap = new Map<string, { novos: number; retornos: number }>();
    const patientFirstVisit = new Map<string, string>();

    allAppts
      .filter((a) => a.status === "completed" && a.patient_id)
      .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
      .forEach((a) => {
        if (!patientFirstVisit.has(a.patient_id!)) {
          patientFirstVisit.set(a.patient_id!, a.scheduled_at);
        }
      });

    appts
      .filter((a) => a.status === "completed" && a.patient_id)
      .forEach((a) => {
        const monthKey = format(startOfMonth(parseISO(a.scheduled_at)), "MMM/yy", { locale: ptBR });
        const firstVisit = patientFirstVisit.get(a.patient_id!);
        const apptMonth = startOfMonth(parseISO(a.scheduled_at));
        const isNew = firstVisit ? startOfMonth(parseISO(firstVisit)).getTime() === apptMonth.getTime() : false;

        const prev = monthMap.get(monthKey) ?? { novos: 0, retornos: 0 };
        if (isNew) {
          prev.novos += 1;
        } else {
          prev.retornos += 1;
        }
        monthMap.set(monthKey, prev);
      });

    return Array.from(monthMap.entries()).map(([month, data]) => ({
      month,
      ...data,
    }));
  }, [appts, allAppts]);

  const handleExport = () => {
    downloadCsv(
      [
        { Métrica: "Pacientes Novos", Valor: analysis.novos },
        { Métrica: "Pacientes Retorno", Valor: analysis.retornos },
        { Métrica: "Total Únicos", Valor: analysis.total },
        { Métrica: "Taxa de Retenção (%)", Valor: analysis.retentionRate },
        ...analysis.sourceData.map((s) => ({
          Métrica: `Origem: ${s.name}`,
          Valor: s.value,
        })),
      ],
      "relatorio-pacientes.csv"
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
          Nenhum atendimento no período selecionado
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
                <p className="text-sm font-medium text-muted-foreground">Pacientes Novos</p>
                <p className="text-2xl font-bold text-emerald-600">{analysis.novos}</p>
                <p className="text-xs text-muted-foreground">primeira consulta</p>
              </div>
              <div className="rounded-xl p-3 bg-emerald-50 dark:bg-emerald-950">
                <UserPlus className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Pacientes Retorno</p>
                <p className="text-2xl font-bold text-blue-600">{analysis.retornos}</p>
                <p className="text-xs text-muted-foreground">já atendidos antes</p>
              </div>
              <div className="rounded-xl p-3 bg-blue-50 dark:bg-blue-950">
                <RefreshCw className="h-5 w-5 text-blue-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Total Únicos</p>
                <p className="text-2xl font-bold text-foreground">{analysis.total}</p>
                <p className="text-xs text-muted-foreground">pacientes atendidos</p>
              </div>
              <div className="rounded-xl p-3 bg-violet-50 dark:bg-violet-950">
                <Users className="h-5 w-5 text-violet-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-muted-foreground">Taxa de Retenção</p>
                <p className="text-2xl font-bold text-foreground">{analysis.retentionRate}%</p>
                <p className="text-xs text-muted-foreground">pacientes que voltam</p>
              </div>
              <div className="rounded-xl p-3 bg-amber-50 dark:bg-amber-950">
                <TrendingUp className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Gráfico de Pizza */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base font-semibold">Novos vs Retornos</CardTitle>
            <Button variant="outline" size="sm" onClick={handleExport} className="gap-2">
              <Download className="h-4 w-4" /> Exportar
            </Button>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie
                  data={analysis.pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={90}
                  paddingAngle={5}
                  dataKey="value"
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                >
                  <Cell fill={COLORS.novos} />
                  <Cell fill={COLORS.retornos} />
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold">{data.name}</p>
                        <p className="text-muted-foreground">{data.value} pacientes</p>
                      </div>
                    );
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Origem dos Pacientes Novos */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Origem dos Pacientes Novos</CardTitle>
          </CardHeader>
          <CardContent>
            {analysis.sourceData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhum dado de origem disponível
              </p>
            ) : (
              <div className="space-y-3">
                {analysis.sourceData.slice(0, 6).map((source, i) => {
                  const pct = analysis.novos > 0 ? Math.round((source.value / analysis.novos) * 100) : 0;
                  return (
                    <div key={source.name} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="h-3 w-3 rounded-full"
                            style={{ backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length] }}
                          />
                          <span className="font-medium">{source.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">{source.value}</Badge>
                          <span className="text-muted-foreground text-xs">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${pct}%`,
                            backgroundColor: SOURCE_COLORS[i % SOURCE_COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Tendência Mensal */}
      {monthlyTrend.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-semibold">Tendência Mensal</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={monthlyTrend}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    return (
                      <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
                        <p className="font-semibold mb-1">{label}</p>
                        {payload.map((p) => (
                          <p key={p.name} className="text-muted-foreground">
                            {p.name === "novos" ? "Novos" : "Retornos"}: {p.value}
                          </p>
                        ))}
                      </div>
                    );
                  }}
                />
                <Bar dataKey="novos" name="novos" fill={COLORS.novos} radius={[4, 4, 0, 0]} />
                <Bar dataKey="retornos" name="retornos" fill={COLORS.retornos} radius={[4, 4, 0, 0]} />
                <Legend
                  formatter={(value) => (value === "novos" ? "Novos" : "Retornos")}
                />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
