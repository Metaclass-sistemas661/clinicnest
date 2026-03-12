import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Wallet,
  Plus,
  Search,
  RefreshCw,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  AlertCircle,
  DollarSign,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { formatCurrency } from "@/lib/formatCurrency";

/* ── Types ── */
interface Invoice {
  id: string;
  tenant_id: string;
  client_id: string;
  appointment_id: string | null;
  description: string;
  amount: number;
  due_date: string;
  status: string;
  paid_at: string | null;
  paid_amount: number | null;
  payment_method: string | null;
  notes: string | null;
  created_at: string;
}

interface Client {
  id: string;
  full_name: string;
}

/* ── Helpers ── */
function statusConfig(s: string) {
  switch (s) {
    case "paid":
      return { label: "Pago", variant: "default" as const, icon: CheckCircle2, color: "text-green-600" };
    case "overdue":
      return { label: "Vencido", variant: "destructive" as const, icon: AlertCircle, color: "text-red-600" };
    case "cancelled":
      return { label: "Cancelado", variant: "outline" as const, icon: XCircle, color: "text-gray-500" };
    default:
      return { label: "Pendente", variant: "secondary" as const, icon: Clock, color: "text-amber-600" };
  }
}

/* ── Page ── */
export default function FaturasPacientes() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  // New invoice dialog
  const [showNew, setShowNew] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [newClientId, setNewClientId] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newDueDate, setNewDueDate] = useState("");
  const [newNotes, setNewNotes] = useState("");
  const [newPaymentMethod, setNewPaymentMethod] = useState("");

  // Mark paid dialog
  const [markPaidInvoice, setMarkPaidInvoice] = useState<Invoice | null>(null);
  const [paidAmount, setPaidAmount] = useState("");
  const [paidMethod, setPaidMethod] = useState("pix");

  const fetchInvoices = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("patient_invoices")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("due_date", { ascending: false });

      if (filterStatus !== "all") {
        query = query.eq("status", filterStatus);
      }

      const { data, error } = await query;
      if (error) throw error;
      setInvoices((data ?? []) as Invoice[]);
    } catch (err) {
      logger.error("FaturasPacientes fetch:", err);
      toast.error("Erro ao carregar faturas");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId, filterStatus]);

  const fetchClients = useCallback(async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase
        .from("patients")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .order("full_name");
      setClients((data ?? []) as Client[]);
    } catch (err) {
      logger.error("FaturasPacientes clients:", err);
    }
  }, [tenantId]);

  useEffect(() => { void fetchInvoices(); }, [fetchInvoices]);
  useEffect(() => { void fetchClients(); }, [fetchClients]);

  // client name lookup
  const clientName = (clientId: string) =>
    clients.find((c) => c.id === clientId)?.full_name ?? "Paciente";

  const handleCreate = async () => {
    if (!newClientId || !newDescription.trim() || !newAmount || !newDueDate) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("patient_invoices").insert({
        tenant_id: tenantId,
        client_id: newClientId,
        description: newDescription.trim(),
        amount: parseFloat(newAmount),
        due_date: newDueDate,
        payment_method: newPaymentMethod || null,
        notes: newNotes.trim() || null,
        status: "pending",
      });
      if (error) throw error;
      toast.success("Fatura criada com sucesso!");
      setShowNew(false);
      resetNewForm();
      void fetchInvoices();
    } catch (err) {
      logger.error("FaturasPacientes create:", err);
      toast.error("Erro ao criar fatura");
    } finally {
      setIsSaving(false);
    }
  };

  const handleMarkPaid = async () => {
    if (!markPaidInvoice) return;
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("patient_invoices")
        .update({
          status: "paid",
          paid_at: new Date().toISOString(),
          paid_amount: parseFloat(paidAmount) || markPaidInvoice.amount,
          payment_method: paidMethod,
        })
        .eq("id", markPaidInvoice.id);
      if (error) throw error;
      toast.success("Fatura marcada como paga!");
      setMarkPaidInvoice(null);
      void fetchInvoices();
    } catch (err) {
      logger.error("FaturasPacientes mark paid:", err);
      toast.error("Erro ao atualizar fatura");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = async (inv: Invoice) => {
    try {
      const { error } = await supabase
        .from("patient_invoices")
        .update({ status: "cancelled" })
        .eq("id", inv.id);
      if (error) throw error;
      toast.success("Fatura cancelada");
      void fetchInvoices();
    } catch (err) {
      logger.error("FaturasPacientes cancel:", err);
      toast.error("Erro ao cancelar fatura");
    }
  };

  const resetNewForm = () => {
    setNewClientId("");
    setNewDescription("");
    setNewAmount("");
    setNewDueDate("");
    setNewNotes("");
    setNewPaymentMethod("");
  };

  const filtered = invoices.filter((inv) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      inv.description.toLowerCase().includes(q) ||
      clientName(inv.client_id).toLowerCase().includes(q)
    );
  });

  const totals = {
    pending: invoices.filter((i) => i.status === "pending").reduce((s, i) => s + Number(i.amount), 0),
    paid: invoices.filter((i) => i.status === "paid").reduce((s, i) => s + Number(i.paid_amount || i.amount), 0),
    overdue: invoices.filter((i) => i.status === "overdue").reduce((s, i) => s + Number(i.amount), 0),
  };

  return (
    <MainLayout
      title="Faturas de Pacientes"
      subtitle="Crie e gerencie cobranças para pacientes do portal"
    >
      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-amber-600 font-medium">Pendente</p>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(totals.pending)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-green-600 font-medium">Recebido</p>
            <p className="text-2xl font-bold text-green-600">{formatCurrency(totals.paid)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4 pb-3 px-4">
            <p className="text-xs text-red-600 font-medium">Vencido</p>
            <p className="text-2xl font-bold text-red-600">{formatCurrency(totals.overdue)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Actions bar */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por descrição ou paciente..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="pending">Pendente</SelectItem>
            <SelectItem value="paid">Pago</SelectItem>
            <SelectItem value="overdue">Vencido</SelectItem>
            <SelectItem value="cancelled">Cancelado</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void fetchInvoices()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
        </Button>
        <Button onClick={() => setShowNew(true)}>
          <Plus className="h-4 w-4 mr-2" /> Nova Fatura
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-6 space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="p-8">
              <EmptyState
                icon={Wallet}
                title="Nenhuma fatura encontrada"
                description="Crie uma cobrança clicando em 'Nova Fatura'."
              />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Paciente</TableHead>
                    <TableHead>Descrição</TableHead>
                    <TableHead className="text-right">Valor</TableHead>
                    <TableHead>Vencimento</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv) => {
                    const st = statusConfig(inv.status);
                    return (
                      <TableRow key={inv.id}>
                        <TableCell className="font-medium max-w-[200px] truncate">
                          {clientName(inv.client_id)}
                        </TableCell>
                        <TableCell className="max-w-[250px] truncate">{inv.description}</TableCell>
                        <TableCell className="text-right font-mono">
                          {formatCurrency(inv.amount)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {format(new Date(inv.due_date), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge variant={st.variant} className="gap-1">
                            <st.icon className="h-3 w-3" />
                            {st.label}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-1">
                            {inv.status === "pending" && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-green-600 hover:text-green-700"
                                  onClick={() => {
                                    setMarkPaidInvoice(inv);
                                    setPaidAmount(String(inv.amount));
                                    setPaidMethod("pix");
                                  }}
                                >
                                  <DollarSign className="h-3.5 w-3.5 mr-1" /> Pagar
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:text-red-700"
                                  onClick={() => void handleCancel(inv)}
                                >
                                  <XCircle className="h-3.5 w-3.5 mr-1" /> Cancelar
                                </Button>
                              </>
                            )}
                          </div>
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

      {/* New Invoice Dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Nova Fatura</DialogTitle>
            <DialogDescription>Crie uma cobrança para enviar ao portal do paciente.</DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Paciente *</Label>
              <Select value={newClientId} onValueChange={setNewClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o paciente" />
                </SelectTrigger>
                <SelectContent>
                  {clients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descrição *</Label>
              <Input
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                placeholder="Ex: Consulta oftalmológica"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Valor (R$) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0.01"
                  value={newAmount}
                  onChange={(e) => setNewAmount(e.target.value)}
                  placeholder="0,00"
                />
              </div>
              <div>
                <Label>Vencimento *</Label>
                <Input
                  type="date"
                  value={newDueDate}
                  onChange={(e) => setNewDueDate(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label>Método de pagamento</Label>
              <Select value={newPaymentMethod} onValueChange={setNewPaymentMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Observações</Label>
              <Textarea
                value={newNotes}
                onChange={(e) => setNewNotes(e.target.value)}
                placeholder="Notas internas (opcional)"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowNew(false)}>Cancelar</Button>
            <Button onClick={() => void handleCreate()} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Criar Fatura
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Mark Paid Dialog */}
      <Dialog open={!!markPaidInvoice} onOpenChange={() => setMarkPaidInvoice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Marcar como Pago</DialogTitle>
            <DialogDescription>
              Fatura: {markPaidInvoice?.description} — {markPaidInvoice && formatCurrency(markPaidInvoice.amount)}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3">
            <div>
              <Label>Valor pago (R$)</Label>
              <Input
                type="number"
                step="0.01"
                value={paidAmount}
                onChange={(e) => setPaidAmount(e.target.value)}
              />
            </div>
            <div>
              <Label>Método</Label>
              <Select value={paidMethod} onValueChange={setPaidMethod}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="pix">PIX</SelectItem>
                  <SelectItem value="cartao_credito">Cartão de Crédito</SelectItem>
                  <SelectItem value="cartao_debito">Cartão de Débito</SelectItem>
                  <SelectItem value="boleto">Boleto</SelectItem>
                  <SelectItem value="dinheiro">Dinheiro</SelectItem>
                  <SelectItem value="transferencia">Transferência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setMarkPaidInvoice(null)}>Cancelar</Button>
            <Button onClick={() => void handleMarkPaid()} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Confirmar Pagamento
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
