import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
import { Wallet, List, DollarSign, History, ChevronDown, ChevronUp } from "lucide-react";

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

function formatCurrency(v: number) {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function Caixa() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [openSession, setOpenSession] = useState<CashSessionRow | null>(null);
  const [movements, setMovements] = useState<CashMovementRow[]>([]);
  const [summary, setSummary] = useState<any | null>(null);

  const [closedSessions, setClosedSessions] = useState<CashSessionRow[]>([]);
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);

  const [movementFilter, setMovementFilter] = useState<"all" | "reinforcement" | "withdrawal">("all");

  const [openDialog, setOpenDialog] = useState(false);
  const [openingBalance, setOpeningBalance] = useState("0");
  const [openingNotes, setOpeningNotes] = useState("");
  const [isOpening, setIsOpening] = useState(false);

  const [movementDialog, setMovementDialog] = useState(false);
  const [movementType, setMovementType] = useState<"reinforcement" | "withdrawal">("reinforcement");
  const [movementAmount, setMovementAmount] = useState("");
  const [movementReason, setMovementReason] = useState("");
  const [isAddingMovement, setIsAddingMovement] = useState(false);

  const [closeDialog, setCloseDialog] = useState(false);
  const [reportedBalance, setReportedBalance] = useState("");
  const [closingNotes, setClosingNotes] = useState("");
  const [isClosing, setIsClosing] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      void refresh();
    }
  }, [profile?.tenant_id]);

  const refresh = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const [openRes, historyRes] = await Promise.all([
        supabase
          .from("cash_sessions")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "open")
          .order("opened_at", { ascending: false })
          .limit(1),
        supabase
          .from("cash_sessions")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "closed")
          .order("closed_at", { ascending: false })
          .limit(20),
      ]);

      if (openRes.error) throw openRes.error;
      setClosedSessions((historyRes.data as unknown as CashSessionRow[]) || []);

      const session = (openRes.data?.[0] as unknown as CashSessionRow) ?? null;
      setOpenSession(session);

      if (session?.id) {
        const [movRes, sumRes] = await Promise.all([
          supabase
            .from("cash_movements")
            .select("*")
            .eq("tenant_id", profile.tenant_id)
            .eq("session_id", session.id)
            .order("created_at", { ascending: false }),
          getCashSessionSummaryV1({ p_session_id: session.id }),
        ]);

        if (movRes.error) throw movRes.error;
        setMovements((movRes.data as unknown as CashMovementRow[]) || []);

        if (sumRes.error) {
          toastRpcError(toast, sumRes.error as any, "Erro ao carregar resumo do caixa");
          setSummary(null);
        } else {
          setSummary(sumRes.data);
        }
      } else {
        setMovements([]);
        setSummary(null);
      }
    } catch (err) {
      logger.error("[Caixa] refresh error", err);
      toast.error("Erro ao carregar caixa.");
    } finally {
      setIsLoading(false);
    }
  };

  const statusBadge = useMemo(() => {
    if (!openSession) return null;
    return (
      <Badge className={openSession.status === "open" ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300" : ""}>
        {openSession.status === "open" ? "Aberto" : "Fechado"}
      </Badge>
    );
  }, [openSession]);

  const filteredMovements = useMemo(() => {
    if (movementFilter === "all") return movements;
    return movements.filter((m) => m.type === movementFilter);
  }, [movements, movementFilter]);

  const handleOpenCash = async () => {
    setIsOpening(true);
    try {
      const { error } = await openCashSessionV1({
        p_opening_balance: Number(openingBalance) || 0,
        p_notes: openingNotes || null,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao abrir caixa");
        return;
      }
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
      if (error) {
        toastRpcError(toast, error as any, "Erro ao registrar movimentação");
        return;
      }
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
      if (error) {
        toastRpcError(toast, error as any, "Erro ao fechar caixa");
        return;
      }
      toast.success("Caixa fechado!");
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

  return (
    <MainLayout
      title="Caixa"
      subtitle="Abertura, fechamento e movimentações"
      actions={
        openSession ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => setMovementDialog(true)} data-tour="caixa-movement">
              Sangria/Reforço
            </Button>
            <Button
              size="sm"
              className="gradient-primary text-primary-foreground"
              onClick={() => {
                const expected = Number(summary?.expected_closing_balance ?? 0);
                setReportedBalance(expected ? String(expected.toFixed(2)) : "");
                setCloseDialog(true);
              }}
              data-tour="caixa-close"
            >
              Fechar Caixa
            </Button>
          </div>
        ) : (
          <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => setOpenDialog(true)} data-tour="caixa-open">
            Abrir Caixa
          </Button>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-64 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Sessão atual */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                Sessão atual
                {statusBadge}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!openSession ? (
                <EmptyState
                  icon={Wallet}
                  title="Caixa fechado"
                  description="Abra o caixa para iniciar as operações do dia."
                  action={
                    <Button className="gradient-primary text-primary-foreground" onClick={() => setOpenDialog(true)}>
                      Abrir Caixa
                    </Button>
                  }
                />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Aberto em</div>
                      <div className="font-medium">
                        {new Date(openSession.opened_at).toLocaleString("pt-BR")}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Saldo inicial</div>
                      <div className="font-medium">{formatCurrency(Number(openSession.opening_balance || 0))}</div>
                    </div>
                  </div>

                  {summary && (
                    <>
                      <Separator />
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <div className="text-muted-foreground">Reforços</div>
                          <div className="font-medium text-success">{formatCurrency(Number(summary.reinforcements || 0))}</div>
                        </div>
                        <div>
                          <div className="text-muted-foreground">Sangrias</div>
                          <div className="font-medium text-destructive">{formatCurrency(Number(summary.withdrawals || 0))}</div>
                        </div>
                        <div className="col-span-2">
                          <div className="text-muted-foreground">Saldo esperado para fechamento</div>
                          <div className="text-lg font-bold">{formatCurrency(Number(summary.expected_closing_balance || 0))}</div>
                        </div>
                      </div>
                    </>
                  )}

                  {summary?.payments && Array.isArray(summary.payments) && (
                    <>
                      <Separator />
                      <div>
                        <div className="text-sm font-semibold mb-2">Resumo por método</div>
                        <div className="space-y-1">
                          {summary.payments.length === 0 ? (
                            <EmptyState
                              icon={DollarSign}
                              title="Sem pagamentos"
                              description="Nenhum pagamento processado nesta sessão."
                            />
                          ) : (
                            summary.payments.map((p: any) => (
                              <div key={p.payment_method_id} className="flex justify-between text-sm rounded-lg border px-3 py-2">
                                <span className="text-muted-foreground">{p.name}</span>
                                <span className="font-medium">{formatCurrency(Number(p.amount || 0))}</span>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          {/* Movimentações */}
          {openSession && (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Movimentações</CardTitle>
                  {movements.length > 0 && (
                    <div className="flex gap-1">
                      {(["all", "reinforcement", "withdrawal"] as const).map((f) => (
                        <Button
                          key={f}
                          variant={movementFilter === f ? "default" : "outline"}
                          size="sm"
                          className={movementFilter === f ? "gradient-primary text-primary-foreground" : ""}
                          onClick={() => setMovementFilter(f)}
                        >
                          {f === "all" ? "Todos" : f === "reinforcement" ? "Reforços" : "Sangrias"}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {movements.length === 0 ? (
                  <EmptyState
                    icon={List}
                    title="Sem movimentações"
                    description="Nenhuma sangria ou reforço registrado nesta sessão."
                  />
                ) : filteredMovements.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Nenhuma movimentação do tipo selecionado.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {filteredMovements.map((m) => (
                      <div key={m.id} className="flex items-start justify-between rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                        <div>
                          <div className="text-sm font-medium">
                            {m.type === "withdrawal" ? "Sangria" : "Reforço"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("pt-BR")}
                            {m.reason ? ` — ${m.reason}` : ""}
                          </div>
                        </div>
                        <div className={`text-sm font-semibold ${m.type === "withdrawal" ? "text-destructive" : "text-success"}`}>
                          {m.type === "withdrawal" ? "-" : "+"}
                          {formatCurrency(Number(m.amount))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Histórico de sessões fechadas */}
          <Card>
            <CardHeader>
              <Button
                variant="ghost"
                className="w-full flex items-center justify-between p-0 h-auto hover:bg-transparent"
                onClick={() => setIsHistoryOpen(!isHistoryOpen)}
              >
                <CardTitle className="flex items-center gap-2">
                  <History className="h-5 w-5" />
                  Histórico de sessões
                  <Badge variant="secondary" className="ml-1">{closedSessions.length}</Badge>
                </CardTitle>
                {isHistoryOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </Button>
            </CardHeader>
            {isHistoryOpen && (
              <CardContent>
                {closedSessions.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="Nenhuma sessão anterior"
                    description="O histórico aparecerá aqui após fechar o primeiro caixa."
                  />
                ) : (
                  <div className="space-y-2">
                    {closedSessions.map((s) => {
                      const diff = Number(s.closing_difference ?? 0);
                      return (
                        <div key={s.id} className="rounded-lg border p-3 hover:bg-muted/50 transition-colors">
                          <div className="flex items-center justify-between mb-1">
                            <div className="text-sm font-medium">
                              {new Date(s.opened_at).toLocaleDateString("pt-BR")}
                            </div>
                            <Badge
                              variant="outline"
                              className={
                                diff === 0
                                  ? "border-green-500 text-green-700 dark:text-green-400"
                                  : "border-destructive text-destructive"
                              }
                            >
                              {diff === 0 ? "Sem divergência" : `Divergência: ${formatCurrency(diff)}`}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
                            <div>
                              <span className="block">Abertura</span>
                              <span className="font-medium text-foreground">{formatCurrency(Number(s.opening_balance || 0))}</span>
                            </div>
                            <div>
                              <span className="block">Esperado</span>
                              <span className="font-medium text-foreground">{formatCurrency(Number(s.closing_balance_expected || 0))}</span>
                            </div>
                            <div>
                              <span className="block">Contado</span>
                              <span className="font-medium text-foreground">{formatCurrency(Number(s.closing_balance_reported || 0))}</span>
                            </div>
                            <div>
                              <span className="block">Fechado em</span>
                              <span className="font-medium text-foreground">
                                {s.closed_at ? new Date(s.closed_at).toLocaleString("pt-BR") : "—"}
                              </span>
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
        </div>
      )}

      {/* Open dialog */}
      <Dialog open={openDialog} onOpenChange={setOpenDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Abrir caixa</DialogTitle>
            <DialogDescription>Informe o saldo inicial (ex.: troco) e observações.</DialogDescription>
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
            <Button variant="outline" onClick={() => setOpenDialog(false)}>
              Cancelar
            </Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleOpenCash} disabled={isOpening}>
              {isOpening ? "Abrindo..." : "Abrir"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Movement dialog */}
      <Dialog open={movementDialog} onOpenChange={setMovementDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Registrar movimentação</DialogTitle>
            <DialogDescription>Sangria (retirada) ou reforço de caixa.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={movementType} onValueChange={(v) => setMovementType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="reinforcement">Reforço</SelectItem>
                  <SelectItem value="withdrawal">Sangria</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Valor (R$)</Label>
              <Input type="number" min="0" step="0.01" value={movementAmount} onChange={(e) => setMovementAmount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea value={movementReason} onChange={(e) => setMovementReason(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMovementDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={handleAddMovement}
              disabled={isAddingMovement || !movementAmount}
            >
              {isAddingMovement ? "Salvando..." : "Registrar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Close dialog */}
      <Dialog open={closeDialog} onOpenChange={setCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Fechar caixa</DialogTitle>
            <DialogDescription>Informe o valor contado em caixa. O sistema calcula a diferença.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Saldo contado (R$)</Label>
              <Input type="number" min="0" step="0.01" value={reportedBalance} onChange={(e) => setReportedBalance(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={closingNotes} onChange={(e) => setClosingNotes(e.target.value)} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseDialog(false)}>
              Cancelar
            </Button>
            <Button
              className="gradient-primary text-primary-foreground"
              onClick={handleCloseCash}
              disabled={isClosing || !reportedBalance}
            >
              {isClosing ? "Fechando..." : "Fechar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
