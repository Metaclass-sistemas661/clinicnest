import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { logger } from "@/lib/logger";
import { Wallet, CreditCard, TrendingUp, TrendingDown, Calendar, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format, differenceInDays } from "date-fns";
import { CommissionTierIndicator } from "@/components/commission/CommissionTierIndicator";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";

interface MonthlyData {
  month: string;
  comissoes: number;
  salarios: number;
  total: number;
}

interface Alert {
  type: "warning" | "success" | "info";
  message: string;
}

const COLORS = ["hsl(var(--primary))", "hsl(var(--success))", "hsl(var(--warning))"];

export function MeuFinanceiroResumo() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [pendingCommissions, setPendingCommissions] = useState(0);
  const [paidThisMonth, setPaidThisMonth] = useState(0);
  const [projectedNext30, setProjectedNext30] = useState(0);
  const [monthlyAverage, setMonthlyAverage] = useState(0);
  const [chartData, setChartData] = useState<MonthlyData[]>([]);
  const [compositionData, setCompositionData] = useState<{ name: string; value: number }[]>([]);
  const [clinicAverage, setClinicAverage] = useState<number | null>(null);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [oldPendingAmount, setOldPendingAmount] = useState(0);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id) {
      fetchData();
    }
  }, [profile?.tenant_id, profile?.user_id]);

  const fetchData = async () => {
    if (!profile?.tenant_id || !profile?.user_id) return;
    setIsLoading(true);

    try {
      const now = new Date();
      const monthStart = startOfMonth(now);
      const monthEnd = endOfMonth(now);
      const prevMonthStart = startOfMonth(subMonths(now, 1));
      const prevMonthEnd = endOfMonth(subMonths(now, 1));

      // Comissões pendentes
      const { data: pendingData } = await supabase
        .from("commission_payments")
        .select("amount, created_at")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "pending");

      const pending = (pendingData || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );
      setPendingCommissions(pending);

      // Comissões pendentes há mais de 30 dias
      const thirtyDaysAgo = subMonths(now, 1);
      const oldPending = (pendingData || [])
        .filter((c) => new Date(c.created_at) < thirtyDaysAgo)
        .reduce((sum, c) => sum + Number(c.amount || 0), 0);
      setOldPendingAmount(oldPending);

      // Recebido este mês (comissões + salários)
      const { data: paidCommissions } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", monthStart.toISOString())
        .lte("payment_date", monthEnd.toISOString());

      const { data: paidSalaries } = await supabase
        .from("salary_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", monthStart.toISOString())
        .lte("payment_date", monthEnd.toISOString());

      const paidComm = (paidCommissions || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );
      const paidSal = (paidSalaries || []).reduce(
        (sum, s) => sum + Number(s.amount || 0),
        0
      );
      setPaidThisMonth(paidComm + paidSal);

      // Dados do mês anterior para comparação
      const { data: prevMonthCommissions } = await supabase
        .from("commission_payments")
        .select("amount")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("status", "paid")
        .gte("payment_date", prevMonthStart.toISOString())
        .lte("payment_date", prevMonthEnd.toISOString());

      const prevMonthTotal = (prevMonthCommissions || []).reduce(
        (sum, c) => sum + Number(c.amount || 0),
        0
      );

      // Projeção próximos 30 dias (baseado em agendamentos futuros)
      const next30 = new Date();
      next30.setDate(next30.getDate() + 30);

      const { data: futureAppointments } = await supabase
        .from("appointments")
        .select("id, service:services(price)")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .in("status", ["pending", "confirmed"])
        .gte("scheduled_at", now.toISOString())
        .lte("scheduled_at", next30.toISOString());

      // Buscar regra de comissão ativa
      const { data: commissionRule } = await supabase
        .from("commission_rules")
        .select("percentage")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .eq("is_active", true)
        .eq("rule_type", "percentage")
        .order("priority", { ascending: false })
        .limit(1)
        .maybeSingle();

      const commissionPct = commissionRule?.percentage || 0;
      const projected = (futureAppointments || []).reduce((sum, apt) => {
        const price = Number((apt.service as any)?.price || 0);
        return sum + price * (commissionPct / 100);
      }, 0);
      setProjectedNext30(projected);

      // Dados dos últimos 6 meses para gráfico
      const monthlyDataArr: MonthlyData[] = [];
      let totalAll = 0;
      let totalComm = 0;
      let totalSal = 0;

      for (let i = 5; i >= 0; i--) {
        const monthDate = subMonths(now, i);
        const mStart = startOfMonth(monthDate);
        const mEnd = endOfMonth(monthDate);

        const { data: monthComm } = await supabase
          .from("commission_payments")
          .select("amount")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.user_id)
          .eq("status", "paid")
          .gte("payment_date", mStart.toISOString())
          .lte("payment_date", mEnd.toISOString());

        const { data: monthSal } = await supabase
          .from("salary_payments")
          .select("amount")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.user_id)
          .eq("status", "paid")
          .gte("payment_date", mStart.toISOString())
          .lte("payment_date", mEnd.toISOString());

        const commTotal = (monthComm || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0
        );
        const salTotal = (monthSal || []).reduce(
          (s, c) => s + Number(c.amount || 0),
          0
        );

        monthlyDataArr.push({
          month: format(monthDate, "MMM"),
          comissoes: commTotal,
          salarios: salTotal,
          total: commTotal + salTotal,
        });

        totalAll += commTotal + salTotal;
        totalComm += commTotal;
        totalSal += salTotal;
      }

      setChartData(monthlyDataArr);
      setMonthlyAverage(totalAll / 6);

      // Dados para gráfico de composição
      setCompositionData([
        { name: "Comissões", value: totalComm },
        { name: "Salários", value: totalSal },
      ]);

      // Buscar média da clínica (se admin permitir)
      const { data: tenantSettings } = await supabase
        .from("tenant_settings")
        .select("show_clinic_average_to_staff")
        .eq("tenant_id", profile.tenant_id)
        .maybeSingle();

      if (tenantSettings?.show_clinic_average_to_staff) {
        const { data: allProfessionalsComm } = await supabase
          .from("commission_payments")
          .select("amount, professional_id")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "paid")
          .gte("payment_date", monthStart.toISOString())
          .lte("payment_date", monthEnd.toISOString());

        if (allProfessionalsComm && allProfessionalsComm.length > 0) {
          const uniqueProfessionals = new Set(allProfessionalsComm.map((c) => c.professional_id));
          const totalClinic = allProfessionalsComm.reduce((s, c) => s + Number(c.amount || 0), 0);
          setClinicAverage(totalClinic / uniqueProfessionals.size);
        }
      }

      // Gerar alertas
      const newAlerts: Alert[] = [];

      // Alerta: comissões pendentes há mais de 30 dias
      if (oldPending > 0) {
        newAlerts.push({
          type: "warning",
          message: `Você tem ${formatCurrency(oldPending)} em comissões pendentes há mais de 30 dias.`,
        });
      }

      // Alerta: variação em relação ao mês anterior
      if (prevMonthTotal > 0 && paidComm > 0) {
        const variation = ((paidComm - prevMonthTotal) / prevMonthTotal) * 100;
        if (variation < -10) {
          newAlerts.push({
            type: "warning",
            message: `Suas comissões caíram ${Math.abs(variation).toFixed(0)}% em relação ao mês anterior.`,
          });
        } else if (variation > 10) {
          newAlerts.push({
            type: "success",
            message: `Suas comissões aumentaram ${variation.toFixed(0)}% em relação ao mês anterior!`,
          });
        }
      }

      // Alerta: comparativo com média da clínica
      if (clinicAverage && paidComm > 0) {
        const diff = ((paidComm - clinicAverage) / clinicAverage) * 100;
        if (diff > 15) {
          newAlerts.push({
            type: "success",
            message: `Você está ${diff.toFixed(0)}% acima da média da clínica!`,
          });
        }
      }

      setAlerts(newAlerts);
    } catch (error) {
      logger.error("Error fetching financial summary:", error);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32" />
          ))}
        </div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Alertas e Insights */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((alert, idx) => (
            <div
              key={idx}
              className={`flex items-center gap-3 p-3 rounded-lg border ${
                alert.type === "warning"
                  ? "bg-warning/10 border-warning/30 text-warning"
                  : alert.type === "success"
                  ? "bg-success/10 border-success/30 text-success"
                  : "bg-info/10 border-info/30 text-info"
              }`}
            >
              {alert.type === "warning" ? (
                <AlertTriangle className="h-5 w-5 flex-shrink-0" />
              ) : alert.type === "success" ? (
                <CheckCircle2 className="h-5 w-5 flex-shrink-0" />
              ) : (
                <Info className="h-5 w-5 flex-shrink-0" />
              )}
              <p className="text-sm font-medium">{alert.message}</p>
            </div>
          ))}
        </div>
      )}

      {/* Indicador de faixa de comissão */}
      <CommissionTierIndicator />

      {/* Cards de resumo */}
      <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <CreditCard className="h-4 w-4" />
              A Receber
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-warning">
              {formatCurrency(pendingCommissions)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Comissões pendentes
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Recebido (Mês)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-success">
              {formatCurrency(paidThisMonth)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Comissões + Salários
            </p>
            {clinicAverage !== null && (
              <p className="text-xs mt-1">
                {paidThisMonth >= clinicAverage ? (
                  <span className="text-success flex items-center gap-1">
                    <TrendingUp className="h-3 w-3" />
                    {(((paidThisMonth - clinicAverage) / clinicAverage) * 100).toFixed(0)}% acima da média
                  </span>
                ) : (
                  <span className="text-muted-foreground flex items-center gap-1">
                    <TrendingDown className="h-3 w-3" />
                    {(((clinicAverage - paidThisMonth) / clinicAverage) * 100).toFixed(0)}% abaixo da média
                  </span>
                )}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <Calendar className="h-4 w-4" />
              Projeção (30 dias)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(projectedNext30)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Baseado em agendamentos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
              <TrendingUp className="h-4 w-4" />
              Média Mensal
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-foreground">
              {formatCurrency(monthlyAverage)}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Últimos 6 meses
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Gráficos */}
      <div className="grid gap-4 grid-cols-1 lg:grid-cols-3">
        {/* Gráfico de evolução */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Evolução de Ganhos</CardTitle>
            <CardDescription>Últimos 6 meses</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                  <XAxis dataKey="month" className="text-xs" />
                  <YAxis
                    tickFormatter={(v) => `R$ ${(v / 1000).toFixed(0)}k`}
                    className="text-xs"
                  />
                  <Tooltip
                    formatter={(value: number) => formatCurrency(value)}
                    labelFormatter={(label) => `Mês: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="comissoes"
                    name="Comissões"
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="salarios"
                    name="Salários"
                    stroke="hsl(var(--success))"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                  />
                  <Line
                    type="monotone"
                    dataKey="total"
                    name="Total"
                    stroke="hsl(var(--warning))"
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de composição */}
        <Card>
          <CardHeader>
            <CardTitle>Composição</CardTitle>
            <CardDescription>Distribuição dos ganhos</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-72 flex flex-col items-center justify-center">
              {compositionData.every((d) => d.value === 0) ? (
                <p className="text-muted-foreground text-sm">Sem dados no período</p>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={180}>
                    <PieChart>
                      <Pie
                        data={compositionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={50}
                        outerRadius={70}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {compositionData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value: number) => formatCurrency(value)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex gap-4 mt-2">
                    {compositionData.map((entry, index) => {
                      const total = compositionData.reduce((s, d) => s + d.value, 0);
                      const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : 0;
                      return (
                        <div key={entry.name} className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: COLORS[index] }}
                          />
                          <span className="text-xs text-muted-foreground">
                            {entry.name}: {pct}%
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
