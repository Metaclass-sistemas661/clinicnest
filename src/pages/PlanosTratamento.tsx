import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { ClipboardList, Plus, Search, Loader2, MoreHorizontal, Eye, Pencil, Trash2, FileText, CheckCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/formatCurrency";
import { generateTreatmentPlanPdf } from "@/lib/treatment-plan-pdf";
import { PatientCombobox } from "@/components/ui/patient-combobox";

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-gray-500" },
  apresentado: { label: "Apresentado", color: "bg-blue-500" },
  aprovado: { label: "Aprovado", color: "bg-green-500" },
  em_andamento: { label: "Em Andamento", color: "bg-amber-500" },
  concluido: { label: "Concluído", color: "bg-emerald-600" },
  cancelado: { label: "Cancelado", color: "bg-red-500" },
};

interface TreatmentPlan {
  id: string;
  plan_number: string;
  title: string;
  status: string;
  total_value: number;
  final_value: number;
  items_count: number;
  items_completed: number;
  professional_name: string;
  created_at: string;
}

export default function PlanosTratamento() {
  const { profile } = useAuth();
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isNewPlanOpen, setIsNewPlanOpen] = useState(false);
  const [isViewOpen, setIsViewOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({ title: "Plano de Tratamento", description: "", valid_until: "", payment_conditions: "", discount_percent: "0" });

  useEffect(() => { if (selectedPatient) fetchPlans(); }, [selectedPatient, statusFilter]);

  const fetchPlans = async () => {
    setIsLoading(true);
    const { data } = await supabase.rpc("get_client_treatment_plans", { p_tenant_id: profile!.tenant_id, p_client_id: selectedPatient });
    let filtered = (data || []) as TreatmentPlan[];
    if (statusFilter !== "all") filtered = filtered.filter(p => p.status === statusFilter);
    setPlans(filtered);
    setIsLoading(false);
  };

  const handleCreatePlan = async () => {
    setIsSaving(true);
    const { data, error } = await supabase.from("treatment_plans").insert({ tenant_id: profile!.tenant_id, patient_id: selectedPatient, professional_id: profile!.id, title: formData.title, description: formData.description || null, valid_until: formData.valid_until || null, payment_conditions: formData.payment_conditions || null, discount_percent: parseFloat(formData.discount_percent) || 0 }).select().single();
    setIsSaving(false);
    if (error) { toast.error("Erro ao criar plano"); return; }
    toast.success("Plano criado!");
    setIsNewPlanOpen(false);
    setFormData({ title: "Plano de Tratamento", description: "", valid_until: "", payment_conditions: "", discount_percent: "0" });
    fetchPlans();
    handleViewPlan(data.id);
  };

  const handleViewPlan = async (planId: string) => {
    const { data } = await supabase.rpc("get_treatment_plan_with_items", { p_plan_id: planId });
    setSelectedPlan(data);
    setIsViewOpen(true);
  };

  const handleDeletePlan = async (planId: string) => {
    if (!confirm("Excluir este plano?")) return;
    await supabase.from("treatment_plans").delete().eq("id", planId);
    toast.success("Plano excluído");
    fetchPlans();
  };

  const handleGeneratePdf = async (planId: string) => {
    const { data } = await supabase.rpc("get_treatment_plan_with_items", { p_plan_id: planId });
    if (data) generateTreatmentPlanPdf(data.plan, data.items);
  };

  const getProgress = (p: TreatmentPlan) => p.items_count === 0 ? 0 : Math.round((p.items_completed / p.items_count) * 100);

  return (
    <MainLayout title="Planos de Tratamento" subtitle="Orçamentos odontológicos detalhados">
      <Card className="mb-6"><CardContent className="pt-5">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="space-y-1 flex-1 min-w-[200px]">
            <Label className="text-xs">Buscar Paciente</Label>
            <PatientCombobox
              tenantId={profile?.tenant_id}
              value={selectedPatient}
              onSelect={(id) => setSelectedPatient(id)}
            />
          </div>
          {selectedPatient && <><div className="space-y-1"><Label className="text-xs">Status</Label><Select value={statusFilter} onValueChange={setStatusFilter}><SelectTrigger className="w-40"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">Todos</SelectItem>{Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div><Button onClick={() => setIsNewPlanOpen(true)} className="gap-2"><Plus className="h-4 w-4" />Novo Plano</Button></>}
        </div>
      </CardContent></Card>

      {isLoading ? <Card><CardContent className="py-8 flex justify-center"><Spinner /></CardContent></Card>
      : !selectedPatient ? <Card><CardContent className="py-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium">Selecione um paciente</h3></CardContent></Card>
      : plans.length === 0 ? <Card><CardContent className="py-12 text-center"><ClipboardList className="h-12 w-12 mx-auto text-muted-foreground/50 mb-4" /><h3 className="text-lg font-medium mb-4">Nenhum plano encontrado</h3><Button onClick={() => setIsNewPlanOpen(true)}><Plus className="h-4 w-4 mr-2" />Criar Plano</Button></CardContent></Card>
      : <div className="grid gap-4">{plans.map(plan => {
          const status = STATUS_CONFIG[plan.status];
          return <Card key={plan.id} className="hover:shadow-md transition-shadow"><CardContent className="p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1"><div className="flex items-center gap-2 mb-1"><span className="font-mono text-xs text-muted-foreground">{plan.plan_number}</span><Badge className={`${status.color} text-white text-xs`}>{status.label}</Badge></div><h3 className="font-semibold">{plan.title}</h3><p className="text-sm text-muted-foreground">{plan.professional_name} · {new Date(plan.created_at).toLocaleDateString("pt-BR")}</p></div>
              <div className="text-right"><p className="text-lg font-bold text-primary">{formatCurrency(plan.final_value)}</p><p className="text-xs text-muted-foreground">{plan.items_count} procedimento(s)</p></div>
              <DropdownMenu><DropdownMenuTrigger asChild><Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger><DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => handleViewPlan(plan.id)}><Eye className="h-4 w-4 mr-2" />Visualizar</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleGeneratePdf(plan.id)}><FileText className="h-4 w-4 mr-2" />Gerar PDF</DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleDeletePlan(plan.id)} className="text-red-600"><Trash2 className="h-4 w-4 mr-2" />Excluir</DropdownMenuItem>
              </DropdownMenuContent></DropdownMenu>
            </div>
            {plan.items_count > 0 && <div className="mt-3"><div className="flex justify-between text-xs mb-1"><span className="text-muted-foreground">Progresso</span><span className="font-medium">{getProgress(plan)}%</span></div><Progress value={getProgress(plan)} className="h-2" /></div>}
          </CardContent></Card>;
        })}</div>}

      <Dialog open={isNewPlanOpen} onOpenChange={setIsNewPlanOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Novo Plano de Tratamento</DialogTitle></DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2"><Label>Título</Label><Input value={formData.title} onChange={e => setFormData({ ...formData, title: e.target.value })} /></div>
          <div className="space-y-2"><Label>Descrição</Label><Textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} rows={2} /></div>
          <div className="grid grid-cols-2 gap-3"><div className="space-y-2"><Label>Válido até</Label><Input type="date" value={formData.valid_until} onChange={e => setFormData({ ...formData, valid_until: e.target.value })} /></div><div className="space-y-2"><Label>Desconto (%)</Label><Input type="number" min="0" max="100" value={formData.discount_percent} onChange={e => setFormData({ ...formData, discount_percent: e.target.value })} /></div></div>
          <div className="space-y-2"><Label>Condições de Pagamento</Label><Textarea value={formData.payment_conditions} onChange={e => setFormData({ ...formData, payment_conditions: e.target.value })} placeholder="Ex: 50% entrada + 3x" rows={2} /></div>
        </div>
        <DialogFooter><Button variant="outline" onClick={() => setIsNewPlanOpen(false)}>Cancelar</Button><Button onClick={handleCreatePlan} disabled={isSaving}>{isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Criar</Button></DialogFooter>
      </DialogContent></Dialog>

      <PlanDetailDialog open={isViewOpen} onOpenChange={setIsViewOpen} planData={selectedPlan} onRefresh={() => { fetchPlans(); if (selectedPlan?.plan?.id) handleViewPlan(selectedPlan.plan.id); }} />
    </MainLayout>
  );
}

function PlanDetailDialog({ open, onOpenChange, planData, onRefresh }: { open: boolean; onOpenChange: (o: boolean) => void; planData: any; onRefresh: () => void }) {
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [itemForm, setItemForm] = useState({ tooth_number: "", surface: "", procedure_name: "", procedure_code: "", unit_price: "", quantity: "1" });

  if (!planData?.plan) return null;
  const plan = planData.plan;
  const items = planData.items || [];
  const status = STATUS_CONFIG[plan.status];

  const handleAddItem = async () => {
    if (!itemForm.procedure_name || !itemForm.unit_price) { toast.error("Preencha procedimento e valor"); return; }
    setIsSaving(true);
    const unitPrice = parseFloat(itemForm.unit_price) || 0;
    const qty = parseInt(itemForm.quantity) || 1;
    const { error } = await supabase.from("treatment_plan_items").insert({ plan_id: plan.id, tooth_number: itemForm.tooth_number ? parseInt(itemForm.tooth_number) : null, surface: itemForm.surface || null, procedure_name: itemForm.procedure_name, procedure_code: itemForm.procedure_code || null, unit_price: unitPrice, quantity: qty, total_price: unitPrice * qty });
    setIsSaving(false);
    if (error) { toast.error("Erro ao adicionar"); return; }
    toast.success("Adicionado!");
    setItemForm({ tooth_number: "", surface: "", procedure_name: "", procedure_code: "", unit_price: "", quantity: "1" });
    setIsAddingItem(false);
    onRefresh();
  };

  const handleCompleteItem = async (itemId: string) => {
    await supabase.rpc("complete_treatment_plan_item", { p_item_id: itemId });
    toast.success("Concluído!");
    onRefresh();
  };

  const handleDeleteItem = async (itemId: string) => {
    await supabase.from("treatment_plan_items").delete().eq("id", itemId);
    toast.success("Removido");
    onRefresh();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}><DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><div className="flex items-center gap-2"><DialogTitle>{plan.title}</DialogTitle><Badge className={`${status.color} text-white`}>{status.label}</Badge></div><p className="text-sm text-muted-foreground">{plan.plan_number} · {plan.client_name}</p></DialogHeader>
      <div className="grid grid-cols-3 gap-4 py-4 border-y">
        <div className="text-center"><p className="text-2xl font-bold text-primary">{formatCurrency(plan.total_value)}</p><p className="text-xs text-muted-foreground">Total</p></div>
        <div className="text-center"><p className="text-2xl font-bold text-green-600">{plan.discount_percent > 0 ? `-${plan.discount_percent}%` : "—"}</p><p className="text-xs text-muted-foreground">Desconto</p></div>
        <div className="text-center"><p className="text-2xl font-bold">{formatCurrency(plan.final_value)}</p><p className="text-xs text-muted-foreground">Final</p></div>
      </div>
      <div className="space-y-3">
        <div className="flex items-center justify-between"><h4 className="font-medium">Procedimentos ({items.length})</h4><Button size="sm" variant="outline" onClick={() => setIsAddingItem(true)}><Plus className="h-4 w-4 mr-1" />Adicionar</Button></div>
        {isAddingItem && <Card className="border-dashed"><CardContent className="p-3 space-y-3">
          <div className="grid grid-cols-4 gap-2"><div><Label className="text-xs">Dente</Label><Input placeholder="36" value={itemForm.tooth_number} onChange={e => setItemForm({ ...itemForm, tooth_number: e.target.value })} /></div><div><Label className="text-xs">Face</Label><Input placeholder="MOD" value={itemForm.surface} onChange={e => setItemForm({ ...itemForm, surface: e.target.value })} /></div><div className="col-span-2"><Label className="text-xs">Procedimento *</Label><Input value={itemForm.procedure_name} onChange={e => setItemForm({ ...itemForm, procedure_name: e.target.value })} /></div></div>
          <div className="grid grid-cols-3 gap-2"><div><Label className="text-xs">Código</Label><Input value={itemForm.procedure_code} onChange={e => setItemForm({ ...itemForm, procedure_code: e.target.value })} /></div><div><Label className="text-xs">Valor *</Label><Input type="number" step="0.01" value={itemForm.unit_price} onChange={e => setItemForm({ ...itemForm, unit_price: e.target.value })} /></div><div><Label className="text-xs">Qtd</Label><Input type="number" min="1" value={itemForm.quantity} onChange={e => setItemForm({ ...itemForm, quantity: e.target.value })} /></div></div>
          <div className="flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setIsAddingItem(false)}>Cancelar</Button><Button size="sm" onClick={handleAddItem} disabled={isSaving}>{isSaving && <Loader2 className="h-3 w-3 mr-1 animate-spin" />}Adicionar</Button></div>
        </CardContent></Card>}
        {items.length === 0 ? <p className="text-sm text-muted-foreground text-center py-4">Nenhum procedimento.</p> : <Table><TableHeader><TableRow><TableHead className="w-16">Dente</TableHead><TableHead>Procedimento</TableHead><TableHead className="w-24 text-right">Valor</TableHead><TableHead className="w-24">Status</TableHead><TableHead className="w-20"></TableHead></TableRow></TableHeader><TableBody>
          {items.map((item: any) => <TableRow key={item.id}>
            <TableCell className="font-mono">{item.tooth_number || "—"}{item.surface && <span className="text-xs text-muted-foreground ml-1">({item.surface})</span>}</TableCell>
            <TableCell><p className="font-medium">{item.procedure_name}</p>{item.procedure_code && <p className="text-xs text-muted-foreground">{item.procedure_code}</p>}</TableCell>
            <TableCell className="text-right font-medium">{formatCurrency(item.total_price)}</TableCell>
            <TableCell><Badge variant="outline" className="text-xs">{STATUS_CONFIG[item.status]?.label || item.status}</Badge></TableCell>
            <TableCell><div className="flex gap-1">{item.status !== "concluido" && <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleCompleteItem(item.id)} title="Concluir"><CheckCircle className="h-4 w-4 text-green-600" /></Button>}<Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleDeleteItem(item.id)}><Trash2 className="h-4 w-4 text-muted-foreground" /></Button></div></TableCell>
          </TableRow>)}
        </TableBody></Table>}
      </div>
      <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Fechar</Button></DialogFooter>
    </DialogContent></Dialog>
  );
}
