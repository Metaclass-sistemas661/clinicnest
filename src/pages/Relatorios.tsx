import { useState, useMemo, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  BarChart3,
  Users,
  Scissors,
  UserCog,
  Download,
  TrendingUp,
  Calendar,
  DollarSign,
  MessageCircle,
  Loader2,
} from "lucide-react";
import { format, subDays, startOfWeek, startOfMonth, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Types ────────────────────────────────────────────────────────────────────

type Period = "7d" | "30d" | "90d" | "365d";
type InactiveCutoff = "30" | "60" | "90" | "180";

interface ApptRow {
  id: string;
  scheduled_at: string;
  client_id: string | null;
  professional_id: string | null;
  services: { id: string; name: string; price: number } | null;
  profiles: { full_name: string | null } | null;
  clients: { id: string; name: string | null; phone: string | null } | null;
}

interface ChartPoint {
  label: string;
  revenue: number;
  count: number;
}

interface ServiceRow {
  id: string;
  name: string;
  count: number;
  revenue: number;
}

interface ProfRow {
  id: string;
  name: string;
  count: number;
  revenue: number;
  clients: number;
}

interface InactiveClient {
  id: string;
  name: string | null;
  phone: string | null;
  email: string | null;
  lastVisit: string | null;
  visitCount: number;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const PERIOD_LABELS: Record<Period, string> = {
  "7d": "7 dias",
  "30d": "30 dias",
  "90d": "90 dias",
  "365d": "1 ano",
};

function getPeriodDates(period: Period) {
  const end = new Date();
  const days = { "7d": 7, "30d": 30, "90d": 90, "365d": 365 }[period];
  const start = subDays(end, days);
  return { start: start.toISOString(), end: end.toISOString() };
}

function fmtBRL(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function groupByDay(appts: ApptRow[]): ChartPoint[] {
  const map = new Map<string, { revenue: number; count: number }>();
  appts.forEach((a) => {
    const day = format(parseISO(a.scheduled_at), "dd/MM", { locale: ptBR });
    const prev = map.get(day) ?? { revenue: 0, count: 0 };
    map.set(day, { revenue: prev.revenue + (a.services?.price ?? 0), count: prev.count + 1 });
  });
  return Array.from(map, ([label, v]) => ({ label, ...v }));
}

function groupByWeek(appts: ApptRow[]): ChartPoint[] {
  const map = new Map<string, { revenue: number; count: number }>();
  appts.forEach((a) => {
    const wStart = startOfWeek(parseISO(a.scheduled_at), { weekStartsOn: 1 });
    const label = format(wStart, "dd/MM", { locale: ptBR });
    const prev = map.get(label) ?? { revenue: 0, count: 0 };
    map.set(label, { revenue: prev.revenue + (a.services?.price ?? 0), count: prev.count + 1 });
  });
  return Array.from(map, ([label, v]) => ({ label, ...v }));
}

function groupByMonth(appts: ApptRow[]): ChartPoint[] {
  const map = new Map<string, { revenue: number; count: number }>();
  appts.forEach((a) => {
    const mStart = startOfMonth(parseISO(a.scheduled_at));
    const label = format(mStart, "MMM/yy", { locale: ptBR });
    const prev = map.get(label) ?? { revenue: 0, count: 0 };
    map.set(label, { revenue: prev.revenue + (a.services?.price ?? 0), count: prev.count + 1 });
  });
  return Array.from(map, ([label, v]) => ({ label, ...v }));
}

function buildChartData(appts: ApptRow[], period: Period): ChartPoint[] {
  if (period === "7d") return groupByDay(appts);
  if (period === "365d") return groupByMonth(appts);
  return groupByWeek(appts);
}

function buildServiceRanking(appts: ApptRow[]): ServiceRow[] {
  const map = new Map<string, ServiceRow>();
  appts.forEach((a) => {
    if (!a.services) return;
    const s = a.services;
    const prev = map.get(s.id) ?? { id: s.id, name: s.name, count: 0, revenue: 0 };
    map.set(s.id, { ...prev, count: prev.count + 1, revenue: prev.revenue + s.price });
  });
  return Array.from(map.values()).sort((a, b) => b.revenue - a.revenue);
}

function buildProfRanking(appts: ApptRow[]): ProfRow[] {
  const map = new Map<string, ProfRow & { clientSet: Set<string> }>();
  appts.forEach((a) => {
    const pid = a.professional_id;
    if (!pid) return;
    const name = a.profiles?.full_name ?? "Desconhecido";
    const prev = map.get(pid) ?? {
      id: pid, name, count: 0, revenue: 0, clients: 0, clientSet: new Set<string>(),
    };
    if (a.client_id) prev.clientSet.add(a.client_id);
    map.set(pid, {
      ...prev,
      count: prev.count + 1,
      revenue: prev.revenue + (a.services?.price ?? 0),
    });
  });
  return Array.from(map.values())
    .map(({ clientSet, ...rest }) => ({ ...rest, clients: clientSet.size }))
    .sort((a, b) => b.revenue - a.revenue);
}

// ─── CSV helper ───────────────────────────────────────────────────────────────

function downloadCsv(rows: Record<string, string | number>[], filename: string) {
  if (!rows.length) { toast.error("Nenhum dado para exportar"); return; }
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

// ─── Custom Tooltip ───────────────────────────────────────────────────────────

function ChartTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number; name: string }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card px-3 py-2 shadow-lg text-sm">
      <p className="font-semibold text-foreground mb-1">{label}</p>
      {payload.map((p) => (
        <p key={p.name} className="text-muted-foreground">
          {p.name === "revenue" ? fmtBRL(p.value) : `${p.value} atend.`}
        </p>
      ))}
    </div>
  );
}

// ─── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({ icon: Icon, label, value, sub, color }: {
  icon: React.ElementType;
  label: string;
  value: string;
  sub?: string;
  color?: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{label}</p>
            <p className="text-2xl font-bold text-foreground">{value}</p>
            {sub && <p className="text-xs text-muted-foreground">{sub}</p>}
          </div>
          <div className={`rounded-xl p-3 ${color ?? "bg-primary/10"}`}>
            <Icon className="h-5 w-5 text-primary" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Visão Geral Tab ──────────────────────────────────────────────────────────

function TabVisaoGeral({ appts, period, isLoading }: { appts: ApptRow[]; period: Period; isLoading: boolean }) {
  const chartData = useMemo(() => buildChartData(appts, period), [appts, period]);

  const totalRevenue = useMemo(() => appts.reduce((s, a) => s + (a.services?.price ?? 0), 0), [appts]);
  const totalAppts = appts.length;
  const uniqueClients = useMemo(() => new Set(appts.map((a) => a.client_id).filter(Boolean)).size, [appts]);
  const avgTicket = totalAppts > 0 ? totalRevenue / totalAppts : 0;

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard icon={DollarSign} label="Receita Total" value={fmtBRL(totalRevenue)} sub={`em ${PERIOD_LABELS[period]}`} />
        <KpiCard icon={Calendar} label="Atendimentos" value={String(totalAppts)} sub="concluídos" color="bg-blue-50 dark:bg-blue-950" />
        <KpiCard icon={Users} label="Clientes Únicos" value={String(uniqueClients)} sub="no período" color="bg-green-50 dark:bg-green-950" />
        <KpiCard icon={TrendingUp} label="Ticket Médio" value={fmtBRL(avgTicket)} sub="por atendimento" color="bg-amber-50 dark:bg-amber-950" />
      </div>

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base font-semibold">Receita por Período</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex h-64 items-center justify-center">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : chartData.length === 0 ? (
            <div className="flex h-64 items-center justify-center text-muted-foreground text-sm">
              Nenhum atendimento no período
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={chartData} margin={{ top: 4, right: 8, left: 8, bottom: 4 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="label" tick={{ fontSize: 12 }} className="text-muted-foreground" />
                <YAxis
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                  tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`}
                  width={52}
                />
                <Tooltip content={<ChartTooltip />} />
                <Bar dataKey="revenue" name="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={48} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Clientes Inativos Tab ────────────────────────────────────────────────────

function TabClientesInativos({ tenantId, period }: { tenantId: string; period: Period }) {
  const [cutoff, setCutoff] = useState<InactiveCutoff>("60");
  const [loaded, setLoaded] = useState(false);

  const { data: inactiveClients = [], isFetching } = useQuery({
    queryKey: ["relatorios-inativos", tenantId, cutoff],
    enabled: loaded,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<InactiveClient[]> => {
      const db = supabase as unknown as {
        from: (t: string) => ReturnType<typeof supabase.from>;
      };

      const cutoffDate = subDays(new Date(), Number(cutoff));
      const windowDate = subDays(new Date(), 180);

      // Appointments in the last 180 days → active client IDs
      const { data: recentAppts } = await (db as any)
        .from("appointments")
        .select("client_id, scheduled_at")
        .eq("tenant_id", tenantId)
        .eq("status", "completed")
        .gte("scheduled_at", windowDate.toISOString());

      const activeIds = new Set<string>(
        (recentAppts ?? [])
          .filter((a: { client_id: string | null; scheduled_at: string }) => {
            if (!a.client_id) return false;
            return parseISO(a.scheduled_at) >= cutoffDate;
          })
          .map((a: { client_id: string }) => a.client_id)
      );

      // All visits per client in window (for lastVisit + visitCount)
      const visitMap = new Map<string, { lastVisit: string; count: number }>();
      (recentAppts ?? []).forEach((a: { client_id: string | null; scheduled_at: string }) => {
        if (!a.client_id) return;
        const prev = visitMap.get(a.client_id);
        if (!prev || a.scheduled_at > prev.lastVisit) {
          visitMap.set(a.client_id, { lastVisit: a.scheduled_at, count: (prev?.count ?? 0) + 1 });
        } else {
          visitMap.set(a.client_id, { ...prev, count: prev.count + 1 });
        }
      });

      // All clients
      const { data: allClients } = await (supabase as any)
        .from("clients")
        .select("id, name, phone, email")
        .eq("tenant_id", tenantId)
        .eq("is_active", true);

      const result: InactiveClient[] = (allClients ?? [])
        .filter((c: { id: string }) => !activeIds.has(c.id))
        .map((c: { id: string; name: string | null; phone: string | null; email: string | null }) => {
          const visit = visitMap.get(c.id);
          return {
            id: c.id,
            name: c.name,
            phone: c.phone,
            email: c.email,
            lastVisit: visit?.lastVisit ?? null,
            visitCount: visit?.count ?? 0,
          };
        })
        .sort((a: InactiveClient, b: InactiveClient) => {
          if (!a.lastVisit && !b.lastVisit) return 0;
          if (!a.lastVisit) return 1;
          if (!b.lastVisit) return -1;
          return a.lastVisit > b.lastVisit ? 1 : -1;
        });

      return result;
    },
  });

  const handleExport = useCallback(() => {
    downloadCsv(
      inactiveClients.map((c) => ({
        Nome: c.name ?? "",
        Telefone: c.phone ?? "",
        Email: c.email ?? "",
        "Última Visita": c.lastVisit
          ? format(parseISO(c.lastVisit), "dd/MM/yyyy", { locale: ptBR })
          : "Nunca",
        "Total Visitas": c.visitCount,
      })),
      `clientes-inativos-${cutoff}d.csv`
    );
  }, [inactiveClients, cutoff]);

  const whatsappLink = (phone: string | null) => {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, "");
    const num = digits.startsWith("55") ? digits : `55${digits}`;
    return `https://wa.me/${num}`;
  };

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground whitespace-nowrap">Sem visita há mais de</span>
          <Select value={cutoff} onValueChange={(v) => { setCutoff(v as InactiveCutoff); setLoaded(true); }}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="30">30 dias</SelectItem>
              <SelectItem value="60">60 dias</SelectItem>
              <SelectItem value="90">90 dias</SelectItem>
              <SelectItem value="180">180 dias</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {!loaded ? (
          <Button onClick={() => setLoaded(true)} className="gap-2">
            <Users className="h-4 w-4" /> Carregar Relatório
          </Button>
        ) : (
          <Button variant="outline" onClick={handleExport} disabled={isFetching || !inactiveClients.length} className="gap-2 sm:ml-auto">
            <Download className="h-4 w-4" /> Exportar CSV
          </Button>
        )}
      </div>

      {/* Table */}
      {!loaded && (
        <Card>
          <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
            Selecione o período de inatividade e clique em Carregar
          </CardContent>
        </Card>
      )}

      {loaded && isFetching && (
        <Card>
          <CardContent className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span>Identificando clientes inativos…</span>
          </CardContent>
        </Card>
      )}

      {loaded && !isFetching && (
        <>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-sm">
              {inactiveClients.length} cliente{inactiveClients.length !== 1 ? "s" : ""} inativo{inactiveClients.length !== 1 ? "s" : ""}
            </Badge>
            {inactiveClients.length > 0 && (
              <span className="text-xs text-muted-foreground">sem visita há mais de {cutoff} dias</span>
            )}
          </div>

          {inactiveClients.length === 0 ? (
            <Card>
              <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
                Nenhum cliente inativo no período selecionado.
              </CardContent>
            </Card>
          ) : (
            <Card>
              <div className="divide-y">
                {inactiveClients.map((c) => {
                  const wa = whatsappLink(c.phone);
                  return (
                    <div key={c.id} className="flex items-center justify-between px-5 py-3 hover:bg-muted/40 transition-colors">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                          {c.name?.charAt(0)?.toUpperCase() ?? "?"}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{c.name ?? "—"}</p>
                          <p className="text-xs text-muted-foreground">
                            {c.lastVisit
                              ? `Última visita: ${format(parseISO(c.lastVisit), "dd/MM/yyyy", { locale: ptBR })}`
                              : "Nunca atendida"}
                            {c.visitCount > 0 ? ` · ${c.visitCount} visita${c.visitCount !== 1 ? "s" : ""}` : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {wa ? (
                          <a
                            href={wa}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-600 hover:bg-green-500/20 transition-colors"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                            WhatsApp
                          </a>
                        ) : (
                          <span className="text-xs text-muted-foreground">{c.phone ?? "Sem telefone"}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

// ─── Serviços Tab ─────────────────────────────────────────────────────────────

function TabServicos({ appts, isLoading }: { appts: ApptRow[]; isLoading: boolean }) {
  const ranking = useMemo(() => buildServiceRanking(appts), [appts]);
  const maxRevenue = ranking[0]?.revenue ?? 1;

  const handleExport = useCallback(() => {
    downloadCsv(
      ranking.map((s, i) => ({
        Posição: i + 1,
        Serviço: s.name,
        Atendimentos: s.count,
        Receita: s.revenue.toFixed(2).replace(".", ","),
        "Ticket Médio": s.count > 0 ? (s.revenue / s.count).toFixed(2).replace(".", ",") : "0,00",
      })),
      "ranking-servicos.csv"
    );
  }, [ranking]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!ranking.length) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
          Nenhum atendimento no período selecionado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-semibold">Ranking por Receita</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {ranking.map((s, i) => (
            <div key={s.id} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="shrink-0 w-6 text-center font-bold text-muted-foreground text-xs">
                    {i + 1}º
                  </span>
                  <Scissors className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="font-medium text-foreground truncate">{s.name}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0 text-right">
                  <span className="text-xs text-muted-foreground">{s.count} atend.</span>
                  <span className="font-semibold text-foreground">{fmtBRL(s.revenue)}</span>
                </div>
              </div>
              <div className="ml-8 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${Math.max(2, (s.revenue / maxRevenue) * 100)}%` }}
                />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Profissionais Tab ────────────────────────────────────────────────────────

function TabProfissionais({ appts, isLoading }: { appts: ApptRow[]; isLoading: boolean }) {
  const ranking = useMemo(() => buildProfRanking(appts), [appts]);

  const handleExport = useCallback(() => {
    downloadCsv(
      ranking.map((p, i) => ({
        Posição: i + 1,
        Profissional: p.name,
        Atendimentos: p.count,
        "Clientes Únicos": p.clients,
        Receita: p.revenue.toFixed(2).replace(".", ","),
        "Ticket Médio": p.count > 0 ? (p.revenue / p.count).toFixed(2).replace(".", ",") : "0,00",
      })),
      "desempenho-profissionais.csv"
    );
  }, [ranking]);

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
        </CardContent>
      </Card>
    );
  }

  if (!ranking.length) {
    return (
      <Card>
        <CardContent className="flex h-48 items-center justify-center text-muted-foreground text-sm">
          Nenhum atendimento no período selecionado
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="outline" onClick={handleExport} className="gap-2">
          <Download className="h-4 w-4" /> Exportar CSV
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {ranking.map((p, i) => (
          <Card key={p.id} className="relative overflow-hidden">
            {i === 0 && (
              <div className="absolute top-3 right-3">
                <Badge className="bg-amber-500 text-white text-xs">⭐ Top</Badge>
              </div>
            )}
            <CardContent className="pt-5 pb-4 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary font-bold text-lg">
                  {p.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-foreground truncate">{p.name}</p>
                  <p className="text-xs text-muted-foreground">#{i + 1} no ranking</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">Atend.</p>
                  <p className="text-sm font-bold text-foreground">{p.count}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">Clientes</p>
                  <p className="text-sm font-bold text-foreground">{p.clients}</p>
                </div>
                <div className="rounded-lg bg-muted/50 p-2">
                  <p className="text-xs text-muted-foreground">T. Médio</p>
                  <p className="text-sm font-bold text-foreground">
                    {p.count > 0 ? fmtBRL(p.revenue / p.count) : "—"}
                  </p>
                </div>
              </div>
              <div className="flex items-center justify-between pt-1 border-t">
                <span className="text-xs text-muted-foreground">Receita total</span>
                <span className="text-sm font-bold text-primary">{fmtBRL(p.revenue)}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function Relatorios() {
  const { profile } = useAuth();
  const [period, setPeriod] = useState<Period>("30d");
  const [activeTab, setActiveTab] = useState("visao-geral");

  const { start, end } = useMemo(() => getPeriodDates(period), [period]);

  const { data: appts = [], isFetching } = useQuery({
    queryKey: ["relatorios-appts", profile?.tenant_id, period],
    enabled: !!profile?.tenant_id,
    staleTime: 3 * 60 * 1000,
    queryFn: async (): Promise<ApptRow[]> => {
      const { data, error } = await (supabase as any)
        .from("appointments")
        .select(
          "id, scheduled_at, client_id, professional_id, services(id, name, price), profiles!appointments_professional_id_fkey(full_name), clients(id, name, phone)"
        )
        .eq("tenant_id", profile!.tenant_id)
        .eq("status", "completed")
        .gte("scheduled_at", start)
        .lte("scheduled_at", end)
        .order("scheduled_at", { ascending: true });

      if (error) { toast.error("Erro ao carregar relatório"); return []; }
      return (data ?? []) as ApptRow[];
    },
  });

  const tenantId = profile?.tenant_id ?? "";

  return (
    <MainLayout title="Relatórios & BI" subtitle="Análise de desempenho por período">
      <div className="space-y-6 pb-10">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
              <BarChart3 className="h-6 w-6 text-primary" />
              Relatórios & BI
            </h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Análise de desempenho por período
            </p>
          </div>

          {/* Period Selector */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-muted-foreground hidden sm:block">Período:</span>
            <div className="flex rounded-xl border bg-card p-1 gap-1">
              {(["7d", "30d", "90d", "365d"] as Period[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setPeriod(p)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                    period === p
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {isFetching && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="w-full sm:w-auto grid grid-cols-4 sm:inline-flex">
            <TabsTrigger value="visao-geral" className="gap-1.5 text-xs sm:text-sm">
              <TrendingUp className="h-3.5 w-3.5 hidden sm:block" />
              Visão Geral
            </TabsTrigger>
            <TabsTrigger value="inativos" className="gap-1.5 text-xs sm:text-sm">
              <Users className="h-3.5 w-3.5 hidden sm:block" />
              Inativos
            </TabsTrigger>
            <TabsTrigger value="servicos" className="gap-1.5 text-xs sm:text-sm">
              <Scissors className="h-3.5 w-3.5 hidden sm:block" />
              Serviços
            </TabsTrigger>
            <TabsTrigger value="profissionais" className="gap-1.5 text-xs sm:text-sm">
              <UserCog className="h-3.5 w-3.5 hidden sm:block" />
              Equipe
            </TabsTrigger>
          </TabsList>

          <TabsContent value="visao-geral" className="mt-6">
            <TabVisaoGeral appts={appts} period={period} isLoading={isFetching} />
          </TabsContent>

          <TabsContent value="inativos" className="mt-6">
            <TabClientesInativos tenantId={tenantId} period={period} />
          </TabsContent>

          <TabsContent value="servicos" className="mt-6">
            <TabServicos appts={appts} isLoading={isFetching} />
          </TabsContent>

          <TabsContent value="profissionais" className="mt-6">
            <TabProfissionais appts={appts} isLoading={isFetching} />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
