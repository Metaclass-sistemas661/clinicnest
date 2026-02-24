import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { Calendar, Download, Info, Search, Filter, AlertTriangle, Loader2 } from "lucide-react";
import { format, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";

type CommissionPayment = {
  id: string;
  amount: number;
  service_price: number;
  status: "pending" | "paid";
  payment_date: string | null;
  created_at: string;
  notes: string | null;
  commission_type: string | null;
  appointment?: {
    id: string;
    scheduled_at: string;
    client?: { name: string } | null;
    service?: { name: string } | null;
  } | null;
  rule?: {
    name: string;
    percentage: number;
    rule_type: string;
  } | null;
};

export function MeuFinanceiroComissoes() {
  const { profile } = useAuth();
  const [filterMonth, setFilterMonth] = useState<string>(format(new Date(), "yyyy-MM"));
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [commissions, setCommissions] = useState<CommissionPayment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false);
  const [selectedCommission, setSelectedCommission] = useState<CommissionPayment | null>(null);
  const [disputeReason, setDisputeReason] = useState("");
  const [isSubmittingDispute, setIsSubmittingDispute] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id && profile?.user_id) {
      fetchCommissions();
    }
  }, [profile?.tenant_id, profile?.user_id, filterMonth, filterStatus]);

  const fetchCommissions = async () => {
    if (!profile?.tenant_id || !profile?.user_id) return;
    setIsLoading(true);

    try {
      const [year, month] = filterMonth.split("-").map(Number);
      const start = startOfMonth(new Date(year, month - 1));
      const end = endOfMonth(new Date(year, month - 1));

      let query = supabase
        .from("commission_payments")
        .select(`
          id,
          amount,
          service_price,
          status,
          payment_date,
          notes,
          created_at,
          commission_type,
          appointment:appointments(
            id,
            scheduled_at,
            client:clients(name),
            service:services(name)
          )
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.user_id)
        .gte("created_at", start.toISOString())
        .lte("created_at", end.toISOString());

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) throw error;
      setCommissions((data || []) as CommissionPayment[]);
    } catch (error) {
      logger.error("Error fetching commissions:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredCommissions = commissions.filter((c) => {
    if (!searchTerm) return true;
    const search = searchTerm.toLowerCase();
    const clientName = (c.appointment?.client as any)?.name?.toLowerCase() || "";
    const serviceName = (c.appointment?.service as any)?.name?.toLowerCase() || "";
    return clientName.includes(search) || serviceName.includes(search);
  });

  const pendingTotal = filteredCommissions
    .filter((c) => c.status === "pending")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);
  const paidTotal = filteredCommissions
    .filter((c) => c.status === "paid")
    .reduce((sum, c) => sum + Number(c.amount || 0), 0);

  const monthOptions = (() => {
    const options: string[] = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      options.push(format(d, "yyyy-MM"));
    }
    return options;
  })();

  const exportCsv = () => {
    const headers = ["Data", "Paciente", "Serviço", "Valor Serviço", "Comissão", "Status", "Pagamento"];
    const rows = filteredCommissions.map((c) => [
      formatInAppTz(c.created_at, "dd/MM/yyyy HH:mm"),
      (c.appointment?.client as any)?.name || "—",
      (c.appointment?.service as any)?.name || "—",
      Number(c.service_price || 0).toFixed(2).replace(".", ","),
      Number(c.amount || 0).toFixed(2).replace(".", ","),
      c.status === "paid" ? "Pago" : "Pendente",
      c.status === "paid" && c.payment_date
        ? formatInAppTz(c.payment_date, "dd/MM/yyyy")
        : "—",
    ]);
    const csvContent = [
      headers.join(";"),
      ...rows.map((r) => r.join(";")),
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comissoes-${filterMonth}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const openDisputeDialog = (commission: CommissionPayment) => {
    setSelectedCommission(commission);
    setDisputeReason("");
    setDisputeDialogOpen(true);
  };

  const handleSubmitDispute = async () => {
    if (!profile?.tenant_id || !profile?.user_id || !selectedCommission) return;
    if (!disputeReason.trim()) {
      toast.error("Informe o motivo da contestação");
      return;
    }

    setIsSubmittingDispute(true);
    try {
      const { error } = await supabase.from("commission_disputes").insert({
        tenant_id: profile.tenant_id,
        commission_id: selectedCommission.id,
        professional_id: profile.user_id,
        reason: disputeReason.trim(),
      });

      if (error) throw error;

      toast.success("Contestação enviada com sucesso! O administrador irá analisar.");
      setDisputeDialogOpen(false);
      setSelectedCommission(null);
      setDisputeReason("");
    } catch (error) {
      logger.error("Error submitting dispute:", error);
      toast.error("Erro ao enviar contestação");
    } finally {
      setIsSubmittingDispute(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Filtros */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por paciente ou serviço..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterMonth} onValueChange={setFilterMonth}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((m) => {
                  const [year, month] = m.split("-").map(Number);
                  const label = format(new Date(year, month - 1), "MMMM 'de' yyyy", { locale: ptBR });
                  return (
                    <SelectItem key={m} value={m}>
                      {label.charAt(0).toUpperCase() + label.slice(1)}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                <SelectItem value="pending">Pendentes</SelectItem>
                <SelectItem value="paid">Pagos</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={filteredCommissions.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              CSV
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Resumo */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
        <Card className="border-warning/30 bg-warning/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pendente</p>
            <p className="text-2xl font-bold text-warning">{formatCurrency(pendingTotal)}</p>
          </CardContent>
        </Card>
        <Card className="border-success/30 bg-success/5">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Pago</p>
            <p className="text-2xl font-bold text-success">{formatCurrency(paidTotal)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabela */}
      <Card>
        <CardHeader>
          <CardTitle>Extrato de Comissões</CardTitle>
          <CardDescription>
            {filteredCommissions.length} registro(s) encontrado(s)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredCommissions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                Nenhuma comissão encontrada
              </p>
            </div>
          ) : (
            <div className="rounded-lg border overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Serviço</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Detalhes</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredCommissions.map((c) => {
                    const percentage = c.service_price > 0
                      ? ((c.amount / c.service_price) * 100).toFixed(0)
                      : "—";
                    return (
                      <TableRow key={c.id}>
                        <TableCell className="whitespace-nowrap">
                          {formatInAppTz(c.created_at, "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {(c.appointment?.client as any)?.name || "—"}
                        </TableCell>
                        <TableCell>
                          {(c.appointment?.service as any)?.name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {formatCurrency(Number(c.service_price || 0))}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(c.amount || 0))}
                          <span className="text-xs text-muted-foreground ml-1">
                            ({percentage}%)
                          </span>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              c.status === "paid"
                                ? "bg-success/20 text-success border-success/30"
                                : "bg-warning/20 text-warning border-warning/30"
                            }
                          >
                            {c.status === "paid" ? "Pago" : "Pendente"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Info className="h-4 w-4" />
                              </Button>
                            </TooltipTrigger>
                            <TooltipContent side="left" className="max-w-xs">
                              <div className="space-y-1 text-xs">
                                <p><strong>Tipo:</strong> {c.commission_type || "Percentual"}</p>
                                {c.payment_date && (
                                  <p><strong>Pago em:</strong> {formatInAppTz(c.payment_date, "dd/MM/yyyy")}</p>
                                )}
                                {c.notes && <p><strong>Obs:</strong> {c.notes}</p>}
                              </div>
                            </TooltipContent>
                          </Tooltip>
                          {c.status === "pending" && (
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-warning hover:text-warning"
                                  onClick={() => openDisputeDialog(c)}
                                >
                                  <AlertTriangle className="h-4 w-4" />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>Contestar comissão</TooltipContent>
                            </Tooltip>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog de contestação */}
      <Dialog open={disputeDialogOpen} onOpenChange={setDisputeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Contestar Comissão</DialogTitle>
            <DialogDescription>
              Descreva o motivo da contestação. O administrador irá analisar e responder.
            </DialogDescription>
          </DialogHeader>
          {selectedCommission && (
            <div className="space-y-4">
              <div className="rounded-lg border p-3 bg-muted/50">
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <span className="text-muted-foreground">Valor do serviço:</span>
                    <p className="font-medium">{formatCurrency(Number(selectedCommission.service_price || 0))}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Comissão:</span>
                    <p className="font-medium">{formatCurrency(Number(selectedCommission.amount || 0))}</p>
                  </div>
                  <div className="col-span-2">
                    <span className="text-muted-foreground">Data:</span>
                    <p className="font-medium">{formatInAppTz(selectedCommission.created_at, "dd/MM/yyyy HH:mm")}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="dispute-reason">Motivo da contestação *</Label>
                <Textarea
                  id="dispute-reason"
                  placeholder="Descreva por que você acredita que esta comissão está incorreta..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  rows={4}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setDisputeDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmitDispute} disabled={isSubmittingDispute}>
              {isSubmittingDispute ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Enviando...
                </>
              ) : (
                "Enviar Contestação"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
