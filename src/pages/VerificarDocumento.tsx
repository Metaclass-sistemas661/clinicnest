import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { logger } from "@/lib/logger";
import { 
  CheckCircle2, 
  XCircle, 
  FileText, 
  User, 
  Calendar, 
  Shield, 
  Loader2,
  AlertTriangle,
  Home,
  Hash
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface VerificationResult {
  found: boolean;
  valid: boolean;
  document_type?: string;
  doc_subtype?: string;
  signed_at?: string;
  signer_name?: string;
  signer_crm?: string;
  signer_uf?: string;
  created_at?: string;
  patient_initials?: string;
  hash?: string;
  message: string;
}

const documentTypeLabels: Record<string, string> = {
  medical_certificate: "Atestado Médico",
  prescription: "Receituário",
  medical_record: "Prontuário",
  clinical_evolution: "Evolução Clínica",
  exam_request: "Solicitação de Exame",
  medical_report: "Laudo Médico",
};

const certificateTypeLabels: Record<string, string> = {
  atestado_medico: "Atestado Médico",
  atestado_comparecimento: "Atestado de Comparecimento",
  atestado_acompanhante: "Atestado de Acompanhante",
  declaracao: "Declaração",
  laudo: "Laudo Médico",
};

const prescriptionTypeLabels: Record<string, string> = {
  simples: "Receita Simples",
  especial: "Receita Especial",
  controle_especial: "Receita de Controle Especial",
  antimicrobiano: "Receita de Antimicrobiano",
};

export default function VerificarDocumento() {
  const { hash } = useParams<{ hash: string }>();
  const [loading, setLoading] = useState(true);
  const [result, setResult] = useState<VerificationResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function verifyDocument() {
      if (!hash) {
        setError("Hash não fornecido");
        setLoading(false);
        return;
      }

      try {
        const { data, error: rpcError } = await supabase.rpc("verify_document_public", {
          p_hash: hash,
          p_verifier_ip: null,
          p_verifier_user_agent: navigator.userAgent,
        });

        if (rpcError) throw rpcError;
        setResult(data as VerificationResult);
      } catch (err) {
        logger.error("Verification error:", err);
        setError("Erro ao verificar documento. Tente novamente.");
      } finally {
        setLoading(false);
      }
    }

    verifyDocument();
  }, [hash]);

  const getSubtypeLabel = (docType: string, subtype: string) => {
    if (docType === "medical_certificate") {
      return certificateTypeLabels[subtype] || subtype;
    }
    if (docType === "prescription") {
      return prescriptionTypeLabels[subtype] || subtype;
    }
    return subtype;
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container max-w-2xl mx-auto py-8 px-4">
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-4">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-2xl font-bold">ClinicaFlow</h1>
          </div>
          <p className="text-muted-foreground">
            Verificação de Autenticidade de Documentos
          </p>
        </div>

        {loading && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Loader2 className="h-12 w-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Verificando documento...</p>
            </CardContent>
          </Card>
        )}

        {error && (
          <Card className="border-destructive">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertTriangle className="h-12 w-12 text-destructive mb-4" />
              <p className="text-destructive font-medium">{error}</p>
              <Button variant="outline" className="mt-4" asChild>
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Voltar ao início
                </Link>
              </Button>
            </CardContent>
          </Card>
        )}

        {result && !loading && (
          <>
            {result.valid ? (
              <Card className="border-green-500 dark:border-green-600">
                <CardHeader className="bg-green-50 dark:bg-green-950/30 rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-10 w-10 text-green-600" />
                    <div>
                      <CardTitle className="text-green-700 dark:text-green-400">
                        Documento Válido
                      </CardTitle>
                      <CardDescription className="text-green-600 dark:text-green-500">
                        {result.message}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6 space-y-4">
                  <div className="grid gap-4">
                    <div className="flex items-start gap-3">
                      <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Tipo de Documento</p>
                        <p className="font-medium">
                          {documentTypeLabels[result.document_type || ""] || result.document_type}
                        </p>
                        {result.doc_subtype && (
                          <Badge variant="secondary" className="mt-1">
                            {getSubtypeLabel(result.document_type || "", result.doc_subtype)}
                          </Badge>
                        )}
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Profissional Responsável</p>
                        <p className="font-medium">{result.signer_name}</p>
                        <p className="text-sm text-muted-foreground">
                          CRM {result.signer_crm}/{result.signer_uf}
                        </p>
                      </div>
                    </div>

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Data da Assinatura</p>
                        <p className="font-medium">
                          {result.signed_at
                            ? format(new Date(result.signed_at), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", {
                                locale: ptBR,
                              })
                            : "N/A"}
                        </p>
                      </div>
                    </div>

                    {result.patient_initials && (
                      <>
                        <Separator />
                        <div className="flex items-start gap-3">
                          <User className="h-5 w-5 text-muted-foreground mt-0.5" />
                          <div>
                            <p className="text-sm text-muted-foreground">Paciente</p>
                            <p className="font-medium">{result.patient_initials}</p>
                            <p className="text-xs text-muted-foreground">
                              (iniciais para privacidade)
                            </p>
                          </div>
                        </div>
                      </>
                    )}

                    <Separator />

                    <div className="flex items-start gap-3">
                      <Hash className="h-5 w-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="text-sm text-muted-foreground">Hash de Verificação</p>
                        <p className="font-mono text-xs break-all bg-muted p-2 rounded mt-1">
                          {result.hash}
                        </p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="border-red-500 dark:border-red-600">
                <CardHeader className="bg-red-50 dark:bg-red-950/30 rounded-t-lg">
                  <div className="flex items-center gap-3">
                    <XCircle className="h-10 w-10 text-red-600" />
                    <div>
                      <CardTitle className="text-red-700 dark:text-red-400">
                        {result.found ? "Documento Não Assinado" : "Documento Não Encontrado"}
                      </CardTitle>
                      <CardDescription className="text-red-600 dark:text-red-500">
                        {result.message}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div>
                        <p className="font-medium text-amber-800 dark:text-amber-400">
                          Atenção
                        </p>
                        <p className="text-sm text-amber-700 dark:text-amber-500 mt-1">
                          Este documento pode ser inválido, falsificado ou ainda não foi assinado
                          digitalmente. Entre em contato com a clínica emissora para confirmar
                          a autenticidade.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4">
                    <p className="text-sm text-muted-foreground">Hash consultado:</p>
                    <p className="font-mono text-xs break-all bg-muted p-2 rounded mt-1">
                      {hash}
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="mt-6 text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Esta verificação foi registrada em nosso sistema para fins de auditoria.
              </p>
              <Button variant="outline" asChild>
                <Link to="/">
                  <Home className="h-4 w-4 mr-2" />
                  Ir para ClinicaFlow
                </Link>
              </Button>
            </div>
          </>
        )}

        <footer className="mt-12 text-center text-sm text-muted-foreground">
          <p>
            Sistema de verificação de documentos médicos assinados digitalmente.
          </p>
          <p className="mt-1">
            Conforme CFM 2.299/2021 e ICP-Brasil.
          </p>
        </footer>
      </div>
    </div>
  );
}
