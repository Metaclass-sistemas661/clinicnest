import { useState, useEffect, useMemo, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db: any = supabase;
import { formatCurrency } from "@/lib/formatCurrency";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import {
  Plus,
  Loader2,
  CheckCircle2,
  Clock,
  XCircle,
  Trash2,
  Pencil,
  AlertTriangle,
  TrendingUp,
  QrCode,
  Copy,
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BillReceivable, BillReceivableStatus, Client } from "@/types/database";

const RECEIVABLE_CATEGORIES = [
  "Serviço Avulso", "Pacote", "Adiantamento", "Reembolso", "Comissão", "Outros",
];

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Transferência", "Boleto"];

const billSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.coerce.number({ invalid_type_error: "Informe um valor válido" }).positive("Valor deve ser positivo"),
  due_date: z.string().min(1, "Vencimento obrigatório"),
  category: z.string().min(1, "Categoria obrigatória"),
  client_id: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

const receiveSchema = z.object({
  received_amount: z.coerce.number().positive("Valor deve ser positivo"),
  payment_method: z.string().min(1, "Método obrigatório"),
  received_at: z.string().min(1, "Data obrigatória"),
});

type BillFormValues = z.infer<typeof billSchema>;
type ReceiveFormValues = z.infer<typeof receiveSchema>;

function statusBadge(status: BillReceivableStatus, dueDate: string) {
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDate));
  const isOverdue = isAfter(today, due) && status === "pending";

  if (isOverdue) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Vencida</Badge>;
  if (status === "received") return <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-200"><CheckCircle2 className="h-3 w-3" />Recebida</Badge>;
  if (status === "cancelled") return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" />Cancelada</Badge>;
  return <Badge variant="outline" className="gap-1 text-blue-600 border-blue-300"><Clock className="h-3 w-3" />Pendente</Badge>;
}

export function FinanceiroBillsReceivableTab() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const [bills, setBills] = useState<BillReceivable[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillReceivable | null>(null);
  const [receivingBill, setReceivingBill] = useState<BillReceivable | null>(null);
  const [deletingBill, setDeletingBill] = useState<BillReceivable | null>(null);
  const [pixBill, setPixBill] = useState<BillReceivable | null>(null);
  const [pixData, setPixData] = useState<{ pix_copy_paste: string; pix_encoded_image: string | null; charge_id: string } | null>(null);
  const [isPixLoading, setIsPixLoading] = useState(false);
  const [pixCustomerName, setPixCustomerName] = useState("");
  const [pixCustomerCpf, setPixCustomerCpf] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const billForm = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: { description: "", amount: 0, due_date: "", category: "Serviço Avulso" },
  });

  const receiveForm = useForm<ReceiveFormValues>({
    resolver: zodResolver(receiveSchema),
    defaultValues: { received_amount: 0, payment_method: "PIX", received_at: format(new Date(), "yyyy-MM-dd") },
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [billsRes, clientsRes] = await Promise.all([
        db.from("bills_receivable").select("*, client:clients(id, name)").eq("tenant_id", tenantId).order("due_date", { ascending: true }),
        db.from("clients").select("id, name, phone, email, notes, tenant_id, created_at, updated_at").eq("tenant_id", tenantId).eq("is_active", true).order("name").limit(200),
      ]);
      if (billsRes.error) throw billsRes.error;
      if (clientsRes.error) throw clientsRes.error;
      setBills((billsRes.data ?? []) as BillReceivable[]);
      setClients((clientsRes.data ?? []) as Client[]);
    } catch (err) {
      logger.error("BillsReceivableTab.fetchData", err);
      toast.error("Erro ao carregar contas a receber");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = startOfDay(new Date());

  const { pending, overdue, received, cancelled } = useMemo(() => {
    const pending: BillReceivable[] = [], overdue: BillReceivable[] = [], received: BillReceivable[] = [], cancelled: BillReceivable[] = [];
    for (const b of bills) {
      if (b.status === "received") { received.push(b); continue; }
      if (b.status === "cancelled") { cancelled.push(b); continue; }
      isAfter(today, startOfDay(parseISO(b.due_date))) ? overdue.push(b) : pending.push(b);
    }
    return { pending, overdue, received, cancelled };
  }, [bills, today]);

  const totalPending = useMemo(() => pending.reduce((s, b) => s + Number(b.amount), 0), [pending]);
  const totalOverdue = useMemo(() => overdue.reduce((s, b) => s + Number(b.amount), 0), [overdue]);

  const openCreate = () => {
    billForm.reset({ description: "", amount: 0, due_date: "", category: "Serviço Avulso", client_id: null, notes: "" });
    setEditingBill(null);
    setIsCreateOpen(true);
  };

  const openEdit = (bill: BillReceivable) => {
    setEditingBill(bill);
    billForm.reset({ description: bill.description, amount: bill.amount, due_date: bill.due_date, category: bill.category, client_id: bill.client_id ?? null, notes: bill.notes ?? "" });
    setIsCreateOpen(true);
  };

  const handleSaveBill = async (values: BillFormValues) => {
    if (!tenantId || !profile) return;
    setIsSaving(true);
    try {
      const payload = { tenant_id: tenantId, description: values.description, amount: values.amount, due_date: values.due_date, category: values.category, client_id: values.client_id ?? null, notes: values.notes ?? null, created_by: profile.id };
      if (editingBill) {
        const { error } = await db.from("bills_receivable").update(payload).eq("id", editingBill.id).eq("tenant_id", tenantId);
        if (error) throw error;
        toast.success("Conta atualizada");
      } else {
        const { error } = await db.from("bills_receivable").insert(payload);
        if (error) throw error;
        toast.success("Conta criada");
      }
      setIsCreateOpen(false);
      fetchData();
    } catch (err) { toastRpcError(err); } finally { setIsSaving(false); }
  };

  const handleReceive = async (values: ReceiveFormValues) => {
    if (!receivingBill || !tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await db.from("bills_receivable").update({
        status: "received",
        received_amount: values.received_amount,
        payment_method: values.payment_method,
        received_at: new Date(values.received_at + "T12:00:00-03:00").toISOString(),
      }).eq("id", receivingBill.id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Recebimento registrado");
      setReceivingBill(null);
      fetchData();
    } catch (err) { toastRpcError(err); } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingBill || !tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await db.from("bills_receivable").delete().eq("id", deletingBill.id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Conta excluída");
      setDeletingBill(null);
      fetchData();
    } catch (err) { toastRpcError(err); } finally { setIsSaving(false); }
  };

  const handleCreatePixCharge = async () => {
    if (!pixBill || !pixCustomerName.trim()) { toast.error("Informe o nome do cliente para gerar a cobrança PIX"); return; }
    setIsPixLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("asaas-pix", {
        body: { action: "create_charge", customer_name: pixCustomerName.trim(), customer_cpf_cnpj: pixCustomerCpf.trim() || undefined, value: pixBill.amount, due_date: pixBill.due_date, description: pixBill.description },
      });
      if (fnError || !data?.success) throw new Error(data?.error ?? fnError?.message ?? "Erro ao gerar cobrança");
      setPixData({ charge_id: data.charge_id, pix_copy_paste: data.pix_copy_paste, pix_encoded_image: data.pix_encoded_image ?? null });
      toast.success("Cobrança PIX gerada com sucesso");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Erro desconhecido");
    } finally { setIsPixLoading(false); }
  };

  const BillRow = ({ bill }: { bill: BillReceivable }) => (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{bill.description}</p>
          {bill.client && <p className="text-xs text-muted-foreground">{bill.client.name}</p>}
        </div>
      </TableCell>
      <TableCell className="text-right font-semibold">{formatCurrency(bill.amount)}</TableCell>
      <TableCell>{format(parseISO(bill.due_date), "dd/MM/yyyy")}</TableCell>
      <TableCell><Badge variant="outline" className="text-xs">{bill.category}</Badge></TableCell>
      <TableCell>{statusBadge(bill.status, bill.due_date)}</TableCell>
      <TableCell className="text-right">
        <div className="flex justify-end gap-1">
          {bill.status === "pending" && (
            <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-emerald-600 border-emerald-300 hover:bg-emerald-50"
              onClick={() => { setReceivingBill(bill); receiveForm.reset({ received_amount: bill.amount, payment_method: "PIX", received_at: format(new Date(), "yyyy-MM-dd") }); }}>
              <CheckCircle2 className="h-3 w-3" />Receber
            </Button>
          )}
          {bill.status === "pending" && (
            <Button size="icon" variant="ghost" className="h-7 w-7 text-violet-600 hover:bg-violet-50" title="Gerar cobrança PIX"
              onClick={() => { setPixBill(bill); setPixData(null); setPixCustomerName(bill.client?.name ?? ""); setPixCustomerCpf(""); }}>
              <QrCode className="h-3 w-3" />
            </Button>
          )}
          {bill.status !== "received" && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(bill)}><Pencil className="h-3 w-3" /></Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeletingBill(bill)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  const BillCard = ({ bill }: { bill: BillReceivable }) => (
    <Card className="border-gradient">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold truncate">{bill.description}</p>
            {bill.client && <p className="text-xs text-muted-foreground">{bill.client.name}</p>}
          </div>
          {statusBadge(bill.status, bill.due_date)}
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Valor</span>
          <span className="font-bold">{formatCurrency(bill.amount)}</span>
        </div>
        <div className="flex justify-between text-sm">
          <span className="text-muted-foreground">Vencimento</span>
          <span className="font-medium">{format(parseISO(bill.due_date), "dd/MM/yyyy")}</span>
        </div>
        <div className="flex gap-2 pt-1">
          {bill.status === "pending" && (
            <Button size="sm" variant="outline" className="flex-1 h-8 text-xs gap-1 text-emerald-600 border-emerald-300"
              onClick={() => { setReceivingBill(bill); receiveForm.reset({ received_amount: bill.amount, payment_method: "PIX", received_at: format(new Date(), "yyyy-MM-dd") }); }}>
              <CheckCircle2 className="h-3 w-3" />Receber
            </Button>
          )}
          {bill.status !== "received" && (
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEdit(bill)}><Pencil className="h-3 w-3" /></Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeletingBill(bill)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  function BillList({ bills: list, emptyTitle, emptyDesc }: { bills: BillReceivable[]; emptyTitle: string; emptyDesc: string }) {
    if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
    if (list.length === 0) return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <TrendingUp className="h-7 w-7 text-muted-foreground" />
        </div>
        <p className="font-semibold">{emptyTitle}</p>
        <p className="text-sm text-muted-foreground">{emptyDesc}</p>
      </div>
    );
    return (
      <>
        <div className="grid gap-3 sm:hidden">{list.map((b) => <BillCard key={b.id} bill={b} />)}</div>
        <div className="hidden sm:block rounded-xl border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead>Descrição</TableHead>
                <TableHead className="text-right">Valor</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>{list.map((b) => <BillRow key={b.id} bill={b} />)}</TableBody>
          </Table>
        </div>
      </>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gradient-primary gap-2">
          <Plus className="h-4 w-4" />Nova Conta
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="border-gradient">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">A Receber</p>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold text-blue-500">{formatCurrency(totalPending)}</p>}
            <p className="text-xs text-muted-foreground mt-1">{pending.length} conta(s)</p>
          </CardContent>
        </Card>
        <Card className="border-gradient">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Vencidas</p>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold text-destructive">{formatCurrency(totalOverdue)}</p>}
            <p className="text-xs text-muted-foreground mt-1">{overdue.length} conta(s)</p>
          </CardContent>
        </Card>
        <Card className="border-gradient col-span-2 md:col-span-1">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">Total Pendente</p>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold">{formatCurrency(totalPending + totalOverdue)}</p>}
            <p className="text-xs text-muted-foreground mt-1">{pending.length + overdue.length} conta(s)</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            A Receber {pending.length > 0 && <span className="ml-1.5 rounded-full bg-blue-500 text-white text-[10px] px-1.5">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Vencidas {overdue.length > 0 && <span className="ml-1.5 rounded-full bg-destructive text-white text-[10px] px-1.5">{overdue.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="received">Recebidas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4"><BillList bills={pending} emptyTitle="Nenhuma conta a receber" emptyDesc="Contas com vencimento futuro aparecerão aqui." /></TabsContent>
        <TabsContent value="overdue" className="mt-4"><BillList bills={overdue} emptyTitle="Sem contas vencidas" emptyDesc="Ótimo! Não há contas vencidas no momento." /></TabsContent>
        <TabsContent value="received" className="mt-4"><BillList bills={received} emptyTitle="Nenhum recebimento" emptyDesc="Os valores recebidos aparecerão aqui." /></TabsContent>
        <TabsContent value="cancelled" className="mt-4"><BillList bills={cancelled} emptyTitle="Nenhuma conta cancelada" emptyDesc="As contas canceladas aparecerão aqui." /></TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBill ? "Editar Conta" : "Nova Conta a Receber"}</DialogTitle>
            <DialogDescription>Registre um valor a receber de cliente ou avulso.</DialogDescription>
          </DialogHeader>
          <form onSubmit={billForm.handleSubmit(handleSaveBill)} className="space-y-4">
            <div className="space-y-1.5">
              <Label>Descrição *</Label>
              <Input placeholder="Ex: Pacote de cortes — Maria" {...billForm.register("description")} />
              {billForm.formState.errors.description && <p className="text-xs text-destructive">{billForm.formState.errors.description.message}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Valor (R$) *</Label>
                <Input type="number" step="0.01" min="0.01" placeholder="0,00" {...billForm.register("amount")} />
                {billForm.formState.errors.amount && <p className="text-xs text-destructive">{billForm.formState.errors.amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Vencimento *</Label>
                <Input type="date" {...billForm.register("due_date")} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Select value={billForm.watch("category")} onValueChange={(v) => billForm.setValue("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{RECEIVABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Cliente</Label>
                <Select value={billForm.watch("client_id") ?? "none"} onValueChange={(v) => billForm.setValue("client_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {clients.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Notas adicionais..." rows={2} {...billForm.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}{editingBill ? "Salvar" : "Criar Conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Receive Dialog */}
      {receivingBill && (
        <Dialog open onOpenChange={() => setReceivingBill(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Registrar Recebimento</DialogTitle>
              <DialogDescription>{receivingBill.description}</DialogDescription>
            </DialogHeader>
            <form onSubmit={receiveForm.handleSubmit(handleReceive)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Valor Recebido (R$) *</Label>
                <Input type="number" step="0.01" {...receiveForm.register("received_amount")} />
              </div>
              <div className="space-y-1.5">
                <Label>Forma de Pagamento *</Label>
                <Select value={receiveForm.watch("payment_method")} onValueChange={(v) => receiveForm.setValue("payment_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data do Recebimento *</Label>
                <Input type="date" {...receiveForm.register("received_at")} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReceivingBill(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar Recebimento
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete AlertDialog */}
      <AlertDialog open={!!deletingBill} onOpenChange={(o) => { if (!o) setDeletingBill(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir conta?</AlertDialogTitle>
            <AlertDialogDescription>
              A conta "<strong>{deletingBill?.description}</strong>" ({formatCurrency(deletingBill?.amount ?? 0)}) será excluída permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* PIX Dialog */}
      {pixBill && (
        <Dialog open onOpenChange={(o) => { if (!o) { setPixBill(null); setPixData(null); } }}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2"><QrCode className="h-5 w-5 text-violet-500" />Cobrança PIX — Asaas</DialogTitle>
              <DialogDescription>{pixBill.description} · {formatCurrency(pixBill.amount)}</DialogDescription>
            </DialogHeader>
            {!pixData ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label>Nome do Cliente *</Label>
                  <Input placeholder="Nome completo" value={pixCustomerName} onChange={(e) => setPixCustomerName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>CPF/CNPJ (opcional)</Label>
                  <Input placeholder="000.000.000-00" value={pixCustomerCpf} onChange={(e) => setPixCustomerCpf(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setPixBill(null); setPixData(null); }}>Cancelar</Button>
                  <Button className="gradient-primary gap-2" disabled={isPixLoading || !pixCustomerName.trim()} onClick={handleCreatePixCharge}>
                    {isPixLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <QrCode className="h-4 w-4" />}Gerar QR Code PIX
                  </Button>
                </DialogFooter>
              </div>
            ) : (
              <div className="space-y-4">
                {pixData.pix_encoded_image && (
                  <div className="flex justify-center">
                    <img src={`data:image/png;base64,${pixData.pix_encoded_image}`} alt="QR Code PIX" className="h-48 w-48 rounded-xl border p-2 bg-white" />
                  </div>
                )}
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Pix Copia e Cola</Label>
                  <div className="flex gap-2">
                    <Input readOnly value={pixData.pix_copy_paste} className="font-mono text-xs" />
                    <Button size="icon" variant="outline" onClick={() => { navigator.clipboard.writeText(pixData.pix_copy_paste); toast.success("Copiado!"); }}>
                      <Copy className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => { setPixBill(null); setPixData(null); }}>Fechar</Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
