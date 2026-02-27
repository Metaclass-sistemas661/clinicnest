import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { FacialCapture } from "@/components/consent/FacialCapture";
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
} from "lucide-react";

export default function PatientConsentSigning() {
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [pendingTemplates, setPendingTemplates] = useState<ConsentTemplate[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [patientId, setPatientId] = useState<string | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [varsData, setVarsData] = useState<ConsentVariablesData>({});

  // Resolve the patient's patient_id from their auth user
  const resolveClientId = useCallback(async () => {
    try {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return null;

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

    if (!capturedBlob) {
      toast.error("Capture sua foto facial antes de assinar");
      return;
    }

    setIsSigning(true);
    try {
      // 1) Upload facial photo to storage
      const fileName = `${patientId}/${currentTemplate.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabasePatient.storage
        .from("consent-photos")
        .upload(fileName, capturedBlob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) {
        logger.error("[PatientConsent] upload error", uploadError);
        toast.error("Erro ao enviar foto facial. Tente novamente.");
        setIsSigning(false);
        return;
      }

      // 2) Sign the consent via RPC
      const { data, error } = await supabasePatient.rpc("sign_consent", {
        p_client_id: patientId,
        p_template_id: currentTemplate.id,
        p_facial_photo_path: fileName,
        p_ip_address: null,
        p_user_agent: navigator.userAgent,
      });

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
      }

      toast.success(`Termo "${currentTemplate.title}" assinado com sucesso!`);

      // Move to next or finish
      if (currentIndex + 1 < pendingTemplates.length) {
        setCurrentIndex((i) => i + 1);
        setCapturedBlob(null);
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
              <Loader2 className="h-8 w-8 animate-spin text-teal-600" />
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
                    Leia o termo abaixo com atenção antes de assinar
                  </p>
                </div>
                <Badge className="ml-auto bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                  Obrigatório
                </Badge>
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="py-6">
              {/* Term content */}
              <div
                className="prose prose-sm dark:prose-invert max-w-none max-h-[40vh] overflow-y-auto border rounded-lg p-6 bg-muted/30"
                dangerouslySetInnerHTML={{ __html: replaceVariables(currentTemplate.body_html, varsData) }}
              />

              <Separator className="my-6" />

              {/* Facial capture */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-teal-600" />
                  <h3 className="font-semibold text-sm">Assinatura com Reconhecimento Facial</h3>
                </div>
                <p className="text-xs text-muted-foreground">
                  Para validar sua assinatura, capture uma foto do seu rosto usando a câmera.
                  Esta foto será armazenada como prova de aceite junto com a data, hora e versão do termo.
                </p>

                <FacialCapture
                  onCapture={(blob) => setCapturedBlob(blob)}
                  disabled={isSigning}
                />
              </div>

              <Separator className="my-6" />

              {/* Sign button */}
              <div className="flex flex-col items-center gap-3">
                <p className="text-xs text-center text-muted-foreground max-w-md">
                  Ao clicar em "Assinar Termo", declaro que li e compreendi o conteúdo acima
                  e concordo com todos os termos descritos.
                </p>
                <Button
                  onClick={handleSign}
                  disabled={isSigning || !capturedBlob}
                  className="bg-teal-600 hover:bg-teal-700 text-white min-w-[200px]"
                  size="lg"
                >
                  {isSigning ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando assinatura...</>
                  ) : (
                    <><ShieldCheck className="mr-2 h-4 w-4" />Assinar Termo</>
                  )}
                </Button>
                {!capturedBlob && (
                  <p className="text-xs text-amber-600 dark:text-amber-400">
                    Capture sua foto facial acima para habilitar a assinatura
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
