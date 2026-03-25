import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { EmptyState } from "@/components/ui/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  FileText,
  RefreshCw,
  Download,
  PenTool,
  CheckCircle2,
  Clock,
  Loader2,
  ShieldCheck,
  ChevronRight,
  ArrowLeft,
  Eye,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { SignatureMethodSelector, type SignatureMethod } from "@/components/signature/SignatureMethodSelector";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";
import { FacialCapture } from "@/components/consent/FacialCapture";
import { replaceVariables, buildVariablesFromClientAndTenant, type ConsentVariablesData } from "@/lib/consent-variables";

/* ── Types ── */
interface ConsentRow {
  template_id: string;
  title: string;
  body_html: string;
  is_required: boolean;
  template_type: string | null;
  sort_order: number;
  consent_id: string | null;
  signed_at: string | null;
  signature_method: string | null;
  sealed_pdf_path: string | null;
  is_signed: boolean;
}

/* ── Component ── */
export default function PatientDocumentos() {
  const [consents, setConsents] = useState<ConsentRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");

  // Patient info
  const [patientId, setPatientId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [patientName, setPatientName] = useState("Paciente");
  const [varsData, setVarsData] = useState<ConsentVariablesData>({});

  // Signing dialog state
  const [signTarget, setSignTarget] = useState<ConsentRow | null>(null);
  type SignStep = "read" | "choose-method" | "capture";
  const [signStep, setSignStep] = useState<SignStep>("read");
  const [signMethod, setSignMethod] = useState<SignatureMethod | null>(null);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [manualDataUrl, setManualDataUrl] = useState<string | null>(null);
  const [isSigning, setIsSigning] = useState(false);

  // View dialog state
  const [viewTarget, setViewTarget] = useState<ConsentRow | null>(null);

  const resolvePatient = useCallback(async () => {
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return null;
      setAuthUserId(user.id);
      const { data } = await (supabasePatient as any)
        .from("patients")
        .select("id, tenant_id, name, cpf, date_of_birth, birth_date, email, phone, street, street_number, neighborhood, city, state, zip_code, address_street, address_city, address_state, address_zip")
        .eq("email", user.email!)
        .limit(1)
        .maybeSingle();
      if (!data) return null;

      let tenantData: any = null;
      if (data.tenant_id) {
        const { data: t } = await (supabasePatient as any)
          .from("tenants")
          .select("name, cnpj, address, responsible_doctor, responsible_crm")
          .eq("id", data.tenant_id)
          .maybeSingle();
        tenantData = t;
      }

      setVarsData(buildVariablesFromClientAndTenant(data as any, tenantData));
      setPatientId(data.id);
      setPatientName(data.name || "Paciente");
      return data.id as string;
    } catch {
      return null;
    }
  }, []);

  const fetchConsents = useCallback(async (pId: string) => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_all_consents", {
        p_patient_id: pId,
      });
      if (error) throw error;
      const rows = (data as ConsentRow[]) ?? [];
      setConsents(rows);

      // Auto-trigger seal for signed consents without PDF (fire & forget)
      for (const c of rows) {
        if (c.is_signed && c.consent_id && !c.sealed_pdf_path) {
          supabasePatient.functions
            .invoke("seal-consent-pdf", { body: { consent_id: c.consent_id } })
            .then(({ error: sealErr }) => {
              if (!sealErr) {
                // Refresh to show updated PDF path
                setConsents((prev) =>
                  prev.map((p) =>
                    p.consent_id === c.consent_id
                      ? { ...p, sealed_pdf_path: "pending" }
                      : p
                  )
                );
              } else {
                logger.warn("[PatientDocumentos] auto-seal failed:", c.consent_id, sealErr);
              }
            });
        }
      }
    } catch (err) {
      logger.error("PatientDocumentos fetchConsents:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      const pId = await resolvePatient();
      if (pId) void fetchConsents(pId);
      else setIsLoading(false);
    };
    void init();
  }, [resolvePatient, fetchConsents]);

  const pending = consents.filter((c) => !c.is_signed);
  const signed = consents.filter((c) => c.is_signed);
  const filtered = activeTab === "all" ? consents
    : activeTab === "pending" ? pending
    : signed;

  // ── Signing flow ──

  const openSignDialog = (consent: ConsentRow) => {
    setSignTarget(consent);
    setSignStep("read");
    setSignMethod(null);
    setCapturedBlob(null);
    setManualDataUrl(null);
  };

  const closeSignDialog = () => {
    setSignTarget(null);
    setSignStep("read");
    setSignMethod(null);
    setCapturedBlob(null);
    setManualDataUrl(null);
  };

  const handleSign = async () => {
    if (!signTarget || !patientId) return;

    if (signMethod === "facial" && !capturedBlob) {
      toast.error("Capture sua foto facial antes de assinar");
      return;
    }
    if (signMethod === "manual" && !manualDataUrl) {
      toast.error("Desenhe sua assinatura antes de confirmar");
      return;
    }

    setIsSigning(true);
    try {
      let facialPhotoPath: string | null = null;
      let manualSignaturePath: string | null = null;

      // Resolve auth user ID for storage folder (matches RLS policy)
      let resolvedAuthId = authUserId;
      if (!resolvedAuthId) {
        const { data: { user: freshUser } } = await supabasePatient.auth.getUser();
        resolvedAuthId = freshUser?.id ?? null;
        if (resolvedAuthId) setAuthUserId(resolvedAuthId);
      }
      if (!resolvedAuthId) {
        toast.error("Sessão expirada. Faça login novamente.");
        setIsSigning(false);
        return;
      }

      if (signMethod === "facial" && capturedBlob) {
        const fileName = `${resolvedAuthId}/${signTarget.template_id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabasePatient.storage
          .from("consent-photos")
          .upload(fileName, capturedBlob, { contentType: "image/jpeg", upsert: false });
        if (uploadError) throw uploadError;
        facialPhotoPath = fileName;
      } else if (signMethod === "manual" && manualDataUrl) {
        const res = await fetch(manualDataUrl);
        const blob = await res.blob();
        const fileName = `${resolvedAuthId}/${signTarget.template_id}_${Date.now()}.png`;
        const { error: uploadError } = await supabasePatient.storage
          .from("consent-signatures")
          .upload(fileName, blob, { contentType: "image/png", upsert: false });
        if (uploadError) throw uploadError;
        manualSignaturePath = fileName;
      }

      // Use sign_consent_v2 for hybrid support
      const rpcName = signMethod === "manual" ? "sign_consent_v2" : "sign_consent";
      const rpcParams = signMethod === "manual"
        ? {
            p_client_id: patientId,
            p_template_id: signTarget.template_id,
            p_signature_method: "manual" as const,
            p_facial_photo_path: null,
            p_manual_signature_path: manualSignaturePath,
            p_ip_address: null,
            p_user_agent: navigator.userAgent,
          }
        : {
            p_client_id: patientId,
            p_template_id: signTarget.template_id,
            p_facial_photo_path: facialPhotoPath,
            p_ip_address: null,
            p_user_agent: navigator.userAgent,
          };

      const { data, error } = await supabasePatient.rpc(rpcName as any, rpcParams as any);
      if (error) throw error;

      const result = data as any;

      // Update snapshot with filled variables
      const consentId = result?.consent_id;
      if (consentId) {
        const filledHtml = replaceVariables(signTarget.body_html, varsData);
        await (supabasePatient as any)
          .from("patient_consents")
          .update({ template_snapshot_html: filledHtml })
          .eq("id", consentId);

        // Trigger seal-consent-pdf (fire & forget)
        supabasePatient.functions
          .invoke("seal-consent-pdf", { body: { consent_id: consentId } })
          .then(({ error: sealErr }) => {
            if (sealErr) logger.warn("[PatientDocumentos] seal-consent-pdf:", sealErr);
          });
      }

      toast.success(`Termo "${signTarget.title}" assinado com sucesso!`);

      // Refresh consents list
      closeSignDialog();
      void fetchConsents(patientId);
    } catch (err: any) {
      logger.error("PatientDocumentos sign:", err);
      toast.error(err?.message || "Erro ao assinar termo");
    } finally {
      setIsSigning(false);
    }
  };

  const handleDownloadSealedPdf = async (consent: ConsentRow) => {
    if (!consent.sealed_pdf_path) return;
    try {
      const { data, error } = await supabasePatient.storage
        .from("consent-sealed-pdfs")
        .createSignedUrl(consent.sealed_pdf_path, 300);
      if (error) throw error;
      window.open(data.signedUrl, "_blank");
    } catch (err: any) {
      logger.error("Download sealed PDF:", err);
      toast.error("Erro ao baixar PDF. Tente novamente.");
    }
  };

  return (
    <PatientLayout
      title="Documentos"
      subtitle="Termos de consentimento e contratos"
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={() => patientId && void fetchConsents(patientId)}
          disabled={isLoading}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="w-full justify-start overflow-x-auto">
          <TabsTrigger value="all">
            Todos ({consents.length})
          </TabsTrigger>
          <TabsTrigger value="pending">
            <Clock className="h-3.5 w-3.5 mr-1.5" />
            Pendentes ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="signed">
            <CheckCircle2 className="h-3.5 w-3.5 mr-1.5" />
            Assinados ({signed.length})
          </TabsTrigger>
        </TabsList>

        {["all", "pending", "signed"].map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-0">
            {isLoading ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <Card key={i}>
                    <CardContent className="py-4">
                      <Skeleton className="h-5 w-48 mb-2" />
                      <Skeleton className="h-4 w-64" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filtered.length === 0 ? (
              <EmptyState
                icon={FileText}
                title={
                  tab === "pending"
                    ? "Nenhum termo pendente"
                    : tab === "signed"
                    ? "Nenhum termo assinado"
                    : "Nenhum documento encontrado"
                }
                description={
                  tab === "pending"
                    ? "Todos os termos de consentimento já foram assinados."
                    : "Quando a clínica cadastrar termos de consentimento ou contratos, eles aparecerão aqui."
                }
              />
            ) : (
              <div className="space-y-4">
                {filtered.map((c) => (
                  <Card
                    key={c.template_id}
                    className={`hover:shadow-md transition-shadow ${!c.is_signed ? "border-amber-200 dark:border-amber-800" : ""}`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between flex-wrap gap-2">
                        <CardTitle className="text-base flex items-center gap-2">
                          <FileText className={`h-4 w-4 ${c.is_signed ? "text-green-500" : "text-amber-500"}`} />
                          {c.title}
                        </CardTitle>
                        <div className="flex items-center gap-2">
                          {c.is_required && (
                            <Badge variant="destructive" className="text-xs">Obrigatório</Badge>
                          )}
                          {c.is_signed ? (
                            <Badge variant="default" className="bg-green-600 gap-1">
                              <CheckCircle2 className="h-3 w-3" />
                              Assinado
                            </Badge>
                          ) : (
                            <Badge variant="secondary" className="gap-1 text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-900/30">
                              <Clock className="h-3 w-3" />
                              Pendente
                            </Badge>
                          )}
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {c.is_signed && c.signed_at && (
                        <p className="text-xs text-muted-foreground">
                          Assinado em {format(new Date(c.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          {c.signature_method === "facial" && " — Reconhecimento facial"}
                          {c.signature_method === "manual" && " — Assinatura manual"}
                        </p>
                      )}

                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5"
                          onClick={() => setViewTarget(c)}
                        >
                          <Eye className="h-3.5 w-3.5" />
                          Visualizar
                        </Button>

                        {c.is_signed && c.sealed_pdf_path && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5"
                            onClick={() => void handleDownloadSealedPdf(c)}
                          >
                            <Download className="h-3.5 w-3.5" />
                            Baixar PDF
                          </Button>
                        )}

                        {!c.is_signed && (
                          <Button
                            size="sm"
                            variant="default"
                            className="gap-1.5 bg-teal-600 hover:bg-teal-700"
                            onClick={() => openSignDialog(c)}
                          >
                            <PenTool className="h-3.5 w-3.5" />
                            Assinar
                          </Button>
                        )}

                        {c.is_signed && !c.signature_method && !c.sealed_pdf_path && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 border-amber-300 text-amber-700 hover:bg-amber-50 dark:border-amber-700 dark:text-amber-300"
                            onClick={() => openSignDialog({ ...c, is_signed: false })}
                          >
                            <PenTool className="h-3.5 w-3.5" />
                            Reassinar
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* ── View Dialog ── */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => !open && setViewTarget(null)}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-teal-500" />
              {viewTarget?.title}
            </DialogTitle>
            <DialogDescription>
              {viewTarget?.is_signed
                ? `Assinado em ${viewTarget.signed_at ? format(new Date(viewTarget.signed_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : ""}`
                : "Pendente de assinatura"}
            </DialogDescription>
          </DialogHeader>
          {viewTarget && (
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-muted/30"
              dangerouslySetInnerHTML={{
                __html: replaceVariables(viewTarget.body_html, varsData),
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* ── Signing Dialog ── */}
      <Dialog open={!!signTarget} onOpenChange={(open) => !open && closeSignDialog()}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PenTool className="h-5 w-5 text-teal-500" />
              Assinar Termo
            </DialogTitle>
            <DialogDescription>
              {signTarget?.title}
              {signTarget?.is_required && " — Obrigatório"}
            </DialogDescription>
          </DialogHeader>

          {signTarget && (
            <>
              {/* Step 1: Read the document */}
              {signStep === "read" && (
                <div className="space-y-6">
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none max-h-[40vh] overflow-y-auto border rounded-lg p-6 bg-muted/30"
                    dangerouslySetInnerHTML={{
                      __html: replaceVariables(signTarget.body_html, varsData),
                    }}
                  />
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setSignStep("choose-method")}
                      className="bg-teal-600 hover:bg-teal-700 text-white min-w-[200px]"
                      size="lg"
                    >
                      Li e concordo — Prosseguir
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2: Choose signature method */}
              {signStep === "choose-method" && (
                <div className="space-y-6">
                  <SignatureMethodSelector
                    onSelect={(method) => {
                      setSignMethod(method);
                      setCapturedBlob(null);
                      setManualDataUrl(null);
                      setSignStep("capture");
                    }}
                    disabled={isSigning}
                  />
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSignStep("read")}
                      className="gap-2 text-muted-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar ao termo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Facial capture */}
              {signStep === "capture" && signMethod === "facial" && (
                <div className="space-y-6">
                  <FacialCapture
                    onCapture={(blob: Blob) => setCapturedBlob(blob)}
                    disabled={isSigning}
                  />

                  <Separator />

                  <p className="text-xs text-center text-muted-foreground max-w-md mx-auto">
                    Ao assinar, declaro que li e compreendi o conteúdo do termo e concordo
                    com todos os termos descritos.
                  </p>

                  <div className="flex justify-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSignStep("choose-method"); setCapturedBlob(null); }}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Trocar método
                    </Button>
                    <Button
                      onClick={handleSign}
                      disabled={isSigning || !capturedBlob}
                      className="bg-teal-600 hover:bg-teal-700 text-white min-w-[200px]"
                      size="lg"
                    >
                      {isSigning ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</>
                      ) : (
                        <><ShieldCheck className="mr-2 h-4 w-4" />Assinar Termo</>
                      )}
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Manual signature */}
              {signStep === "capture" && signMethod === "manual" && (
                <div className="space-y-6">
                  <SignatureCanvas
                    patientName={patientName}
                    onComplete={(dataUrl) => setManualDataUrl(dataUrl)}
                    onClear={() => setManualDataUrl(null)}
                    disabled={isSigning}
                  />

                  <Separator />

                  <p className="text-xs text-center text-muted-foreground max-w-md mx-auto">
                    Ao assinar, declaro que li e compreendi o conteúdo do termo e concordo
                    com todos os termos descritos.
                  </p>

                  <div className="flex justify-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => { setSignStep("choose-method"); setManualDataUrl(null); }}
                      className="gap-2"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Trocar método
                    </Button>
                    <Button
                      onClick={handleSign}
                      disabled={isSigning || !manualDataUrl}
                      className="bg-teal-600 hover:bg-teal-700 text-white min-w-[200px]"
                      size="lg"
                    >
                      {isSigning ? (
                        <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</>
                      ) : (
                        <><ShieldCheck className="mr-2 h-4 w-4" />Assinar Termo</>
                      )}
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
