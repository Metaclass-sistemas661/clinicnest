import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Pill,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  Plus,
  CalendarDays,
  RefreshCw,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface RefillRequest {
  id: string;
  medication_name: string;
  reason: string | null;
  status: string;
  reviewer_notes: string | null;
  reviewed_at: string | null;
  created_at: string;
}

const STATUS_CONFIG: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  pending: { label: "Pendente", icon: Clock, color: "bg-amber-100 text-amber-700 border-amber-300" },
  approved: { label: "Aprovado", icon: CheckCircle, color: "bg-green-100 text-green-700 border-green-300" },
  rejected: { label: "Recusado", icon: XCircle, color: "bg-red-100 text-red-700 border-red-300" },
  scheduled: { label: "Agendado", icon: CalendarDays, color: "bg-blue-100 text-blue-700 border-blue-300" },
};

export default function PatientRefillRequest() {
  const [medicationName, setMedicationName] = useState("");
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [history, setHistory] = useState<RefillRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabasePatient
        .from("patient_profiles" as never)
        .select("client_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .single();

      if (!profile) return;
      const pp = profile as { client_id: string; tenant_id: string };
      setPatientId(pp.client_id);
      setTenantId(pp.tenant_id);

      const { data: requests } = await supabasePatient
        .from("prescription_refill_requests" as never)
        .select("id, medication_name, reason, status, reviewer_notes, reviewed_at, created_at")
        .eq("patient_id", pp.client_id)
        .order("created_at", { ascending: false })
        .limit(20);

      if (requests) setHistory(requests as unknown as RefillRequest[]);
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSubmit = async () => {
    if (!patientId || !tenantId || !medicationName.trim()) return;
    setIsSubmitting(true);

    try {
      const { error } = await supabasePatient
        .from("prescription_refill_requests" as never)
        .insert({
          tenant_id: tenantId,
          patient_id: patientId,
          medication_name: medicationName.trim(),
          reason: reason.trim() || null,
          status: "pending",
        } as never);

      if (error) throw error;

      toast.success("Pedido enviado! Seu médico será notificado.");
      setMedicationName("");
      setReason("");
      setShowForm(false);
      loadData();
    } catch {
      toast.error("Erro ao enviar pedido. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const pendingCount = history.filter((r) => r.status === "pending").length;

  return (
    <PatientLayout title="Renovação de Receitas" subtitle="Solicite a renovação dos seus medicamentos">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* New request button */}
        {!showForm && (
          <Button onClick={() => setShowForm(true)} className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Solicitar Renovação de Receita
          </Button>
        )}

        {/* Form */}
        {showForm && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Pill className="h-5 w-5 text-teal-600" />
                Nova Solicitação de Renovação
              </CardTitle>
              <CardDescription>
                Informe o medicamento e o profissional avaliará se aprova a renovação.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nome do Medicamento *</Label>
                <Input
                  value={medicationName}
                  onChange={(e) => setMedicationName(e.target.value)}
                  placeholder="Ex: Losartana 50mg, Metformina 850mg..."
                />
              </div>
              <div className="space-y-2">
                <Label>Motivo (opcional)</Label>
                <Textarea
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Medicamento acabou, preciso continuar o tratamento..."
                  rows={2}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmit}
                  disabled={!medicationName.trim() || isSubmitting}
                  className="flex-1 gap-2"
                >
                  {isSubmitting ? (
                    <><Loader2 className="h-4 w-4 animate-spin" /> Enviando...</>
                  ) : (
                    <><Send className="h-4 w-4" /> Enviar Pedido</>
                  )}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)}>
                  Cancelar
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Pending alert */}
        {pendingCount > 0 && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-700 text-sm">
            <Clock className="h-4 w-4 shrink-0" />
            <span>
              Você tem {pendingCount} pedido{pendingCount > 1 ? "s" : ""} aguardando análise do profissional.
            </span>
          </div>
        )}

        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <RefreshCw className="h-5 w-5 text-teal-600" />
              Histórico de Solicitações
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
              </div>
            ) : history.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">
                Nenhuma solicitação ainda.
              </p>
            ) : (
              <div className="space-y-3">
                {history.map((req) => {
                  const conf = STATUS_CONFIG[req.status] || STATUS_CONFIG.pending;
                  const Icon = conf.icon;
                  return (
                    <div key={req.id} className="flex items-start gap-3 p-3 rounded-lg border">
                      <Icon className={cn("h-5 w-5 mt-0.5 shrink-0", conf.color.split(" ")[1])} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-sm">{req.medication_name}</span>
                          <Badge variant="outline" className={cn("text-xs", conf.color)}>
                            {conf.label}
                          </Badge>
                        </div>
                        {req.reason && (
                          <p className="text-xs text-muted-foreground mt-0.5">{req.reason}</p>
                        )}
                        {req.reviewer_notes && (
                          <p className="text-xs mt-1 bg-muted/50 p-1.5 rounded">
                            <strong>Resposta:</strong> {req.reviewer_notes}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground mt-1">
                          {new Date(req.created_at).toLocaleDateString("pt-BR", {
                            day: "2-digit", month: "short", year: "numeric",
                          })}
                          {req.reviewed_at && (
                            <> · Revisado em {new Date(req.reviewed_at).toLocaleDateString("pt-BR")}</>
                          )}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PatientLayout>
  );
}
