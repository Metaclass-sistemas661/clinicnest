import { useState, useEffect, useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { useAuth } from "@/contexts/AuthContext";
import { getCashFlowProjectionV1 } from "@/lib/supabase-typed-rpc";
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  TrendingUp,
  TrendingDown,
  Wallet,
  RefreshCw,
  ArrowUpCircle,
  ArrowDownCircle,
  AlertTriangle,
} from "lucide-react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { CashFlowProjectionResult, CashFlowSeriesPoint } from "@/types/supabase-extensions";

const DAYS_OPTIONS = [
  { label: "30 dias", value: 30 },
  { label: "60 dias", value: 60 },
  { label: "90 dias", value: 90 },
];

function StatCard({ label, value, sub, icon: Icon, color, loading }: {
  label: string; value: number; sub?: string;
  icon: React.ElementType; color: "green" | "red" | "blue" | "amber" | "purple"; loading?: boolean;
}) {
  const colors = { green: "text-emerald-500", red: "text-destructive", blue: "text-blue-500", amber: "text-amber-500", purple: "text-violet-500" };
  return (
    <Card className="border-gradient">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-1">
          <p className="text-xs text-muted-foreground">{label}</p>
          <Icon className={`h-4 w-4 ${colors[color]}`} />
        </div>
        {loading ? <Skeleton className="h-7 w-28 mt-1" /> : <p className={`text-xl font-bold ${colors[color]}`}>{formatCurrency(value)}</p>}
        {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
      </CardContent>
    </Card>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-lg text-sm space-y-1.5">
      <p className="font-semibold text-foreground">{label}</p>
      {payload.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="text-muted-foreground">{p.name}:</span>
          <span className="font-medium">{formatCurrency(p.value)}</span>
        </div>
      ))}
    </div>
  );
}

export function FinanceiroProjectionTab() {
  const { profile } = useAuth();
  const [days, setDays] = useState(30);
  const [projection, setProjection] = useState<CashFlowProjectionResult | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchProjection = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await getCashFlowProjectionV1({ p_days: days });
      if (error) throw error;
      setProjection(data);
    } catch (err) {
      logger.error("ProjectionTab.fetch", err);
      toast.error("Erro ao carregar projeção de caixa");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, days]);

  useEffect(() => { fetchProjection(); }, [fetchProjection]);

  const today = projection?.today ?? "";

  const chartData = useMemo(() => {
    if (!projection?.series) return [];
    const step = days >= 90 ? 7 : days >= 60 ? 3 : 2;
    return projection.series
      .filter((_, i) => i % step === 0)
      .map((p: CashFlowSeriesPoint) => ({
        date: format(parseISO(p.date), "dd/MM"),
        "Saldo": p.running_balance,
        "A Pagar": p.projected_payable,
        "A Receber": p.projected_receivable,
        isToday: p.date === today,
      }));
  }, [projection, days, today]);

  const upcomingPayable = useMemo(() => {
    if (!projection?.series) return [];
    return projection.series.filter((p) => !p.is_past && p.projected_payable > 0).slice(0, 10);
  }, [projection]);

  const upcomingReceivable = useMemo(() => {
    if (!projection?.series) return [];
    return projection.series.filter((p) => !p.is_past && p.projected_receivable > 0).slice(0, 10);
  }, [projection]);

  const projectedBalance = useMemo(() => {
    if (!projection) return 0;
    return (projection.opening_balance ?? 0) + (projection.projected_receivable_window ?? 0) - (projection.projected_payable_window ?? 0);
  }, [projection]);

  return (
    <div className="space-y-6">
      {/* Controls */}
      <div className="flex items-center justify-end gap-2">
        <Select value={String(days)} onValueChange={(v) => setDays(Number(v))}>
          <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
          <SelectContent>
            {DAYS_OPTIONS.map((o) => <SelectItem key={o.value} value={String(o.value)}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={fetchProjection} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Saldo Atual" value={projection?.opening_balance ?? 0} sub="Com base nas transações" icon={Wallet} color="purple" loading={isLoading} />
        <StatCard label={`A Pagar (${days}d)`} value={projection?.projected_payable_window ?? 0} sub="Contas a pagar pendentes" icon={ArrowDownCircle} color="red" loading={isLoading} />
        <StatCard label={`A Receber (${days}d)`} value={projection?.projected_receivable_window ?? 0} sub="Contas a receber pendentes" icon={ArrowUpCircle} color="green" loading={isLoading} />
        <StatCard label="Saldo Projetado" value={projectedBalance} sub={`Estimativa em ${days} dias`} icon={projectedBalance >= 0 ? TrendingUp : TrendingDown} color={projectedBalance >= 0 ? "blue" : "red"} loading={isLoading} />
      </div>

      {/* Overdue alerts */}
      {!isLoading && ((projection?.overdue_payable ?? 0) > 0 || (projection?.overdue_receivable ?? 0) > 0) && (
        <div className="flex flex-col sm:flex-row gap-3">
          {(projection?.overdue_payable ?? 0) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 flex-1">
              <AlertTriangle className="h-5 w-5 text-destructive shrink-0" />
              <div>
                <p className="text-sm font-semibold text-destructive">Contas a Pagar Vencidas</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(projection!.overdue_payable)} em atraso</p>
              </div>
            </div>
          )}
          {(projection?.overdue_receivable ?? 0) > 0 && (
            <div className="flex items-center gap-3 rounded-xl border border-amber-300/50 bg-amber-500/5 px-4 py-3 flex-1">
              <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-amber-600">Contas a Receber Vencidas</p>
                <p className="text-xs text-muted-foreground">{formatCurrency(projection!.overdue_receivable)} a cobrar</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Chart */}
      <Card className="border-gradient">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Saldo Projetado</CardTitle>
          <CardDescription>Evolução do saldo considerando entradas e saídas previstas</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? <Skeleton className="h-64 w-full" /> : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="projBalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} width={55} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine y={0} stroke="hsl(var(--muted-foreground))" strokeDasharray="4 4" />
                <Area type="monotone" dataKey="Saldo" stroke="#6366f1" strokeWidth={2} fill="url(#projBalGradient)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Upcoming bills grid */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className="border-gradient">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ArrowDownCircle className="h-4 w-4 text-destructive" />Próximas Saídas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              : upcomingPayable.length === 0 ? <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma saída prevista</p>
              : (
                <Table>
                  <TableHeader><TableRow className="bg-muted/20"><TableHead className="text-xs">Data</TableHead><TableHead className="text-xs text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {upcomingPayable.map((p) => (
                      <TableRow key={p.date}>
                        <TableCell className="text-sm">{format(parseISO(p.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right font-semibold text-destructive text-sm">-{formatCurrency(p.projected_payable)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>

        <Card className="border-gradient">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2"><ArrowUpCircle className="h-4 w-4 text-emerald-500" />Próximas Entradas</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? <div className="p-4 space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-8 w-full" />)}</div>
              : upcomingReceivable.length === 0 ? <p className="text-center py-8 text-sm text-muted-foreground">Nenhuma entrada prevista</p>
              : (
                <Table>
                  <TableHeader><TableRow className="bg-muted/20"><TableHead className="text-xs">Data</TableHead><TableHead className="text-xs text-right">Valor</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {upcomingReceivable.map((p) => (
                      <TableRow key={p.date}>
                        <TableCell className="text-sm">{format(parseISO(p.date), "dd/MM/yyyy", { locale: ptBR })}</TableCell>
                        <TableCell className="text-right font-semibold text-emerald-600 text-sm">+{formatCurrency(p.projected_receivable)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
