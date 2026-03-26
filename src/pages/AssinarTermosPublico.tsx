import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { FacialCapture } from "@/components/consent/FacialCapture";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { getClientIp } from "@/utils/getClientIp";
import { replaceVariables, type ConsentVariablesData } from "@/lib/consent-variables";
import { sanitizeHtml } from "@/lib/sanitize-html";
import {
  ShieldCheck,
  FileText,
  CheckCircle2,
  Loader2,
  Lock,
  Camera,
  ChevronRight,
  AlertTriangle,
  Building2,
  Clock,
  XCircle,
} from "lucide-react";

interface Template {
  id: string;
  title: string;
  slug: string;
  body_html: string;
  is_required: boolean;
  template_type: "html" | "pdf";
  pdf_storage_path: string | null;
}

interface TokenData {
  valid: boolean;
  error?: string;
  all_signed?: boolean;
  token_id?: string;
  client?: {
    id: string;
    name: string;
    email: string;
    phone: string;
    cpf: string;
    date_of_birth: string;
    address: string;
  };
  tenant?: {
    name: string;
    cnpj: string;
    address: string;
    responsible_doctor: string;
    responsible_crm: string;
  };
  templates?: Template[];
  client_name?: string;
  clinic_name?: string;
}

export default function AssinarTermosPublico() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [tokenData, setTokenData] = useState<TokenData | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [capturedBlob, setCapturedBlob] = useState<Blob | null>(null);
  const [allDone, setAllDone] = useState(false);
  const [varsData, setVarsData] = useState<ConsentVariablesData>({});

  const validateToken = useCallback(async () => {
    if (!token) return;
    
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("validate_consent_token", {
        p_token: token,
      });

      if (error) {
        logger.error("[AssinarTermos] validate error", error);
        setTokenData({ valid: false, error: "Erro ao validar link" });
        return;
      }

      const result = data as TokenData;
      setTokenData(result);

      if (result.valid && !result.all_signed && result.templates) {
        setTemplates(result.templates);
        
        // Build variables for template replacement
        if (result.client && result.tenant) {
          setVarsData({
            nome_paciente: result.client.name,
            cpf: result.client.cpf || "",
            data_nascimento: result.client.date_of_birth 
              ? new Date(result.client.date_of_birth).toLocaleDateString("pt-BR")
              : "",
            email: result.client.email || "",
            telefone: result.client.phone || "",
            endereco_completo: result.client.address || "",
            nome_clinica: result.tenant.name || "",
            cnpj_clinica: result.tenant.cnpj || "",
            endereco_clinica: result.tenant.address || "",
            responsavel_tecnico: result.tenant.responsible_doctor || "",
            crm_responsavel: result.tenant.responsible_crm || "",
            data_hoje: new Date().toLocaleDateString("pt-BR"),
            cidade: "",
            estado: "",
          });
        }
      } else if (result.valid && result.all_signed) {
        setAllDone(true);
      }
    } catch (err) {
      logger.error("[AssinarTermos] validate catch", err);
      setTokenData({ valid: false, error: "Erro inesperado" });
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    validateToken();
  }, [validateToken]);

  const currentTemplate = templates[currentIndex] ?? null;

  const handleSign = async () => {
    if (!token || !currentTemplate || !tokenData?.client) return;

    if (!capturedBlob) {
      toast.error("Capture sua foto facial antes de assinar");
      return;
    }

    setIsSigning(true);
    try {
      // Determine storage folder: use auth.uid() if authenticated (matches RLS policy)
      let storageFolder = tokenData.client.id;
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (user?.id) storageFolder = user.id;
      } catch { /* anon — keep client.id */ }

      // 1) Upload facial photo
      const fileName = `${storageFolder}/${currentTemplate.id}_${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from("consent-photos")
        .upload(fileName, capturedBlob, { contentType: "image/jpeg", upsert: false });

      if (uploadError) {
        logger.error("[AssinarTermos] upload error", uploadError);
        toast.error("Erro ao enviar foto facial. Tente novamente.");
        setIsSigning(false);
        return;
      }

      // 2) Sign via RPC
      const clientIp = await getClientIp();
      const { data, error } = await supabase.rpc("sign_consent_via_token", {
        p_token: token,
        p_template_id: currentTemplate.id,
        p_facial_photo_path: fileName,
        p_ip_address: clientIp,
        p_user_agent: navigator.userAgent,
      });

      if (error) {
        logger.error("[AssinarTermos] sign error", error);
        toast.error("Erro ao registrar assinatura. Tente novamente.");
        setIsSigning(false);
        return;
      }

      const result = data as { success: boolean; error?: string; all_done?: boolean; remaining?: number; consent_id?: string };

      if (!result.success) {
        toast.error(result.error || "Erro ao assinar termo");
        setIsSigning(false);
        return;
      }

      toast.success(`Termo "${currentTemplate.title}" assinado com sucesso!`);

      // 3) Trigger seal-consent-pdf Edge Function (fire & forget)
      if (result.consent_id) {
        supabase.functions
          .invoke("seal-consent-pdf", { body: { consent_id: result.consent_id } })
          .then(({ error: sealErr }) => {
            if (sealErr) {
              logger.warn("[AssinarTermos] seal-consent-pdf failed (non-blocking)", sealErr);
            } else {
              logger.info("[AssinarTermos] seal-consent-pdf triggered", { consent_id: result.consent_id });
            }
          });
      }

      // Move to next or finish
      if (result.all_done) {
        setAllDone(true);
      } else if (currentIndex + 1 < templates.length) {
        setCurrentIndex((i) => i + 1);
        setCapturedBlob(null);
      } else {
        setAllDone(true);
      }
    } catch (err) {
      logger.error("[AssinarTermos] handleSign catch", err);
      toast.error("Erro inesperado ao assinar termo");
    } finally {
      setIsSigning(false);
    }
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4">
              <Spinner size="lg" className="text-teal-600" />
              <p className="text-sm text-muted-foreground">Validando link...</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Invalid token
  if (!tokenData?.valid) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200 dark:border-red-800">
          <CardContent className="py-12">
            <div className="flex flex-col items-center gap-4 text-center">
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 dark:bg-red-900">
                <XCircle className="h-8 w-8 text-red-600 dark:text-red-400" />
              </div>
              <h2 className="text-xl font-bold text-red-700 dark:text-red-300">
                Link Inválido
              </h2>
              <p className="text-sm text-muted-foreground max-w-xs">
                {tokenData?.error || "Este link não é válido ou já expirou."}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                <Clock className="h-4 w-4" />
                <span>Entre em contato com a clínica para solicitar um novo link.</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // All done
  if (allDone) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-green-50 to-emerald-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-green-200 dark:border-green-800">
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
              </p>
              {tokenData.tenant?.name && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                  <Building2 className="h-4 w-4" />
                  <span>{tokenData.tenant.name}</span>
                </div>
              )}
              <p className="text-xs text-muted-foreground mt-4">
                Você pode fechar esta página.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Signing flow
  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {tokenData.tenant?.name && (
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-4">
              <Building2 className="h-4 w-4" />
              <span>{tokenData.tenant.name}</span>
            </div>
          )}
          <div className="flex items-center justify-center gap-2">
            <Lock className="h-5 w-5 text-amber-500" />
            <h1 className="text-xl font-bold">Assinatura de Termos</h1>
          </div>
          {tokenData.client?.name && (
            <p className="text-sm text-muted-foreground">
              Olá, <strong>{tokenData.client.name}</strong>! Assine os termos abaixo com reconhecimento facial.
            </p>
          )}
          <div className="flex items-center justify-center gap-2 mt-2">
            {templates.map((_, i) => (
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
            Termo {currentIndex + 1} de {templates.length}
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
                {currentTemplate.is_required && (
                  <Badge className="ml-auto bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">
                    Obrigatório
                  </Badge>
                )}
              </div>
            </CardHeader>
            <Separator />
            <CardContent className="py-6">
              {/* Term content */}
              {currentTemplate.template_type === "pdf" ? (
                <div className="border rounded-lg p-6 bg-muted/30 text-center">
                  <FileText className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground mb-3">
                    Este termo está em formato PDF.
                  </p>
                  {currentTemplate.pdf_storage_path && (
                    <Button
                      variant="outline"
                      onClick={async () => {
                        const { data } = await supabase.storage
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
                  dangerouslySetInnerHTML={{ __html: sanitizeHtml(replaceVariables(currentTemplate.body_html, varsData)) }}
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

        {/* Footer */}
        <div className="text-center text-xs text-muted-foreground">
          <p>Assinatura digital com reconhecimento facial</p>
          <p className="mt-1">Seus dados estão protegidos conforme a LGPD</p>
        </div>
      </div>
    </div>
  );
}
