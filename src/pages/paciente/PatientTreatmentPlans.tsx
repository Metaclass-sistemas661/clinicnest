import { useState, useEffect, useCallback, useRef } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ClipboardList,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  FileText,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { cn } from "@/lib/utils";

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
  approved_at: string | null;
}

interface PlanItem {
  id: string;
  tooth_number: number | null;
  surface: string | null;
  procedure_name: string;
  unit_price: number;
  quantity: number;
  total_price: number;
  status: string;
  sort_order: number;
}

const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "bg-amber-500" },
  apresentado: { label: "Aguardando Aprovação", color: "bg-blue-500" },
  aprovado: { label: "Aprovado", color: "bg-green-500" },
  em_andamento: { label: "Em Andamento", color: "bg-teal-500" },
  concluido: { label: "Concluído", color: "bg-emerald-600" },
  cancelado: { label: "Cancelado", color: "bg-red-500" },
};

const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  pendente: { label: "Pendente", color: "text-amber-600" },
  agendado: { label: "Agendado", color: "text-blue-600" },
  em_andamento: { label: "Em Andamento", color: "text-teal-600" },
  concluido: { label: "Concluído", color: "text-green-600" },
  cancelado: { label: "Cancelado", color: "text-red-500" },
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);
}

export default function PatientTreatmentPlans() {
  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedPlan, setExpandedPlan] = useState<string | null>(null);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  // Approval dialog
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; planId: string; title: string }>({ open: false, planId: "", title: "" });
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; planId: string; title: string }>({ open: false, planId: "", title: "" });
  const [rejectReason, setRejectReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const signatureRef = useRef<HTMLCanvasElement>(null);
  const isDrawing = useRef(false);

  const loadPlans = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await apiPatient.auth.getUser();
      if (!user) return;

      // Get patient profile
      const { data: profile } = await apiPatient
        .from("patient_profiles" as never)
        .select("client_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!profile) return;
      const p = profile as { client_id: string; tenant_id: string };

      const { data, error } = await (apiPatient as any).rpc("get_client_treatment_plans", {
        p_tenant_id: p.tenant_id,
        p_client_id: p.client_id,
      });

      if (error) throw error;
      setPlans((data as TreatmentPlan[]) || []);
    } catch (err) {
      console.error("Erro ao carregar planos de tratamento:", err);
      toast.error("Erro ao carregar planos de tratamento", { description: normalizeError(err, "Não foi possível carregar seus planos. Tente novamente.") });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
  }, [loadPlans]);

  const loadPlanItems = async (planId: string) => {
    if (expandedPlan === planId) {
      setExpandedPlan(null);
      return;
    }
    setLoadingItems(true);
    setExpandedPlan(planId);
    try {
      const { data, error } = await (apiPatient as any).rpc("get_treatment_plan_with_items", {
        p_plan_id: planId,
      });
      if (error) throw error;
      const parsed = typeof data === "string" ? JSON.parse(data) : data;
      setPlanItems((parsed?.items as PlanItem[]) || []);
    } catch (err) {
      console.error("Erro ao carregar itens do plano:", err);
      toast.error("Erro ao carregar itens do plano", { description: normalizeError(err, "Não foi possível carregar os itens. Tente novamente.") });
    } finally {
      setLoadingItems(false);
    }
  };

  // Signature canvas
  const initCanvas = useCallback(() => {
    const canvas = signatureRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "#1a1a1a";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
  }, []);

  useEffect(() => {
    if (approveDialog.open) {
      setTimeout(initCanvas, 100);
    }
  }, [approveDialog.open, initCanvas]);

  const getCanvasPoint = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = signatureRef.current!;
    const rect = canvas.getBoundingClientRect();
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX;
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const onPointerDown = (e: React.MouseEvent | React.TouchEvent) => {
    isDrawing.current = true;
    const ctx = signatureRef.current?.getContext("2d");
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.beginPath();
    ctx.moveTo(pt.x, pt.y);
  };

  const onPointerMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing.current) return;
    const ctx = signatureRef.current?.getContext("2d");
    if (!ctx) return;
    const pt = getCanvasPoint(e);
    ctx.lineTo(pt.x, pt.y);
    ctx.stroke();
  };

  const onPointerUp = () => {
    isDrawing.current = false;
  };

  const clearSignature = () => {
    initCanvas();
  };

  const handleApprove = async () => {
    setIsSubmitting(true);
    try {
      const canvas = signatureRef.current;
      const signatureData = canvas ? canvas.toDataURL("image/png") : null;

      const { error } = await (apiPatient as any).rpc("approve_treatment_plan", {
        p_plan_id: approveDialog.planId,
        p_signature: signatureData,
        p_ip: null,
      });

      if (error) throw error;
      toast.success("Plano aprovado com sucesso!");
      setApproveDialog({ open: false, planId: "", title: "" });
      void loadPlans();
    } catch (err) {
      console.error("Erro ao aprovar plano:", err);
      toast.error("Erro ao aprovar plano", { description: normalizeError(err, "Não foi possível aprovar o plano. Tente novamente.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    setIsSubmitting(true);
    try {
      const { error } = await (apiPatient as any)
        .from("treatment_plans")
        .update({
          status: "cancelado",
          notes: `Recusado pelo paciente: ${rejectReason}`.trim(),
        } as never)
        .eq("id", rejectDialog.planId);

      if (error) throw error;
      toast.success("Plano recusado.");
      setRejectDialog({ open: false, planId: "", title: "" });
      setRejectReason("");
      void loadPlans();
    } catch (err) {
      console.error("Erro ao recusar plano:", err);
      toast.error("Erro ao recusar plano", { description: normalizeError(err, "Não foi possível recusar o plano. Tente novamente.") });
    } finally {
      setIsSubmitting(false);
    }
  };

  const canApprove = (status: string) => status === "pendente" || status === "apresentado";

  return (
    <PatientLayout
      title="Planos de Tratamento"
      subtitle="Visualize e aprove seus planos de tratamento"
    >
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => <Skeleton key={i} className="h-36 w-full rounded-xl" />)}
        </div>
      ) : plans.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum plano de tratamento"
          description="Quando seu dentista criar um plano de tratamento, ele aparecerá aqui para sua aprovação."
        />
      ) : (
        <div className="space-y-4">
          {plans.map((plan) => {
            const config = STATUS_CONFIG[plan.status] || STATUS_CONFIG.pendente;
            const progress = plan.items_count > 0 ? (plan.items_completed / plan.items_count) * 100 : 0;
            const isExpanded = expandedPlan === plan.id;

            return (
              <Card key={plan.id} className="overflow-hidden">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-teal-600 shrink-0" />
                        {plan.title}
                      </CardTitle>
                      <div className="flex flex-wrap gap-2 mt-1.5 text-xs text-muted-foreground">
                        {plan.plan_number && <span>#{plan.plan_number}</span>}
                        <span>Dr(a). {plan.professional_name}</span>
                        <span>{new Date(plan.created_at).toLocaleDateString("pt-BR")}</span>
                      </div>
                    </div>
                    <Badge className={cn("text-white text-xs shrink-0", config.color)}>
                      {config.label}
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-3">
                  {/* Progress + Values */}
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs mb-1">
                        <span>{plan.items_completed}/{plan.items_count} procedimentos</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold">{formatCurrency(plan.final_value)}</p>
                      {plan.total_value !== plan.final_value && (
                        <p className="text-xs text-muted-foreground line-through">{formatCurrency(plan.total_value)}</p>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    {canApprove(plan.status) && (
                      <>
                        <Button
                          size="sm"
                          className="gap-1"
                          onClick={() => setApproveDialog({ open: true, planId: plan.id, title: plan.title })}
                        >
                          <CheckCircle className="h-3.5 w-3.5" />
                          Aprovar Plano
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-red-600"
                          onClick={() => setRejectDialog({ open: true, planId: plan.id, title: plan.title })}
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          Recusar
                        </Button>
                      </>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="gap-1 ml-auto"
                      onClick={() => loadPlanItems(plan.id)}
                    >
                      {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                      {isExpanded ? "Ocultar" : "Ver Detalhes"}
                    </Button>
                  </div>

                  {/* Expanded items */}
                  {isExpanded && (
                    <div className="border-t pt-3 mt-2">
                      {loadingItems ? (
                        <Skeleton className="h-20 w-full" />
                      ) : planItems.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum item neste plano.</p>
                      ) : (
                        <div className="space-y-2">
                          {planItems.map((item) => {
                            const itemConfig = ITEM_STATUS[item.status] || ITEM_STATUS.pendente;
                            return (
                              <div key={item.id} className="flex items-center justify-between p-2 rounded bg-muted/30 text-sm">
                                <div className="flex-1 min-w-0">
                                  <span className="font-medium">{item.procedure_name}</span>
                                  {item.tooth_number && (
                                    <span className="text-xs text-muted-foreground ml-2">Dente {item.tooth_number}{item.surface ? ` (${item.surface})` : ""}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-3">
                                  <span className={cn("text-xs font-medium", itemConfig.color)}>{itemConfig.label}</span>
                                  <span className="text-xs font-mono">{formatCurrency(item.total_price)}</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Approve Dialog */}
      <Dialog open={approveDialog.open} onOpenChange={(open) => !isSubmitting && setApproveDialog({ ...approveDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Aprovar Plano de Tratamento</DialogTitle>
            <DialogDescription>
              Você está aprovando: <strong>{approveDialog.title}</strong>. 
              Assine abaixo para confirmar sua aprovação digital.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">Assinatura digital:</p>
            <div className="border rounded-lg overflow-hidden">
              <canvas
                ref={signatureRef}
                width={400}
                height={150}
                className="w-full cursor-crosshair touch-none"
                onMouseDown={onPointerDown}
                onMouseMove={onPointerMove}
                onMouseUp={onPointerUp}
                onMouseLeave={onPointerUp}
                onTouchStart={onPointerDown}
                onTouchMove={onPointerMove}
                onTouchEnd={onPointerUp}
              />
            </div>
            <Button variant="ghost" size="sm" onClick={clearSignature}>
              Limpar assinatura
            </Button>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApproveDialog({ open: false, planId: "", title: "" })} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button onClick={handleApprove} disabled={isSubmitting} className="gap-1">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle className="h-4 w-4" />}
              Confirmar Aprovação
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(open) => !isSubmitting && setRejectDialog({ ...rejectDialog, open })}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Recusar Plano de Tratamento</DialogTitle>
            <DialogDescription>
              Tem certeza que deseja recusar: <strong>{rejectDialog.title}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Motivo (opcional):</p>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Descreva o motivo da recusa..."
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, planId: "", title: "" })} disabled={isSubmitting}>
              Cancelar
            </Button>
            <Button variant="destructive" onClick={handleReject} disabled={isSubmitting} className="gap-1">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
              Confirmar Recusa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
