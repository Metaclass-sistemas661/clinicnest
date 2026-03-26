/**
 * Viewer de Bundles FHIR recebidos via RNDS.
 * Lista bundles pendentes de revisão, permite aceitar/rejeitar,
 * e visualiza conteúdo clínico extraído (diagnósticos, vitais, medicamentos).
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Download,
  Eye,
  CheckCircle2,
  XCircle,
  Clock,
  Building2,
  User,
  FileJson,
  Activity,
  Pill,
  Stethoscope,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Inbox,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { parseFhirBundle, type ParsedBundle } from "@/utils/fhirBundleParser";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { useAuth } from "@/contexts/AuthContext";

interface IncomingBundle {
  id: string;
  bundle_type: string;
  fhir_bundle: Record<string, unknown>;
  bundle_id: string | null;
  source_cnes: string | null;
  source_name: string | null;
  source_uf: string | null;
  patient_cpf: string | null;
  patient_name: string | null;
  matched_patient_id: string | null;
  resource_types: string[] | null;
  resource_count: number;
  review_status: string;
  reviewed_by: string | null;
  reviewed_at: string | null;
  review_notes: string | null;
  received_at: string;
  error_message: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline"; icon: typeof Clock }> = {
  pending: { label: "Pendente", variant: "secondary", icon: Clock },
  reviewed: { label: "Revisado", variant: "outline", icon: Eye },
  accepted: { label: "Aceito", variant: "default", icon: CheckCircle2 },
  rejected: { label: "Rejeitado", variant: "destructive", icon: XCircle },
  merged: { label: "Integrado", variant: "default", icon: CheckCircle2 },
};

export function RNDSIncomingBundles() {
  const { profile } = useAuth();
  const [bundles, setBundles] = useState<IncomingBundle[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedBundle, setSelectedBundle] = useState<IncomingBundle | null>(null);
  const [parsedBundle, setParsedBundle] = useState<ParsedBundle | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  const loadBundles = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("incoming_rnds_bundles")
        .select("*")
        .order("received_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setBundles((data as IncomingBundle[]) || []);
    } catch (err) {
      toast.error("Erro ao carregar bundles", { description: normalizeError(err) });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { loadBundles(); }, [loadBundles]);

  const openBundle = (bundle: IncomingBundle) => {
    setSelectedBundle(bundle);
    setReviewNotes(bundle.review_notes || "");
    try {
      const parsed = parseFhirBundle(bundle.fhir_bundle as any);
      setParsedBundle(parsed);
    } catch {
      setParsedBundle(null);
    }
  };

  const handleReview = async (status: "accepted" | "rejected") => {
    if (!selectedBundle || !profile?.id) return;
    setIsProcessing(true);
    try {
      const { error } = await supabase
        .from("incoming_rnds_bundles")
        .update({
          review_status: status,
          reviewed_by: profile.id,
          reviewed_at: new Date().toISOString(),
          review_notes: reviewNotes || null,
        })
        .eq("id", selectedBundle.id);

      if (error) throw error;

      toast.success(status === "accepted" ? "Bundle aceito" : "Bundle rejeitado");
      setSelectedBundle(null);
      setParsedBundle(null);
      loadBundles();
    } catch (err) {
      toast.error("Erro ao processar revisão", { description: normalizeError(err) });
    } finally {
      setIsProcessing(false);
    }
  };

  const pendingCount = bundles.filter((b) => b.review_status === "pending").length;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Download className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Dados Recebidos (RNDS Bidirecional)</CardTitle>
              <CardDescription>
                Bundles FHIR recebidos de outros estabelecimentos
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {pendingCount > 0 && (
              <Badge variant="secondary">{pendingCount} pendente{pendingCount > 1 ? "s" : ""}</Badge>
            )}
            <Button variant="outline" size="sm" onClick={loadBundles} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground">
            <Loader2 className="h-6 w-6 animate-spin mx-auto mb-2" />
            Carregando...
          </div>
        ) : bundles.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <Inbox className="h-8 w-8 mx-auto mb-2 opacity-50" />
            <p>Nenhum bundle recebido ainda</p>
            <p className="text-xs mt-1">
              Configure o endpoint do webhook para receber dados de outros estabelecimentos
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[500px]">
            <div className="space-y-2">
              {bundles.map((bundle) => {
                const statusCfg = STATUS_CONFIG[bundle.review_status] || STATUS_CONFIG.pending;
                const StatusIcon = statusCfg.icon;

                return (
                  <div
                    key={bundle.id}
                    className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                    onClick={() => openBundle(bundle)}
                  >
                    <FileJson className="h-5 w-5 text-blue-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium truncate">
                          {bundle.patient_name || "Paciente não identificado"}
                        </span>
                        {bundle.matched_patient_id && (
                          <Badge variant="outline" className="text-[9px] px-1 border-green-300 text-green-700">
                            Vinculado
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        {bundle.source_name && (
                          <span className="flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {bundle.source_name}
                          </span>
                        )}
                        {bundle.source_cnes && <span>CNES: {bundle.source_cnes}</span>}
                        <span>{bundle.resource_count} recurso{bundle.resource_count > 1 ? "s" : ""}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant={statusCfg.variant} className="text-[10px] gap-1">
                        <StatusIcon className="h-3 w-3" />
                        {statusCfg.label}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(bundle.received_at).toLocaleDateString("pt-BR")}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>

      {/* ── Detail Dialog ── */}
      <Dialog open={!!selectedBundle} onOpenChange={(open) => !open && setSelectedBundle(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileJson className="h-5 w-5 text-blue-500" />
              Bundle FHIR Recebido
            </DialogTitle>
            <DialogDescription>
              {selectedBundle?.patient_name && (
                <span className="flex items-center gap-1">
                  <User className="h-3 w-3" />
                  {selectedBundle.patient_name}
                  {selectedBundle.patient_cpf && ` · CPF: ${selectedBundle.patient_cpf.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.***.***-$4")}`}
                </span>
              )}
            </DialogDescription>
          </DialogHeader>

          {parsedBundle && (
            <div className="space-y-4">
              {/* Origem */}
              {selectedBundle?.source_name && (
                <div className="rounded-lg border p-3 bg-muted/20">
                  <div className="flex items-center gap-2 text-sm">
                    <Building2 className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{selectedBundle.source_name}</span>
                    {selectedBundle.source_cnes && (
                      <Badge variant="outline" className="text-[10px]">CNES {selectedBundle.source_cnes}</Badge>
                    )}
                    {selectedBundle.source_uf && (
                      <Badge variant="outline" className="text-[10px]">{selectedBundle.source_uf}</Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Diagnósticos */}
              {parsedBundle.conditions.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Stethoscope className="h-3.5 w-3.5" />
                    Diagnósticos ({parsedBundle.conditions.length})
                  </h4>
                  <div className="space-y-1">
                    {parsedBundle.conditions.map((c, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="outline" className="text-[10px] shrink-0">{c.code || "N/C"}</Badge>
                        <span>{c.display || "Sem descrição"}</span>
                        {c.recordedDate && (
                          <span className="text-xs text-muted-foreground ml-auto">
                            {new Date(c.recordedDate).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Observações/Vitais */}
              {parsedBundle.observations.length > 0 && (
                <div>
                  <Separator className="mb-3" />
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Activity className="h-3.5 w-3.5" />
                    Observações / Sinais Vitais ({parsedBundle.observations.length})
                  </h4>
                  <div className="space-y-1">
                    {parsedBundle.observations.map((o, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="font-medium">{o.display || o.code || "Observação"}</span>
                        {o.value != null && (
                          <span className="text-muted-foreground">
                            {o.value} {o.unit || ""}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Medicamentos */}
              {parsedBundle.medications.length > 0 && (
                <div>
                  <Separator className="mb-3" />
                  <h4 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Pill className="h-3.5 w-3.5" />
                    Medicamentos ({parsedBundle.medications.length})
                  </h4>
                  <div className="space-y-1">
                    {parsedBundle.medications.map((m, i) => (
                      <div key={i} className="text-sm">
                        <span className="font-medium">{m.name || "Medicamento"}</span>
                        {m.dosage && <span className="text-muted-foreground ml-1">— {m.dosage}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Alergias */}
              {parsedBundle.allergies.length > 0 && (
                <div>
                  <Separator className="mb-3" />
                  <h4 className="text-xs font-semibold uppercase text-red-600 flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    Alergias ({parsedBundle.allergies.length})
                  </h4>
                  <div className="space-y-1">
                    {parsedBundle.allergies.map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <Badge variant="destructive" className="text-[10px]">{a.criticality || "?"}</Badge>
                        <span>{a.substance || "Substância desconhecida"}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Errors */}
              {parsedBundle.errors.length > 0 && (
                <div className="rounded-lg border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                  <p className="font-semibold mb-1">Alertas do parser:</p>
                  {parsedBundle.errors.map((e, i) => <p key={i}>• {e}</p>)}
                </div>
              )}

              {/* Resource types */}
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground pt-2 border-t">
                Recursos: {parsedBundle.resourceTypes.join(", ")}
              </div>
            </div>
          )}

          {/* Review notes */}
          {selectedBundle?.review_status === "pending" && (
            <div className="space-y-2 pt-2">
              <Separator />
              <Textarea
                placeholder="Observações da revisão (opcional)..."
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                rows={2}
                className="text-sm"
              />
            </div>
          )}

          <DialogFooter>
            {selectedBundle?.review_status === "pending" && (
              <div className="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleReview("rejected")}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <XCircle className="h-4 w-4 mr-1" />}
                  Rejeitar
                </Button>
                <Button
                  size="sm"
                  onClick={() => handleReview("accepted")}
                  disabled={isProcessing}
                >
                  {isProcessing ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <CheckCircle2 className="h-4 w-4 mr-1" />}
                  Aceitar
                </Button>
              </div>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
