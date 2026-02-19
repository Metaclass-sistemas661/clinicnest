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
import { Switch } from "@/components/ui/switch";
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
  Receipt,
  RefreshCcw,
} from "lucide-react";
import { format, parseISO, isAfter, startOfDay } from "date-fns";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { BillPayable, CostCenter, BillStatus } from "@/types/database";

const PAYABLE_CATEGORIES = [
  "Aluguel", "Água/Energia", "Funcionários", "Materiais",
  "Marketing", "Manutenção", "Fornecedores", "Impostos", "Outros",
];

const PAYMENT_METHODS = ["Dinheiro", "PIX", "Cartão de Débito", "Cartão de Crédito", "Transferência", "Boleto"];

const billSchema = z.object({
  description: z.string().min(1, "Descrição obrigatória"),
  amount: z.coerce.number({ invalid_type_error: "Informe um valor válido" }).positive("Valor deve ser positivo"),
  due_date: z.string().min(1, "Vencimento obrigatório"),
  category: z.string().min(1, "Categoria obrigatória"),
  cost_center_id: z.string().nullable().optional(),
  is_recurring: z.boolean().default(false),
  recurrence_type: z.enum(["weekly", "monthly", "yearly"]).nullable().optional(),
  notes: z.string().nullable().optional(),
});

const paySchema = z.object({
  paid_amount: z.coerce.number().positive("Valor deve ser positivo"),
  payment_method: z.string().min(1, "Método obrigatório"),
  paid_at: z.string().min(1, "Data obrigatória"),
});

type BillFormValues = z.infer<typeof billSchema>;
type PayFormValues = z.infer<typeof paySchema>;

function statusBadge(status: BillStatus, dueDate: string) {
  const today = startOfDay(new Date());
  const due = startOfDay(parseISO(dueDate));
  const isOverdue = isAfter(today, due) && status === "pending";

  if (isOverdue) return <Badge variant="destructive" className="gap-1"><AlertTriangle className="h-3 w-3" />Vencida</Badge>;
  if (status === "paid") return <Badge className="gap-1 bg-emerald-500/15 text-emerald-600 border-emerald-200"><CheckCircle2 className="h-3 w-3" />Paga</Badge>;
  if (status === "cancelled") return <Badge variant="secondary" className="gap-1"><XCircle className="h-3 w-3" />Cancelada</Badge>;
  return <Badge variant="outline" className="gap-1 text-amber-600 border-amber-300"><Clock className="h-3 w-3" />Pendente</Badge>;
}

export function FinanceiroBillsPayableTab() {
  const { profile } = useAuth();
  const tenantId = profile?.tenant_id;

  const [bills, setBills] = useState<BillPayable[]>([]);
  const [costCenters, setCostCenters] = useState<CostCenter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("pending");

  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [editingBill, setEditingBill] = useState<BillPayable | null>(null);
  const [payingBill, setPayingBill] = useState<BillPayable | null>(null);
  const [deletingBill, setDeletingBill] = useState<BillPayable | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const billForm = useForm<BillFormValues>({
    resolver: zodResolver(billSchema),
    defaultValues: { description: "", amount: 0, due_date: "", category: "Outros", is_recurring: false },
  });

  const payForm = useForm<PayFormValues>({
    resolver: zodResolver(paySchema),
    defaultValues: { paid_amount: 0, payment_method: "PIX", paid_at: format(new Date(), "yyyy-MM-dd") },
  });

  const fetchData = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const [billsRes, ccRes] = await Promise.all([
        db.from("bills_payable").select("*").eq("tenant_id", tenantId).order("due_date", { ascending: true }),
        db.from("cost_centers").select("*").eq("tenant_id", tenantId).eq("is_active", true).order("name"),
      ]);
      if (billsRes.error) throw billsRes.error;
      if (ccRes.error) throw ccRes.error;
      setBills((billsRes.data ?? []) as BillPayable[]);
      setCostCenters((ccRes.data ?? []) as CostCenter[]);
    } catch (err) {
      logger.error("BillsPayableTab.fetchData", err);
      toast.error("Erro ao carregar contas a pagar");
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const today = startOfDay(new Date());

  const { pending, overdue, paid, cancelled } = useMemo(() => {
    const pending: BillPayable[] = [], overdue: BillPayable[] = [], paid: BillPayable[] = [], cancelled: BillPayable[] = [];
    for (const b of bills) {
      if (b.status === "paid") { paid.push(b); continue; }
      if (b.status === "cancelled") { cancelled.push(b); continue; }
      if (isAfter(today, startOfDay(parseISO(b.due_date)))) overdue.push(b);
      else pending.push(b);
    }
    return { pending, overdue, paid, cancelled };
  }, [bills, today]);

  const totalPending = useMemo(() => pending.reduce((s, b) => s + Number(b.amount), 0), [pending]);
  const totalOverdue = useMemo(() => overdue.reduce((s, b) => s + Number(b.amount), 0), [overdue]);

  const openCreate = () => {
    billForm.reset({ description: "", amount: 0, due_date: "", category: "Outros", is_recurring: false, notes: "" });
    setEditingBill(null);
    setIsCreateOpen(true);
  };

  const openEdit = (bill: BillPayable) => {
    setEditingBill(bill);
    billForm.reset({
      description: bill.description,
      amount: bill.amount,
      due_date: bill.due_date,
      category: bill.category,
      cost_center_id: bill.cost_center_id ?? undefined,
      is_recurring: bill.is_recurring,
      recurrence_type: bill.recurrence_type ?? undefined,
      notes: bill.notes ?? "",
    });
    setIsCreateOpen(true);
  };

  const handleSaveBill = async (values: BillFormValues) => {
    if (!tenantId || !profile) return;
    setIsSaving(true);
    try {
      const payload = {
        tenant_id: tenantId,
        description: values.description,
        amount: values.amount,
        due_date: values.due_date,
        category: values.category,
        cost_center_id: values.cost_center_id ?? null,
        is_recurring: values.is_recurring,
        recurrence_type: values.is_recurring ? (values.recurrence_type ?? "monthly") : null,
        notes: values.notes ?? null,
        created_by: profile.id,
      };
      if (editingBill) {
        const { error } = await db.from("bills_payable").update(payload).eq("id", editingBill.id).eq("tenant_id", tenantId);
        if (error) throw error;
        toast.success("Conta atualizada");
      } else {
        const { error } = await db.from("bills_payable").insert(payload);
        if (error) throw error;
        toast.success("Conta criada");
      }
      setIsCreateOpen(false);
      fetchData();
    } catch (err) { toastRpcError(err); } finally { setIsSaving(false); }
  };

  const handlePay = async (values: PayFormValues) => {
    if (!payingBill || !tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await db.from("bills_payable").update({
        status: "paid",
        paid_amount: values.paid_amount,
        payment_method: values.payment_method,
        paid_at: new Date(values.paid_at + "T12:00:00-03:00").toISOString(),
      }).eq("id", payingBill.id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Conta marcada como paga");
      setPayingBill(null);
      fetchData();
    } catch (err) { toastRpcError(err); } finally { setIsSaving(false); }
  };

  const handleDelete = async () => {
    if (!deletingBill || !tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await db.from("bills_payable").delete().eq("id", deletingBill.id).eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Conta excluída");
      setDeletingBill(null);
      fetchData();
    } catch (err) { toastRpcError(err); } finally { setIsSaving(false); }
  };

  const BillRow = ({ bill }: { bill: BillPayable }) => (
    <TableRow>
      <TableCell>
        <div>
          <p className="font-medium">{bill.description}</p>
          {bill.is_recurring && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <RefreshCcw className="h-3 w-3" />
              {bill.recurrence_type === "monthly" ? "Mensal" : bill.recurrence_type === "weekly" ? "Semanal" : "Anual"}
            </p>
          )}
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
              onClick={() => { setPayingBill(bill); payForm.reset({ paid_amount: bill.amount, payment_method: "PIX", paid_at: format(new Date(), "yyyy-MM-dd") }); }}>
              <CheckCircle2 className="h-3 w-3" />Pagar
            </Button>
          )}
          {bill.status !== "paid" && (
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(bill)}><Pencil className="h-3 w-3" /></Button>
          )}
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:bg-destructive/10" onClick={() => setDeletingBill(bill)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </TableCell>
    </TableRow>
  );

  const BillCard = ({ bill }: { bill: BillPayable }) => (
    <Card className="border-gradient">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground truncate">{bill.description}</p>
            <p className="text-xs text-muted-foreground">{bill.category}</p>
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
              onClick={() => { setPayingBill(bill); payForm.reset({ paid_amount: bill.amount, payment_method: "PIX", paid_at: format(new Date(), "yyyy-MM-dd") }); }}>
              <CheckCircle2 className="h-3 w-3" />Pagar
            </Button>
          )}
          {bill.status !== "paid" && (
            <Button size="sm" variant="outline" className="h-8 w-8 p-0" onClick={() => openEdit(bill)}><Pencil className="h-3 w-3" /></Button>
          )}
          <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:bg-destructive/10" onClick={() => setDeletingBill(bill)}>
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );

  function BillList({ bills: list, emptyTitle, emptyDesc }: { bills: BillPayable[]; emptyTitle: string; emptyDesc: string }) {
    if (isLoading) return <div className="space-y-3">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
    if (list.length === 0) return (
      <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
        <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center">
          <Receipt className="h-7 w-7 text-muted-foreground" />
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

  const isRecurring = billForm.watch("is_recurring");

  return (
    <div className="space-y-6">
      {/* Actions + Stats */}
      <div className="flex justify-end">
        <Button onClick={openCreate} className="gradient-primary gap-2">
          <Plus className="h-4 w-4" />Nova Conta
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3">
        <Card className="border-gradient">
          <CardContent className="p-4">
            <p className="text-xs text-muted-foreground mb-1">A Vencer</p>
            {isLoading ? <Skeleton className="h-7 w-24" /> : <p className="text-xl font-bold text-amber-500">{formatCurrency(totalPending)}</p>}
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

      {/* Sub-tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="pending">
            A Vencer {pending.length > 0 && <span className="ml-1.5 rounded-full bg-amber-500 text-white text-[10px] px-1.5">{pending.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="overdue">
            Vencidas {overdue.length > 0 && <span className="ml-1.5 rounded-full bg-destructive text-white text-[10px] px-1.5">{overdue.length}</span>}
          </TabsTrigger>
          <TabsTrigger value="paid">Pagas</TabsTrigger>
          <TabsTrigger value="cancelled">Canceladas</TabsTrigger>
        </TabsList>
        <TabsContent value="pending" className="mt-4"><BillList bills={pending} emptyTitle="Nenhuma conta a vencer" emptyDesc="Não há contas com vencimento futuro." /></TabsContent>
        <TabsContent value="overdue" className="mt-4"><BillList bills={overdue} emptyTitle="Sem contas vencidas" emptyDesc="Ótimo! Não há contas vencidas no momento." /></TabsContent>
        <TabsContent value="paid" className="mt-4"><BillList bills={paid} emptyTitle="Nenhuma conta paga" emptyDesc="As contas pagas aparecerão aqui." /></TabsContent>
        <TabsContent value="cancelled" className="mt-4"><BillList bills={cancelled} emptyTitle="Nenhuma conta cancelada" emptyDesc="As contas canceladas aparecerão aqui." /></TabsContent>
      </Tabs>

      {/* Create / Edit Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingBill ? "Editar Conta" : "Nova Conta a Pagar"}</DialogTitle>
            <DialogDescription>Preencha os dados da despesa ou obrigação financeira.</DialogDescription>
          </DialogHeader>
          <form onSubmit={billForm.handleSubmit(handleSaveBill)} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="bp-desc">Descrição *</Label>
              <Input id="bp-desc" placeholder="Ex: Aluguel de outubro" {...billForm.register("description")} />
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
                {billForm.formState.errors.due_date && <p className="text-xs text-destructive">{billForm.formState.errors.due_date.message}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Categoria *</Label>
                <Select value={billForm.watch("category")} onValueChange={(v) => billForm.setValue("category", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYABLE_CATEGORIES.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Centro de Custo</Label>
                <Select value={billForm.watch("cost_center_id") ?? "none"} onValueChange={(v) => billForm.setValue("cost_center_id", v === "none" ? null : v)}>
                  <SelectTrigger><SelectValue placeholder="Nenhum" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nenhum</SelectItem>
                    {costCenters.map((cc) => <SelectItem key={cc.id} value={cc.id}>{cc.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-lg border p-3">
              <Switch id="bp-recurring" checked={billForm.watch("is_recurring")} onCheckedChange={(v) => billForm.setValue("is_recurring", v)} />
              <div>
                <Label htmlFor="bp-recurring" className="cursor-pointer font-medium">Recorrente</Label>
                <p className="text-xs text-muted-foreground">Cobrar automaticamente em períodos futuros</p>
              </div>
            </div>
            {isRecurring && (
              <div className="space-y-1.5">
                <Label>Frequência</Label>
                <Select value={billForm.watch("recurrence_type") ?? "monthly"} onValueChange={(v) => billForm.setValue("recurrence_type", v as "weekly" | "monthly" | "yearly")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weekly">Semanal</SelectItem>
                    <SelectItem value="monthly">Mensal</SelectItem>
                    <SelectItem value="yearly">Anual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>Observações</Label>
              <Textarea placeholder="Notas adicionais..." rows={2} {...billForm.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsCreateOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                {editingBill ? "Salvar" : "Criar Conta"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Pay Dialog */}
      {payingBill && (
        <Dialog open onOpenChange={() => setPayingBill(null)}>
          <DialogContent className="max-w-sm">
            <DialogHeader>
              <DialogTitle>Registrar Pagamento</DialogTitle>
              <DialogDescription>{payingBill.description}</DialogDescription>
            </DialogHeader>
            <form onSubmit={payForm.handleSubmit(handlePay)} className="space-y-4">
              <div className="space-y-1.5">
                <Label>Valor Pago (R$) *</Label>
                <Input type="number" step="0.01" {...payForm.register("paid_amount")} />
                {payForm.formState.errors.paid_amount && <p className="text-xs text-destructive">{payForm.formState.errors.paid_amount.message}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Forma de Pagamento *</Label>
                <Select value={payForm.watch("payment_method")} onValueChange={(v) => payForm.setValue("payment_method", v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{PAYMENT_METHODS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Data do Pagamento *</Label>
                <Input type="date" {...payForm.register("paid_at")} />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setPayingBill(null)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary">
                  {isSaving && <Loader2 className="h-4 w-4 animate-spin mr-2" />}Confirmar Pagamento
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
    </div>
  );
}
