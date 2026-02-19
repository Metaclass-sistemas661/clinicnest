import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import { addCashMovementV1, closeCashSessionV1, getCashSessionSummaryV1, openCashSessionV1 } from "@/lib/supabase-typed-rpc";
import { cn } from "@/lib/utils";
import {
  Wallet, List, DollarSign, History, ChevronDown, ChevronUp,
  Plus, Receipt, TrendingUp, ArrowDownLeft, ArrowUpRight,
  Clock, ShoppingBag,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

type CashSessionRow = {
  id: string;
  tenant_id: string;
  status: "open" | "closed";
  opened_at: string;
  opened_by: string | null;
  opening_balance: number;
  opening_notes: string | null;
  closed_at: string | null;
  closed_by: string | null;
  closing_balance_reported: number | null;
  closing_balance_expected: number | null;
  closing_difference: number | null;
  closing_notes: string | null;
  created_at: string;
  updated_at: string;
};

type CashMovementRow = {
  id: string;
  tenant_id: string;
  session_id: string;
  type: "reinforcement" | "withdrawal";
  amount: number;
  reason: string | null;
  created_by: string | null;
  created_at: string;
};

type TransactionRow = {
  id: string;
  total_amount: number;
  updated_at: string;
  client: { name: string | null } | null;
  professional: { full_name: string | null } | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function fmtTime(iso: string) {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

// ── KPI Card ─────────────────────────────────────────────────────────────────

function KpiCard({
  label,
  value,
  icon: Icon,
  color = "primary",
  sub,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  color?: "primary" | "green" | "amber" | "blue";
  sub?: string;
}) {
  const bg: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    green:   "bg-green-500/10 text-green-600 dark:text-green-400",
    amber:   "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    blue:    "bg-blue-500/10 text-blue-600 dark:text-blue-400",
  };
  return (
    <Card>
      <CardContent className="pt-5 pb-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-medium text-muted-foreground truncate">{label}</p>
            <p className="text-xl md:text-2xl font-bold mt-0.5 truncate">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center flex-shrink-0", bg[color])}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main ─────────────────────────────────────────────────────────────────────

export default function Caixa() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [openSession, setOpenSession] = useState<CashSessionRow | null>(null);
  const [movements, setMovements] = useState<CashMovementRow[]>([]);
  const [summary, setSummary] = useState<any | null>(null);
  const [transactions, setTransactions] = useState<TransactionRow[]>([]);

  const [closedSessions, setClosedSessions] = useState<CashSessionRow[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [movementFilter, setMovementFilter] = useState<"all" | "reinforcement" | "withdrawal">("all");

  // dialogs
  const [openDialog, setOpenDialog]     = useState(false);
  const [movementDialog, setMovementDialog] = useState(false);
  const [closeDialog, setCloseDialog]   = useState(false);

  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingNotes, setOpeningNotes]     = useState("");
  const [isOpening, setIsOpening]           = useState(false);

  const [movementType, setMovementType]     = useState<"reinforcement" | "withdrawal">("reinforcement");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [isAddingMovement, setIsAddingMovement] = useState(false);

  const [reportedBalance, setReportedBalance] = useState("");
  const [closingNotes, setClosingNotes]       = useState("");
  const [isClosing, setIsClosing]             = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) void refresh();
  }, [profile?.tenant_id]);

  const refresh = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const db = supabase as any;
      const [openRes, historyRes] = await Promise.all([
        db
          .from("cash_sessions")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1),
        db
          .from("cash_sessions")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "closed")
          .order("closed_at", { ascending: false })
          .limit(30),
      ]);

      if (openRes.error) throw openRes.error;
      setClosedSessions((historyRes.data as unknown as CashSessionRow[]) || []);

      const session = (openRes.data?.[0] as unknown as CashSessionRow) ?? null;
      setOpenSession(session);

      if (session?.id) {
        const [movRes, sumRes, txnRes] = await Promise.all([
          db
            .from("cash_movements")
            .select("*")
            .eq("tenant_id", profile.tenant_id)
            .eq("session_id", session.id)
            .order("created_at", { ascending: false }),

          getCashSessionSummaryV1({ p_session_id: session.id }),

          db
            .from("orders")
            .select("id, total_amount, updated_at, client:clients(name), professional:profiles!orders_professional_id_fkey(full_name)")
            .eq("tenant_id", profile.tenant_id)
            .eq("status", "paid")
            .gte("updated_at", session.opened_at)
            .order("updated_at", { ascending: false })
            .limit(100),
        ]);

        if (movRes.error) throw movRes.error;
        setMovements((movRes.data as unknown as CashMovementRow[]) || []);

        if (sumRes.error) {
          toastRpcError(toast, sumRes.error as any, "Erro ao carregar resumo");
          setSummary(null);
        } else {
          setSummary(sumRes.data);
        }

        setTransactions((txnRes.data as TransactionRow[]) || []);
      } else {
        setMovements([]);
        setSummary(null);
        setTransactions([]);
      }
    } catch (err) {
      logger.error("[Caixa] refresh error", err);
      toast.error("Erro ao carregar caixa.");
    } finally {
      setIsLoading(false);
    }
  };

  // ── KPIs ──────────────────────────────────────────────────────────────────

  const totalVendido = useMemo(
    () => (summary?.payments ?? []).reduce((acc: number, p: any) => acc + Number(p.amount || 0), 0),
    [summary]
  );
  const ticketMedio = useMemo(
    () => (transactions.length > 0 ? totalVendido / transactions.length : 0),
    [totalVendido, transactions.length]
  );
  const saldoEsperado = Number(summary?.expected_closing_balance ?? 0);

  // ── Movements filter ──────────────────────────────────────────────────────

  const filteredMovements = useMemo(() => {
    if (movementFilter === "all") return movements;
    return movements.filter((m) => m.type === movementFilter);
  }, [movements, movementFilter]);

  // ── Handlers ─────────────────────────────────────────────────────────────

  const handleOpenCash = async () => {
    setIsOpening(true);
    try {
      const { error } = await openCashSessionV1({
        p_opening_balance: Number(openingBalance) || 0,
        p_notes: openingNotes || null,
      });
      if (error) { toastRpcError(toast, error as any, "Erro ao abrir caixa"); return; }
      toast.success("Caixa aberto!");
      setOpenDialog(false);
      setOpeningBalance("0");
      setOpeningNotes("");
      await refresh();
    } catch (err) {
      logger.error("[Caixa] openCash error", err);
      toast.error("Erro ao abrir caixa");
    } finally {
      setIsOpening(false);
    }
  };

  const handleAddMovement = async () => {
    if (!movementAmount) return;
    setIsAddingMovement(true);
    try {
      const { error } = await addCashMovementV1({
        p_type: movementType,
        p_amount: Number(movementAmount),
        p_reason: movementReason || null,
      });
      if (error) { toastRpcError(toast, error as any, "Erro ao registrar movimentação"); return; }
      toast.success("Movimentação registrada!");
      setMovementDialog(false);
      setMovementAmount("");
      setMovementReason("");
      await refresh();
    } catch (err) {
      logger.error("[Caixa] addMovement error", err);
      toast.error("Erro ao registrar movimentação");
    } finally {
      setIsAddingMovement(false);
    }
  };

  const handleCloseCash = async () => {
    if (!openSession?.id) return;
    setIsClosing(true);
    try {
      const { error } = await closeCashSessionV1({
        p_session_id: openSession.id,
        p_reported_balance: Number(reportedBalance),
        p_notes: closingNotes || null,
      });
      if (error) { toastRpcError(toast, error as any, "Erro ao fechar caixa"); return; }
      toast.success("Caixa fechado com sucesso!");
      setCloseDialog(false);
      setReportedBalance("");
      setClosingNotes("");
      await refresh();
    } catch (err) {
      logger.error("[Caixa] closeCash error", err);
      toast.error("Erro ao fechar caixa");
    } finally {
      setIsClosing(false);
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const headerActions = openSession ? (
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" size="sm" asChild>
        <Link to="/comandas">
          <Plus className="mr-1.5 h-4 w-4" />
          Nova Comanda
        </Link>
      </Button>
      <Button variant="outline" size="sm" onClick={() => setMovementDialog(true)}>
        <ArrowDownLeft className="mr-1.5 h-4 w-4" />
        Sangria/Reforço
      </Button>
      <Button
        size="sm"
        className="gradient-primary text-primary-foreground"
        onClick={() => {
          setReportedBalance(saldoEsperado ? String(saldoEsperado.toFixed(2)) : "");
          setCloseDialog(true);
        }}
      >
        Fechar Caixa
      </Button>
    </div>
  ) : (
    <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => setOpenDialog(true)}>
      <Wallet className="mr-1.5 h-4 w-4" />
      Abrir Caixa
    </Button>
  );

  return (
    <MainLayout title="Caixa / PDV" subtitle="Ponto de venda e controle de sessão" actions={headerActions}>
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-24 w-full" />)}
          </div>
          <Skeleton className="h-80 w-full" />
        </div>
      ) : !openSession ? (
        // ── CAIXA FECHADO ─────────────────────────────────────────────────────
        <div className="space-y-6">
          <Card>
            <CardContent className="pt-8 pb-10">
              <EmptyState
                icon={Wallet}
                title="Caixa fechado"
                description="Abra o caixa para liberar vendas e monitorar as transações do dia."
                action={
                  <Button className="gradient-primary text-primary-foreground" onClick={() => setOpenDialog(true)}>
                    <Wallet className="mr-2 h-4 w-4" />
                    Abrir Caixa
                  </Button>
                }
              />
            </CardContent>
          </Card>

          {/* Histórico (mesmo com caixa fechado) */}
          <HistoricoCard
            sessions={closedSessions}
            isOpen={isHistoryOpen}
            onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
          />
        </div>
      ) : (
        // ── CAIXA ABERTO — PDV Enterprise ─────────────────────────────────────
        <div className="space-y-6">

          {/* ── KPIs ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Total Vendido"
              value={fmt(totalVendido)}
              icon={DollarSign}
              color="green"
              sub={`nesta sessão`}
            />
            <KpiCard
              label="Atendimentos"
              value={String(transactions.length)}
              icon={Receipt}
              color="blue"
              sub={transactions.length === 1 ? "comanda paga" : "comandas pagas"}
            />
            <KpiCard
              label="Ticket Médio"
              value={fmt(ticketMedio)}
              icon={TrendingUp}
              color="amber"
              sub="por comanda"
            />
            <KpiCard
              label="Saldo Esperado"
              value={fmt(saldoEsperado)}
              icon={Wallet}
              color="primary"
              sub={`desde ${new Date(openSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`}
            />
          </div>

          {/* ── Corpo principal: 2 colunas ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* ── Left: Log de Transações (2/3) ── */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2">
                      <Receipt className="h-5 w-5" />
                      Transações da Sessão
                      {transactions.length > 0 && (
                        <Badge variant="secondary" className="ml-1">{transactions.length}</Badge>
                      )}
                    </CardTitle>
                    <Button variant="ghost" size="sm" asChild>
                      <Link to="/comandas">
                        Ver todas
                      </Link>
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {transactions.length === 0 ? (
                    <EmptyState
                      icon={ShoppingBag}
                      title="Nenhuma venda ainda"
                      description="As comandas finalizadas nesta sessão aparecerão aqui."
                      action={
                        <Button variant="outline" size="sm" asChild>
                          <Link to="/comandas">
                            <Plus className="mr-1.5 h-4 w-4" />
                            Nova Comanda
                          </Link>
                        </Button>
                      }
                    />
                  ) : (
                    <div className="space-y-0 divide-y">
                      {transactions.map((t) => (
                        <div key={t.id} className="flex items-center justify-between py-3 hover:bg-muted/40 px-1 rounded transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                              <Receipt className="h-4 w-4 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">
                                {t.client?.name ?? "Walk-in"}
                              </p>
                              <p className="text-xs text-muted-foreground truncate">
                                {t.professional?.full_name
                                  ? `${t.professional.full_name} · `
                                  : ""}
                                {fmtTime(t.updated_at)}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-sm font-semibold text-green-600 dark:text-green-400">
                              {fmt(Number(t.total_amount || 0))}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* ── Right: Sessão + Movimentos (1/3) ── */}
            <div className="space-y-6">

              {/* Resumo da sessão */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Clock className="h-4 w-4" />
                    Sessão Atual
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300 ml-auto">
                      Aberto
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground text-xs">Abertura</p>
                      <p className="font-medium">{new Date(openSession.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground text-xs">Saldo inicial</p>
                      <p className="font-medium">{fmt(Number(openSession.opening_balance || 0))}</p>
                    </div>
                    {summary && (
                      <>
                        <div>
                          <p className="text-muted-foreground text-xs">Reforços</p>
                          <p className="font-medium text-green-600 dark:text-green-400">{fmt(Number(summary.reinforcements || 0))}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground text-xs">Sangrias</p>
                          <p className="font-medium text-destructive">{fmt(Number(summary.withdrawals || 0))}</p>
                        </div>
                      </>
                    )}
                  </div>

                  {/* Métodos de pagamento */}
                  {summary?.payments && Array.isArray(summary.payments) && summary.payments.length > 0 && (
                    <>
                      <Separator />
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground mb-2 uppercase tracking-wide">Por método</p>
                        <div className="space-y-1.5">
                          {summary.payments.map((p: any) => (
                            <div key={p.payment_method_id} className="flex justify-between items-center text-sm rounded-lg bg-muted/40 px-3 py-1.5">
                              <span className="text-muted-foreground text-xs">{p.name}</span>
                              <span className="font-semibold text-xs">{fmt(Number(p.amount || 0))}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Movimentações */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <List className="h-4 w-4" />
                      Movimentações
                    </CardTitle>
                    <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setMovementDialog(true)}>
                      <Plus className="h-3 w-3 mr-1" />
                      Registrar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {movements.length > 0 && (
                    <div className="flex gap-1 mb-3">
                      {(["all", "reinforcement", "withdrawal"] as const).map((f) => (
                        <button
                          key={f}
                          type="button"
                          onClick={() => setMovementFilter(f)}
                          className={cn(
                            "text-xs px-2 py-1 rounded-md transition-colors",
                            movementFilter === f
                              ? "bg-primary text-primary-foreground font-medium"
                              : "text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {f === "all" ? "Todos" : f === "reinforcement" ? "Reforços" : "Sangrias"}
                        </button>
                      ))}
                    </div>
                  )}

                  {movements.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Nenhuma movimentação nesta sessão.
                    </p>
                  ) : filteredMovements.length === 0 ? (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Sem movimentações do tipo selecionado.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredMovements.map((m) => (
                        <div key={m.id} className="flex items-center justify-between rounded-lg border px-3 py-2 text-sm">
                          <div className="flex items-center gap-2">
                            {m.type === "withdrawal"
                              ? <ArrowUpRight className="h-3.5 w-3.5 text-destructive flex-shrink-0" />
                              : <ArrowDownLeft className="h-3.5 w-3.5 text-green-600 dark:text-green-400 flex-shrink-0" />
                            }
                            <div>
                              <p className="text-xs font-medium leading-tight">
                                {m.type === "withdrawal" ? "Sangria" : "Reforço"}
                              </p>
                              {m.reason && <p className="text-[10px] text-muted-foreground">{m.reason}</p>}
                              <p className="text-[10px] text-muted-foreground">{fmtTime(m.created_at)}</p>
                            </div>
                          </div>
                          <span className={cn(
                            "text-xs font-semibold",
                            m.type === "withdrawal" ? "text-destructive" : "text-green-600 dark:text-green-400"
                          )}>
                            {m.type === "withdrawal" ? "-" : "+"}{fmt(Number(m.amount))}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* ── Histórico de sessões ── */}
          <HistoricoCard
            sessions={closedSessions}
            isOpen={isHistoryOpen}
            onToggle={() => setIsHistoryOpen(!isHistoryOpen)}
          />
        </div>
      )}

      {/* ── Dialog: Abrir Caixa ── */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir Caixa</DialogTitle>
            <DialogDescription>Informe o saldo inicial (troco em espécie) e observações.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Saldo inicial (R$)</Label>
              <Input type="number" min="0" step="0.01" value={openingBalance} onChange={(e) => setOpeningBalance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={openingNotes} onChange={(e) => setOpeningNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDialog(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleOpenCash} disabled={isOpening}>
              {isOpening ? "Abrindo..." : "Abrir Caixa"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Sangria / Reforço ── */}
      <Dialog open={movementDialog} onOpenChange={setMovementDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar Movimentação</DialogTitle>
            <DialogDescription>Sangria (retirada) ou reforço de caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <div className="grid grid-cols-2 gap-2">
                {(["reinforcement", "withdrawal"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setMovementType(t)}
                    className={cn(
                      "flex items-center gap-2 rounded-lg border-2 p-3 text-sm font-medium transition-all",
                      movementType === t
                        ? t === "reinforcement"
                          ? "border-green-500 bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300"
                          : "border-destructive bg-destructive/5 text-destructive"
                        : "border-border text-muted-foreground hover:border-primary/50"
                    )}
                  >
                    {t === "reinforcement"
                      ? <><ArrowDownLeft className="h-4 w-4" />Reforço</>
                      : <><ArrowUpRight className="h-4 w-4" />Sangria</>
                    }
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo <span className="text-muted-foreground text-xs">(opcional)</span></Label>
              <Textarea value={movementReason} onChange={(e) => setMovementReason(e.target.value)} rows={2} placeholder="Ex: pagamento de fornecedor, fundo de troco..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementDialog(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleAddMovement} disabled={isAddingMovement || !movementAmount}>
              {isAddingMovement ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Fechar Caixa ── */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar Caixa</DialogTitle>
            <DialogDescription>Conte o dinheiro físico e informe o valor. O sistema calculará a diferença.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Resumo antes de fechar */}
            <div className="rounded-lg border bg-muted/30 p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Total em vendas</span>
                <span className="font-medium">{fmt(totalVendido)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Saldo esperado</span>
                <span className="font-bold text-base">{fmt(saldoEsperado)}</span>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Saldo contado (R$) <span className="text-destructive">*</span></Label>
              <Input type="number" min="0" step="0.01" value={reportedBalance} onChange={(e) => setReportedBalance(e.target.value)} placeholder="0,00" />
              {reportedBalance && (
                <div className={cn(
                  "text-xs font-medium px-2 py-1 rounded",
                  Math.abs(Number(reportedBalance) - saldoEsperado) < 0.01
                    ? "text-green-700 bg-green-50 dark:bg-green-950 dark:text-green-300"
                    : "text-destructive bg-destructive/10"
                )}>
                  {Math.abs(Number(reportedBalance) - saldoEsperado) < 0.01
                    ? "✓ Sem divergência"
                    : `Divergência: ${fmt(Number(reportedBalance) - saldoEsperado)}`
                  }
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCloseCash} disabled={isClosing || !reportedBalance}>
              {isClosing ? "Fechando..." : "Confirmar Fechamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}

// ── Histórico Card (extracted) ────────────────────────────────────────────────

function HistoricoCard({
  sessions,
  isOpen,
  onToggle,
}: {
  sessions: CashSessionRow[];
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <Card>
      <CardHeader>
        <button
          type="button"
          className="flex items-center justify-between w-full"
          onClick={onToggle}
        >
          <CardTitle className="flex items-center gap-2 text-base">
            <History className="h-4 w-4" />
            Histórico de Sessões
            <Badge variant="secondary" className="ml-1">{sessions.length}</Badge>
          </CardTitle>
          {isOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
        </button>
      </CardHeader>
      {isOpen && (
        <CardContent>
          {sessions.length === 0 ? (
            <EmptyState
              icon={History}
              title="Nenhuma sessão anterior"
              description="O histórico aparecerá após o primeiro fechamento."
            />
          ) : (
            <div className="space-y-2">
              {sessions.map((s) => {
                const diff = Number(s.closing_difference ?? 0);
                const hasDiff = Math.abs(diff) >= 0.01;
                return (
                  <div key={s.id} className="rounded-lg border p-4 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="text-sm font-semibold">
                          {new Date(s.opened_at).toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(s.opened_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                          {s.closed_at ? ` → ${new Date(s.closed_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}` : ""}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className={cn(
                          !hasDiff
                            ? "border-green-500 text-green-700 dark:text-green-400"
                            : "border-destructive text-destructive"
                        )}
                      >
                        {!hasDiff ? "✓ Ok" : `Δ ${(diff >= 0 ? "+" : "") + diff.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-3 gap-3 text-xs">
                      <div>
                        <p className="text-muted-foreground">Abertura</p>
                        <p className="font-medium">{(Number(s.opening_balance || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Esperado</p>
                        <p className="font-medium">{(Number(s.closing_balance_expected || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      </div>
                      <div>
                        <p className="text-muted-foreground">Contado</p>
                        <p className="font-medium">{(Number(s.closing_balance_reported || 0)).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
