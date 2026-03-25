import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FacialCapture } from "@/components/consent/FacialCapture";
import { SignatureMethodSelector, type SignatureMethod } from "@/components/signature/SignatureMethodSelector";
import { SignatureCanvas } from "@/components/signature/SignatureCanvas";
import { toast } from "sonner";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { replaceVariables, buildVariablesFromClientAndTenant, type ConsentVariablesData } from "@/lib/consent-variables";
import type { ConsentTemplate } from "@/types/database";
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Loader2,
  Lock,
  Camera,
  ChevronRight,
  ArrowLeft,
} from "lucide-react";

export default function PatientConsentSigning() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [pendingTemplates, setPendingTemplates] = useState<ConsentTemplate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [authUserId, setAuthUserId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [varsData, setVarsData] = useState<ConsentVariablesData>({});

  // Hybrid signature state
  type Step = "read" | "choose-method" | "capture";
  const [step, setStep] = useState<Step>("read");
  const [signatureMethod, setSignatureMethod] = useState<SignatureMethod | null>(null);
  const [manualSignatureDataUrl, setManualSignatureDataUrl] = useState<string | null>(null);

  // Resolve the patient's patient_id from their auth user
  const resolveClientId = useCallback(async () => {
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return null;

      setAuthUserId(user.id);

      const email = user.email;
      if (!email) return null;

      const { data, error } = await supabasePatient
        .from("patients")
        .select("id, tenant_id, name, cpf, date_of_birth, birth_date, email, phone, street, street_number, neighborhood, city, state, zip_code, address_street, address_city, address_state, address_zip")
        .eq("email", email)
        .limit(1)
        .maybeSingle();

      if (error || !data) {
        logger.warn("[PatientConsent] Could not resolve patient_id for email", email);
        return null;
      }

      let tenantData: any = null;
      if (data.tenant_id) {
        const { data: t } = await supabasePatient
          .from("tenants")
          .select("name, cnpj, address, responsible_doctor, responsible_crm")
          .eq("id", data.tenant_id)
          .maybeSingle();
        tenantData = t;
      }

      setVarsData(buildVariablesFromClientAndTenant(data as any, tenantData));
      return data.id as string;
    } catch (err) {
      logger.error("[PatientConsent] resolveClientId error", err);
      return null;
    }
  }, []);

  const fetchPending = useCallback(async (cId: string) => {
    try {
      const { data, error } = await supabasePatient.rpc("get_pending_consents", {
        p_client_id: cId,
      });
      if (error) throw error;
      return (data as unknown as ConsentTemplate[]) ?? [];
    } catch (err) {
      logger.error("[PatientConsent] fetchPending error", err);
      return [];
    }
  }, []);

  useEffect(() => {
    const init = async () => {
      setIsLoading(true);
      const cId = await resolveClientId();
      if (!cId) {
        setIsLoading(false);
        return;
      }
      setPatientId(cId);
      const pending = await fetchPending(cId);
      setPendingTemplates(pending);
      if (pending.length === 0) {
        setAllDone(true);
      }
      setIsLoading(false);
    };
    init();
  }, [resolveClientId, fetchPending]);

  const currentTemplate = pendingTemplates[currentIndex] ?? null;

  const handleSign = async () => {
    if (!patientId || !currentTemplate) return;

    // Validate based on method
    if (signatureMethod === "facial" && !capturedBlob) {
      toast.error("Capture sua foto facial antes de assinar");
      return;
    }
    if (signatureMethod === "manual" && !manualSignatureDataUrl) {
      toast.error("Desenhe sua assinatura antes de confirmar");
      return;
    }

    setIsSigning(true);
    try {
      // Resolve auth user ID at sign time (state may lag on mount)
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

      let facialPhotoPath: string | null = null;
      let manualSignaturePath: string | null = null;

      if (signatureMethod === "facial" && capturedBlob) {
        // Upload facial photo — use auth user ID as folder (matches RLS policy)
        const fileName = `${resolvedAuthId}/${currentTemplate.id}_${Date.now()}.jpg`;
        const { error: uploadError } = await supabasePatient.storage
          .from("consent-photos")
          .upload(fileName, capturedBlob, { contentType: "image/jpeg", upsert: false });

        if (uploadError) {
          logger.error("[PatientConsent] upload facial error", uploadError);
          toast.error("Erro ao enviar foto facial. Tente novamente.");
          setIsSigning(false);
          return;
        }
        facialPhotoPath = fileName;
      } else if (signatureMethod === "manual" && manualSignatureDataUrl) {
        // Convert data URL to blob and upload
        const res = await fetch(manualSignatureDataUrl);
        const blob = await res.blob();
        const fileName = `${resolvedAuthId}/${currentTemplate.id}_${Date.now()}.png`;
        const { error: uploadError } = await supabasePatient.storage
          .from("consent-signatures")
          .upload(fileName, blob, { contentType: "image/png", upsert: false });

        if (uploadError) {
          logger.error("[PatientConsent] upload signature error", uploadError);
          toast.error("Erro ao enviar assinatura. Tente novamente.");
          setIsSigning(false);
          return;
        }
        manualSignaturePath = fileName;
      }

      // Try v2 first (hybrid), fallback to v1
      const rpcName = signatureMethod === "manual" ? "sign_consent_v2" : "sign_consent";
      const rpcParams = signatureMethod === "manual"
        ? {
            p_client_id: patientId,
            p_template_id: currentTemplate.id,
            p_signature_method: "manual" as const,
            p_facial_photo_path: null,
            p_manual_signature_path: manualSignaturePath,
            p_ip_address: null,
            p_user_agent: navigator.userAgent,
          }
        : {
            p_client_id: patientId,
            p_template_id: currentTemplate.id,
            p_facial_photo_path: facialPhotoPath,
            p_ip_address: null,
            p_user_agent: navigator.userAgent,
          };

      const { data, error } = await supabasePatient.rpc(rpcName as any, rpcParams as any);

      if (error) {
        logger.error("[PatientConsent] sign error", error);
        toast.error("Erro ao registrar assinatura. Tente novamente.");
        setIsSigning(false);
        return;
      }

      // 3) Update snapshot with patient data filled in (juridical proof)
      const filledHtml = replaceVariables(currentTemplate.body_html, varsData);
      const consentId = (data as any)?.consent_id;
      if (consentId) {
        await supabasePatient
          .from("patient_consents")
          .update({ template_snapshot_html: filledHtml })
          .eq("id", consentId);

        // 4) Trigger seal-consent-pdf Edge Function (fire & forget)
        supabasePatient.functions
          .invoke("seal-consent-pdf", { body: { consent_id: consentId } })
          .then(({ error: sealErr }) => {
            if (sealErr) {
              logger.warn("[PatientConsent] seal-consent-pdf failed (non-blocking)", sealErr);
            }
          });
      }

      toast.success(`Termo "${currentTemplate.title}" assinado com sucesso!`);

      // Move to next or finish
      if (currentIndex + 1 < pendingTemplates.length) {
        setCurrentIndex((i) => i + 1);
        setCapturedBlob(null);
        setManualSignatureDataUrl(null);
        setSignatureMethod(null);
        setStep("read");
      } else {
        setAllDone(true);
      }
    } catch (err) {
      logger.error("[PatientConsent] handleSign error", err);
      toast.error("Erro inesperado ao assinar termo");
    } finally {
      setIsSigning(false);
    }
  };

  const handleContinue = () => {
    navigate("/paciente/dashboard", { replace: true });
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-2xl">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" className="text-teal-600" />
              <p className="text-sm text-muted-foreground">Verificando termos pendentes...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // No patient_id found
  if (!patientId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <ShieldCheck className="h-12 w-12 text-muted-foreground/40" />
              <h2 className="text-lg font-semibold">Cadastro não vinculado</h2>
              <p className="text-sm text-muted-foreground">
                Seu cadastro ainda não foi vinculado a uma clínica.
                Entre em contato com a clínica para vincular seu acesso.
              </p>
              <Button variant="outline" onClick={() => navigate("/paciente/dashboard")}>
                Voltar ao Início
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All done
  if (allDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="w-full max-w-lg border-green-200 dark:border-green-800">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900">
                <CheckCircle2 className="h-8 w-8 text-green-600 dark:text-green-400" />
              </div>
              <h2 className="text-xl font-bold text-green-700 dark:text-green-300">
                Todos os termos foram assinados!
              </h2>
              <p className="text-sm text-muted-foreground">
                Obrigado por assinar os termos de consentimento.
                Agora você tem acesso completo ao portal do paciente.
              </p>
              <Button
                className="mt-2 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleContinue}
              >
                Acessar o Portal
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signing flow
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold">Assinatura de Termos Obrigatórios</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Para acessar o portal, é necessário assinar os termos abaixo com reconhecimento facial.
          </p>
          <div className="flex items-center justify-center gap-2 mt-2">
            {pendingTemplates.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all ${
                  i < currentIndex
                    ? "w-8 bg-green-500"
                    : i === currentIndex
                    ? "w-8 bg-teal-600"
                    : "w-4 bg-muted"
                }`}
              />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            Termo {currentIndex + 1} de {pendingTemplates.length}
          </p>
        </div>

        {/* Current term */}
        {currentTemplate && (
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900 flex-shrink-0">
                  <FileText className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                </div>
                <div>
                  <CardTitle className="text-base">{currentTemplate.title}</CardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {step === "read" && "Leia o termo abaixo com atenção antes de assinar"}
                    {step === "choose-method" && "Escolha como deseja assinar este termo"}
                    {step === "capture" && (signatureMethod === "facial" ? "Capture sua foto facial" : "Desenhe sua assinatura")}
                  </p>
                </div>
                <Badge className="ml-auto bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                  Obrigatório
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="py-6">
              {/* Step 1: Read the document */}
              {step === "read" && (
                <div className="space-y-6">
                  {currentTemplate.template_type === "pdf" ? (
                    <div className="border rounded-lg p-6 bg-muted/30 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground mb-3">
                        Este termo está em formato PDF. Leia com atenção antes de assinar.
                      </p>
                      {currentTemplate.pdf_storage_path && (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const { data } = await supabasePatient.storage
                              .from("consent-pdfs")
                              .createSignedUrl(currentTemplate.pdf_storage_path!, 300);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
                        >
                          Abrir PDF para Leitura
                        </Button>
                      )}
                    </div>
                  ) : currentTemplate.body_html?.trim() ? (
                    <div
                      className="prose prose-sm dark:prose-invert max-w-none max-h-[40vh] overflow-y-auto border rounded-lg p-6 bg-muted/30"
                      dangerouslySetInnerHTML={{ __html: replaceVariables(currentTemplate.body_html, varsData) }}
                    />
                  ) : (
                    <div className="border rounded-lg p-6 bg-muted/30 text-center">
                      <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">
                        O conteúdo deste termo não foi configurado pela clínica.
                        Entre em contato com a clínica para mais informações.
                      </p>
                    </div>
                  )}
                  <div className="flex justify-center">
                    <Button
                      onClick={() => setStep("choose-method")}
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
              {step === "choose-method" && (
                <div className="space-y-6">
                  <SignatureMethodSelector
                    onSelect={(method) => {
                      setSignatureMethod(method);
                      setCapturedBlob(null);
                      setManualSignatureDataUrl(null);
                      setStep("capture");
                    }}
                    disabled={isSigning}
                  />
                  <div className="flex justify-center">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setStep("read")}
                      className="gap-2 text-muted-foreground"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Voltar ao termo
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 3: Capture */}
              {step === "capture" && signatureMethod === "facial" && (
                <div className="space-y-6">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Camera className="h-4 w-4 text-teal-600" />
                      <h3 className="font-semibold text-sm">Reconhecimento Facial</h3>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Capture uma foto do seu rosto como prova de identidade.
                    </p>
                    <FacialCapture
                      onCapture={(blob) => setCapturedBlob(blob)}
                      disabled={isSigning}
                    />
                  </div>

                  <Separator />

                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs text-center text-muted-foreground max-w-md">
                      Ao assinar, declaro que li e compreendi o conteúdo do termo e concordo com todos os termos descritos.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setStep("choose-method"); setCapturedBlob(null); }}
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
                    {!capturedBlob && (
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        Capture sua foto facial acima para habilitar a assinatura
                      </p>
                    )}
                  </div>
                </div>
              )}

              {step === "capture" && signatureMethod === "manual" && (
                <div className="space-y-6">
                  <SignatureCanvas
                    patientName={varsData.patient_name as string ?? "Paciente"}
                    onComplete={(dataUrl) => setManualSignatureDataUrl(dataUrl)}
                    onClear={() => setManualSignatureDataUrl(null)}
                    disabled={isSigning}
                  />

                  <Separator />

                  <div className="flex flex-col items-center gap-3">
                    <p className="text-xs text-center text-muted-foreground max-w-md">
                      Ao assinar, declaro que li e compreendi o conteúdo do termo e concordo com todos os termos descritos.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => { setStep("choose-method"); setManualSignatureDataUrl(null); }}
                        className="gap-2"
                      >
                        <ArrowLeft className="h-4 w-4" />
                        Trocar método
                      </Button>
                      <Button
                        onClick={handleSign}
                        disabled={isSigning || !manualSignatureDataUrl}
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
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
