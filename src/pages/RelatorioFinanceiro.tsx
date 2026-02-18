import { useState, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { getDreSimpleV1 } from "@/lib/supabase-typed-rpc";
import { toastRpcError } from "@/lib/rpc-error";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { DreSimpleResult } from "@/types/supabase-extensions";
import {
  BarChart3,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Package,
  Loader2,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileText,
  ShoppingCart,
} from "lucide-react";

/* ── Helpers ───────────────────────────────────────── */

const fmt = (v: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

const fmtPct = (v: number | null) => (v != null ? `${v.toFixed(1)}%` : "—");

function getMonthRange(offset = 0): { start: string; end: string; label: string } {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = d.getFullYear();
  const month = d.getMonth();
  const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
  const lastDay = new Date(year, month + 1, 0).getDate();
  const end = `${year}-${String(month + 1).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
  const label = d.toLocaleString("pt-BR", { month: "long", year: "numeric" });
  return { start, end, label: label.charAt(0).toUpperCase() + label.slice(1) };
}

type PeriodPreset = "this_month" | "last_month" | "last_3" | "custom";

/* ── Component ─────────────────────────────────────── */

export default function RelatorioFinanceiro() {
  const { isAdmin } = useAuth();

  const thisMonth = getMonthRange(0);
  const lastMonth = getMonthRange(-1);
  const last3Start = getMonthRange(-2);

  const [preset, setPreset] = useState<PeriodPreset>("this_month");
  const [customStart, setCustomStart] = useState(thisMonth.start);
  const [customEnd, setCustomEnd] = useState(thisMonth.end);

  const [isLoading, setIsLoading] = useState(false);
  const [dre, setDre] = useState<DreSimpleResult | null>(null);

  const activePeriod = useMemo(() => {
    switch (preset) {
      case "this_month":
        return { start: thisMonth.start, end: thisMonth.end, label: thisMonth.label };
      case "last_month":
        return { start: lastMonth.start, end: lastMonth.end, label: lastMonth.label };
      case "last_3":
        return { start: last3Start.start, end: thisMonth.end, label: `${last3Start.label} a ${thisMonth.label}` };
      case "custom":
        return { start: customStart, end: customEnd, label: "Período personalizado" };
    }
  }, [preset, customStart, customEnd, thisMonth, lastMonth, last3Start]);

  const fetchDre = async () => {
    if (!activePeriod.start || !activePeriod.end) {
      toast.error("Selecione as datas do período");
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await getDreSimpleV1({
        p_start_date: activePeriod.start,
        p_end_date: activePeriod.end,
      });

      if (error) {
        toastRpcError(toast, error, "Erro ao gerar relatório");
        return;
      }

      if (!data?.success) {
        toast.error("Erro ao gerar relatório");
        return;
      }

      setDre(data);
    } catch (err) {
      logger.error("[DRE] fetch error", err);
      toast.error("Erro ao gerar relatório");
    } finally {
      setIsLoading(false);
    }
  };

  /* ── Guard ── */

  if (!isAdmin) {
    return (
      <MainLayout title="Relatório Financeiro" subtitle="Acesso restrito">
        <EmptyState
          icon={BarChart3}
          title="Acesso restrito"
          description="Apenas administradores podem visualizar relatórios financeiros."
        />
      </MainLayout>
    );
  }

  /* ── Render ── */

  return (
    <MainLayout
      title="Relatório Financeiro"
      subtitle="DRE simplificada — Demonstração do Resultado"
    >
      <div className="space-y-6">
        {/* ── Period Selector ── */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Período de Análise
            </CardTitle>
            <CardDescription>
              Selecione o período para gerar o relatório de resultados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Preset pills */}
            <div className="flex flex-wrap gap-2">
              {([
                { key: "this_month" as const, label: thisMonth.label },
                { key: "last_month" as const, label: lastMonth.label },
                { key: "last_3" as const, label: "Últimos 3 meses" },
                { key: "custom" as const, label: "Personalizado" },
              ]).map((p) => (
                <Button
                  key={p.key}
                  variant={preset === p.key ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPreset(p.key)}
                  className={preset === p.key ? "gradient-primary text-primary-foreground" : ""}
                >
                  {p.label}
                </Button>
              ))}
            </div>

            {/* Custom date range */}
            {preset === "custom" && (
              <div className="grid gap-3 sm:grid-cols-2 max-w-md">
                <div className="space-y-1">
                  <Label className="text-xs">Data inicial</Label>
                  <Input
                    type="date"
                    value={customStart}
                    onChange={(e) => setCustomStart(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data final</Label>
                  <Input
                    type="date"
                    value={customEnd}
                    onChange={(e) => setCustomEnd(e.target.value)}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={fetchDre}
              disabled={isLoading}
              className="gradient-primary text-primary-foreground"
            >
              {isLoading ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando...
                </>
              ) : (
                <>
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Gerar Relatório
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* ── Loading state ── */}
        {isLoading && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        )}

        {/* ── Empty state ── */}
        {!isLoading && !dre && (
          <EmptyState
            icon={BarChart3}
            title="Nenhum relatório gerado"
            description="Selecione o período e clique em 'Gerar Relatório' para visualizar a DRE."
          />
        )}

        {/* ── DRE Results ── */}
        {!isLoading && dre && (
          <>
            {/* KPI Cards */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                title="Receita Bruta"
                value={fmt(dre.revenue)}
                icon={<DollarSign className="h-5 w-5" />}
                trend="neutral"
                className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                iconColor="text-emerald-600 dark:text-emerald-400"
              />
              <KpiCard
                title="CMV (Custo Produtos)"
                value={fmt(dre.cogs)}
                icon={<ShoppingCart className="h-5 w-5" />}
                trend="neutral"
                className="bg-orange-50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800"
                iconColor="text-orange-600 dark:text-orange-400"
              />
              <KpiCard
                title="Lucro Bruto"
                value={fmt(dre.gross_profit)}
                subtitle={`Margem: ${fmtPct(dre.gross_margin_pct)}`}
                icon={<TrendingUp className="h-5 w-5" />}
                trend={dre.gross_profit >= 0 ? "up" : "down"}
                className="bg-blue-50 dark:bg-blue-950/20 border-blue-200 dark:border-blue-800"
                iconColor="text-blue-600 dark:text-blue-400"
              />
              <KpiCard
                title="Lucro Líquido"
                value={fmt(dre.net_profit)}
                subtitle={`Margem: ${fmtPct(dre.net_margin_pct)}`}
                icon={dre.net_profit >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
                trend={dre.net_profit >= 0 ? "up" : "down"}
                className={
                  dre.net_profit >= 0
                    ? "bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800"
                    : "bg-red-50 dark:bg-red-950/20 border-red-200 dark:border-red-800"
                }
                iconColor={
                  dre.net_profit >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }
              />
            </div>

            {/* DRE Statement */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Demonstração de Resultado — {activePeriod.label}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-lg border divide-y text-sm">
                  <DreRow label="Receita Bruta" value={dre.revenue} bold highlight="green" />

                  {dre.income_by_category.length > 0 && (
                    dre.income_by_category.map((cat, i) => (
                      <DreRow key={`inc-${i}`} label={cat.category || "Outros"} value={cat.amount} indent />
                    ))
                  )}

                  <DreRow label="(−) CMV — Custo dos Produtos Vendidos" value={-dre.cogs} bold highlight="orange" />

                  {dre.cogs_by_product.length > 0 && (
                    dre.cogs_by_product.slice(0, 10).map((prod, i) => (
                      <DreRow key={`cogs-${i}`} label={prod.product_name} value={-prod.amount} indent />
                    ))
                  )}

                  <DreRow label="= Lucro Bruto" value={dre.gross_profit} bold highlight={dre.gross_profit >= 0 ? "green" : "red"} />

                  <DreRow label="(−) Despesas Operacionais" value={-dre.expenses} bold highlight="red" />

                  {dre.expense_by_category.length > 0 && (
                    dre.expense_by_category.map((cat, i) => (
                      <DreRow key={`exp-${i}`} label={cat.category || "Outros"} value={-cat.amount} indent />
                    ))
                  )}

                  <DreRow
                    label="= Lucro Líquido"
                    value={dre.net_profit}
                    bold
                    highlight={dre.net_profit >= 0 ? "green" : "red"}
                    large
                  />
                </div>
              </CardContent>
            </Card>

            {/* Breakdowns in 2 columns */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* Income by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowUpRight className="h-4 w-4 text-emerald-500" />
                    Receitas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dre.income_by_category.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma receita no período.</p>
                  ) : (
                    <div className="space-y-3">
                      {dre.income_by_category.map((cat, i) => {
                        const pct = dre.revenue > 0 ? (cat.amount / dre.revenue) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{cat.category || "Outros"}</span>
                              <span className="font-medium">{fmt(cat.amount)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-emerald-500 transition-all"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}%</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Expense by Category */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                    Despesas por Categoria
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {dre.expense_by_category.length === 0 ? (
                    <p className="text-sm text-muted-foreground">Nenhuma despesa no período.</p>
                  ) : (
                    <div className="space-y-3">
                      {dre.expense_by_category.map((cat, i) => {
                        const pct = dre.expenses > 0 ? (cat.amount / dre.expenses) * 100 : 0;
                        return (
                          <div key={i} className="space-y-1">
                            <div className="flex items-center justify-between text-sm">
                              <span>{cat.category || "Outros"}</span>
                              <span className="font-medium">{fmt(cat.amount)}</span>
                            </div>
                            <div className="h-2 rounded-full bg-muted overflow-hidden">
                              <div
                                className="h-full rounded-full bg-red-500 transition-all"
                                style={{ width: `${Math.min(pct, 100)}%` }}
                              />
                            </div>
                            <p className="text-xs text-muted-foreground text-right">{pct.toFixed(1)}%</p>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* CMV by Product */}
            {dre.cogs_by_product.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Package className="h-4 w-4 text-orange-500" />
                    CMV por Produto — Top {Math.min(dre.cogs_by_product.length, 20)}
                  </CardTitle>
                  <CardDescription>
                    Custo dos produtos vendidos no período, ordenado pelo maior custo.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {/* Mobile: stacked */}
                  <div className="block md:hidden space-y-2">
                    {dre.cogs_by_product.map((prod, i) => {
                      const pct = dre.cogs > 0 ? (prod.amount / dre.cogs) * 100 : 0;
                      return (
                        <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                          <div className="min-w-0">
                            <p className="font-medium truncate text-sm">{prod.product_name}</p>
                            <p className="text-xs text-muted-foreground">{pct.toFixed(1)}% do CMV</p>
                          </div>
                          <span className="font-medium text-sm shrink-0">{fmt(prod.amount)}</span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: table */}
                  <div className="hidden md:block">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-10">#</TableHead>
                          <TableHead>Produto</TableHead>
                          <TableHead className="text-right">Custo Total</TableHead>
                          <TableHead className="text-right w-28">% do CMV</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dre.cogs_by_product.map((prod, i) => {
                          const pct = dre.cogs > 0 ? (prod.amount / dre.cogs) * 100 : 0;
                          return (
                            <TableRow key={i}>
                              <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                              <TableCell className="font-medium">{prod.product_name}</TableCell>
                              <TableCell className="text-right">{fmt(prod.amount)}</TableCell>
                              <TableCell className="text-right">
                                <Badge variant="secondary">{pct.toFixed(1)}%</Badge>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            )}
          </>
        )}
      </div>
    </MainLayout>
  );
}

/* ── Sub-components ────────────────────────────────── */

function KpiCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  className = "",
  iconColor = "",
}: {
  title: string;
  value: string;
  subtitle?: string;
  icon: React.ReactNode;
  trend: "up" | "down" | "neutral";
  className?: string;
  iconColor?: string;
}) {
  return (
    <div className={`rounded-xl border p-4 space-y-2 ${className}`}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{title}</p>
        <div className={iconColor}>{icon}</div>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {subtitle && (
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
          {trend === "down" && <ArrowDownRight className="h-3 w-3 text-red-500" />}
          {trend === "neutral" && <Minus className="h-3 w-3" />}
          {subtitle}
        </div>
      )}
    </div>
  );
}

function DreRow({
  label,
  value,
  bold = false,
  indent = false,
  highlight,
  large = false,
}: {
  label: string;
  value: number;
  bold?: boolean;
  indent?: boolean;
  highlight?: "green" | "red" | "orange";
  large?: boolean;
}) {
  const colorClass =
    highlight === "green"
      ? "text-emerald-700 dark:text-emerald-400"
      : highlight === "red"
        ? "text-red-700 dark:text-red-400"
        : highlight === "orange"
          ? "text-orange-700 dark:text-orange-400"
          : "text-foreground";

  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        indent ? "pl-8 text-muted-foreground" : ""
      } ${bold ? "font-semibold" : ""} ${large ? "py-3 bg-muted/30" : ""}`}
    >
      <span className={`${indent ? "text-xs" : "text-sm"}`}>{label}</span>
      <span className={`${indent ? "text-xs" : "text-sm"} ${bold ? colorClass : "text-muted-foreground"} tabular-nums`}>
        {fmt(value)}
      </span>
    </div>
  );
}
