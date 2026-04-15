import { useEffect, useState, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  FileText, AlertTriangle, DollarSign, TrendingUp,
  TrendingDown, BarChart3, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import { logger } from "@/lib/logger";

interface TissGuide {
  id: string;
  guide_type: string;
  status: string;
  total_amount: number;
  insurance_name: string | null;
  created_at: string;
}

interface GlosaItem {
  id: string;
  guide_id: string;
  glosa_code: string;
  glosa_description: string | null;
  glosa_amount: number;
  appeal_status: string;
  created_at: string;
}

interface ConvenioBreakdown {
  name: string;
  total: number;
  approved: number;
  denied: number;
}

export const DashboardFaturista = memo(function DashboardFaturista() {
  const { profile } = useAuth();
  const [pendingGuides, setPendingGuides] = useState<TissGuide[]>([]);
  const [openGlosas, setOpenGlosas] = useState<GlosaItem[]>([]);
  const [monthlyTotal, setMonthlyTotal] = useState(0);
  const [monthlyApproved, setMonthlyApproved] = useState(0);
  const [monthlyDenied, setMonthlyDenied] = useState(0);
  const [glosaRate, setGlosaRate] = useState(0);
  const [convenioBreakdown, setConvenioBreakdown] = useState<ConvenioBreakdown[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;
    const now = new Date();
    const monthStart = startOfMonth(now).toISOString();
    const monthEnd = endOfMonth(now).toISOString();

    try {
      const [guidesRes, glosaRes, monthGuidesRes] = await Promise.all([
        api
          .from("tiss_guides")
          .select("id, guide_type, status, total_amount, insurance_name, created_at")
          .eq("tenant_id", profile.tenant_id)
          .in("status", ["draft", "pending", "submitted"])
          .order("created_at", { ascending: false })
          .limit(10),
        api
          .from("tiss_glosa_appeals")
          .select("id, guide_id, glosa_code, glosa_description, glosa_amount, appeal_status, created_at")
          .eq("tenant_id", profile.tenant_id)
          .in("appeal_status", ["pending", "submitted"])
          .order("created_at", { ascending: false })
          .limit(10),
        api
          .from("tiss_guides")
          .select("id, guide_type, status, total_amount, insurance_name")
          .eq("tenant_id", profile.tenant_id)
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd),
      ]);

      setPendingGuides((guidesRes.data || []) as TissGuide[]);
      setOpenGlosas((glosaRes.data || []) as GlosaItem[]);

      const allMonthGuides = (monthGuidesRes.data || []) as TissGuide[];
      const total = allMonthGuides.reduce((s, g) => s + Number(g.total_amount || 0), 0);
      const approved = allMonthGuides.filter((g) => g.status === "approved").reduce((s, g) => s + Number(g.total_amount || 0), 0);
      const denied = allMonthGuides.filter((g) => g.status === "denied" || g.status === "partially_denied").reduce((s, g) => s + Number(g.total_amount || 0), 0);
      setMonthlyTotal(total);
      setMonthlyApproved(approved);
      setMonthlyDenied(denied);
      setGlosaRate(total > 0 ? (denied / total) * 100 : 0);

      const convMap = new Map<string, ConvenioBreakdown>();
      for (const g of allMonthGuides) {
        const name = g.insurance_name || "Sem convênio";
        const existing = convMap.get(name) || { name, total: 0, approved: 0, denied: 0 };
        existing.total += Number(g.total_amount || 0);
        if (g.status === "approved") existing.approved += Number(g.total_amount || 0);
        if (g.status === "denied" || g.status === "partially_denied") existing.denied += Number(g.total_amount || 0);
        convMap.set(name, existing);
      }
      setConvenioBreakdown(Array.from(convMap.values()).sort((a, b) => b.total - a.total));
    } catch (e) {
      logger.error("DashboardFaturista fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  const guideTypeLabels: Record<string, string> = {
    consulta: "Consulta",
    sp_sadt: "SP/SADT",
    honorarios: "Honorários",
    internacao: "Internação",
  };
  const guideStatusLabels: Record<string, string> = {
    draft: "Rascunho",
    pending: "Pendente",
    submitted: "Enviada",
    approved: "Aprovada",
    denied: "Negada",
    partially_denied: "Parcial",
  };
  const guideStatusStyle: Record<string, string> = {
    draft: "bg-muted text-muted-foreground border-border",
    pending: "bg-amber-500/10 text-amber-600 border-amber-500/30",
    submitted: "bg-blue-500/10 text-blue-600 border-blue-500/30",
    approved: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
    denied: "bg-red-500/10 text-red-600 border-red-500/30",
    partially_denied: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  };

  return (
    <div className="space-y-6">
      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Link to="/faturamento-tiss" className="[&:hover]:no-underline">
          <div className="group rounded-2xl border bg-card p-5 transition-all hover:border-teal-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-100">
                <DollarSign className="h-5 w-5 text-teal-600" />
              </div>
              <span className="rounded-full bg-teal-50 px-2.5 py-0.5 text-xs font-semibold text-teal-700">Mês</span>
            </div>
            <p className="text-2xl font-extrabold tabular-nums leading-none">{formatCurrency(monthlyTotal)}</p>
            <p className="mt-1.5 text-sm text-muted-foreground">Faturamento total</p>
          </div>
        </Link>

        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <TrendingUp className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Aceito</span>
          </div>
          <p className="text-2xl font-extrabold tabular-nums leading-none text-emerald-700">{formatCurrency(monthlyApproved)}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Valor aprovado</p>
        </div>

        <div className={`rounded-2xl border p-5 ${monthlyDenied > 0 ? "border-red-200 bg-red-50" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${monthlyDenied > 0 ? "bg-red-100" : "bg-muted/50"}`}>
              <TrendingDown className={`h-5 w-5 ${monthlyDenied > 0 ? "text-red-600" : "text-muted-foreground"}`} />
            </div>
            {monthlyDenied > 0 && (
              <span className="rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-semibold text-red-700">Glosa</span>
            )}
          </div>
          <p className={`text-2xl font-extrabold tabular-nums leading-none ${monthlyDenied > 0 ? "text-red-700" : ""}`}>
            {formatCurrency(monthlyDenied)}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Valor glosado</p>
        </div>

        <div className={`rounded-2xl border p-5 ${glosaRate > 5 ? "border-amber-200 bg-amber-50" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${glosaRate > 5 ? "bg-amber-100" : "bg-muted/50"}`}>
              <BarChart3 className={`h-5 w-5 ${glosaRate > 5 ? "text-amber-600" : "text-muted-foreground"}`} />
            </div>
          </div>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${glosaRate > 5 ? "text-amber-700" : ""}`}>
            {glosaRate.toFixed(1)}%
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Taxa de glosa</p>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Guias pendentes */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Guias TISS pendentes</CardTitle>
                <CardDescription className="text-xs">Rascunhos e guias aguardando envio</CardDescription>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/faturamento-tiss">Ver todas →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {pendingGuides.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <FileText className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma guia pendente</p>
              </div>
            ) : (
              <div className="space-y-2">
                {pendingGuides.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-lg border border-border/70 px-3 py-2.5 hover:bg-muted/40 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">{guideTypeLabels[g.guide_type] || g.guide_type}</p>
                        <Badge variant="outline" className={guideStatusStyle[g.status] || ""}>
                          {guideStatusLabels[g.status] || g.status}
                        </Badge>
                      </div>
                      <p className="text-xs text-muted-foreground truncate mt-0.5">
                        {g.insurance_name || "Sem convênio"} • {formatInAppTz(new Date(g.created_at), "dd/MM")}
                      </p>
                    </div>
                    <p className="text-sm font-semibold tabular-nums shrink-0">{formatCurrency(g.total_amount)}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Glosas abertas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-600/10">
                <AlertTriangle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Glosas abertas</CardTitle>
                <CardDescription className="text-xs">Recursos pendentes ou em análise</CardDescription>
              </div>
            </div>
            {openGlosas.length > 0 && (
              <Badge variant="outline" className="bg-red-500/10 text-red-600 border-red-500/30">{openGlosas.length}</Badge>
            )}
          </CardHeader>
          <CardContent>
            {openGlosas.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <AlertTriangle className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma glosa aberta</p>
              </div>
            ) : (
              <div className="space-y-2">
                {openGlosas.map((g) => (
                  <div key={g.id} className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50/50 px-3 py-2.5 hover:bg-red-50 transition-colors">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{g.glosa_code}</p>
                      {g.glosa_description && <p className="text-xs text-muted-foreground truncate mt-0.5">{g.glosa_description}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={g.appeal_status === "submitted" ? "bg-blue-500/10 text-blue-600 border-blue-500/30" : "bg-amber-500/10 text-amber-600 border-amber-500/30"}>
                        {g.appeal_status === "submitted" ? "Enviado" : "Pendente"}
                      </Badge>
                      <p className="text-sm font-semibold tabular-nums text-red-600">{formatCurrency(g.glosa_amount)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown por convênio */}
      {convenioBreakdown.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-600/10">
                <BarChart3 className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Faturamento por convênio</CardTitle>
                <CardDescription className="text-xs">{formatInAppTz(new Date(), "MMMM 'de' yyyy")}</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {convenioBreakdown.map((c) => {
                const pct = monthlyTotal > 0 ? (c.total / monthlyTotal) * 100 : 0;
                return (
                  <div key={c.name} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium truncate">{c.name}</span>
                      <span className="font-semibold tabular-nums shrink-0">{formatCurrency(c.total)}</span>
                    </div>
                    <div className="h-2 w-full rounded-full bg-muted/50 overflow-hidden">
                      <div className="h-full rounded-full bg-teal-500 transition-all" style={{ width: `${Math.min(pct, 100)}%` }} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="text-emerald-600">Aceito: {formatCurrency(c.approved)}</span>
                      {c.denied > 0 && <span className="text-red-500">Glosa: {formatCurrency(c.denied)}</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
});
