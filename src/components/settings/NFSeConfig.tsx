import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Eye,
  EyeOff,
  Loader2,
  ExternalLink,
  BookOpen,
  FileText,
  Upload,
  Building2,
  Shield,
  Calendar,
} from "lucide-react";
import {
  NFEioClient,
  certificadoParaBase64,
  validarCNPJ,
  formatarCNPJ,
  CODIGOS_SERVICO_CLINICA,
} from "@/lib/nfse-integration";

interface NFSeConfigProps {
  tenantId: string;
}

interface NFSeSettings {
  nfeio_api_key: string | null;
  nfeio_company_id: string | null;
  nfeio_active: boolean;
  nfeio_auto_emit: boolean;
  nfeio_default_service_code: string | null;
  nfeio_certificate_expires: string | null;
}

function StatusBadge({ status }: { status: "connected" | "disconnected" | "not_configured" }) {
  if (status === "connected") return <Badge className="bg-green-500/10 text-green-600 border-green-200">● Conectado</Badge>;
  if (status === "disconnected") return <Badge variant="secondary">● Desconectado</Badge>;
  return <Badge variant="outline" className="text-muted-foreground">Não configurado</Badge>;
}

export function NFSeConfig({ tenantId }: NFSeConfigProps) {
  const [settings, setSettings] = useState<NFSeSettings>({
    nfeio_api_key: null,
    nfeio_company_id: null,
    nfeio_active: false,
    nfeio_auto_emit: false,
    nfeio_default_service_code: "4.03",
    nfeio_certificate_expires: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [isUploadingCert, setIsUploadingCert] = useState(false);
  const [showApiKey, setShowApiKey] = useState(false);
  const [certPassword, setCertPassword] = useState("");
  const [showCertPassword, setShowCertPassword] = useState(false);

  // Form state
  const [apiKey, setApiKey] = useState("");
  const [companyId, setCompanyId] = useState("");
  const [autoEmit, setAutoEmit] = useState(false);
  const [defaultServiceCode, setDefaultServiceCode] = useState("4.03");

  useEffect(() => {
    const load = async () => {
      try {
        const { data } = await (supabase as any)
          .from("tenants")
          .select("nfeio_api_key, nfeio_company_id, nfeio_active, nfeio_auto_emit, nfeio_default_service_code, nfeio_certificate_expires")
          .eq("id", tenantId)
          .maybeSingle();
        
        if (data) {
          setSettings(data);
          setApiKey(data.nfeio_api_key ?? "");
          setCompanyId(data.nfeio_company_id ?? "");
          setAutoEmit(data.nfeio_auto_emit ?? false);
          setDefaultServiceCode(data.nfeio_default_service_code ?? "4.03");
        }
      } catch (e) {
        logger.error("[NFSeConfig] load error", e);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [tenantId]);

  const handleSave = async () => {
    if (!apiKey.trim()) {
      toast.error("Informe a API Key do NFE.io");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("tenants")
        .update({
          nfeio_api_key: apiKey.trim(),
          nfeio_company_id: companyId.trim() || null,
          nfeio_active: true,
          nfeio_auto_emit: autoEmit,
          nfeio_default_service_code: defaultServiceCode,
        })
        .eq("id", tenantId);

      if (error) throw error;

      setSettings({
        ...settings,
        nfeio_api_key: apiKey.trim(),
        nfeio_company_id: companyId.trim() || null,
        nfeio_active: true,
        nfeio_auto_emit: autoEmit,
        nfeio_default_service_code: defaultServiceCode,
      });

      toast.success("Configurações de NFS-e salvas!");
    } catch (e) {
      logger.error("[NFSeConfig] save error", e);
      toast.error("Erro ao salvar. Verifique se as colunas nfeio_* existem na tabela tenants.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestConnection = async () => {
    if (!apiKey.trim()) {
      toast.error("Informe a API Key primeiro");
      return;
    }

    setIsTestingConnection(true);
    try {
      const client = new NFEioClient({ apiKey: apiKey.trim() });
      const result = await client.listarEmpresas();
      
      if (result.companies && result.companies.length > 0) {
        toast.success(`Conexão OK! ${result.companies.length} empresa(s) encontrada(s).`);
        
        // Auto-fill company ID if only one
        if (result.companies.length === 1 && !companyId) {
          setCompanyId(result.companies[0].id || "");
          toast.info(`Empresa "${result.companies[0].name}" selecionada automaticamente.`);
        }
      } else {
        toast.warning("Conexão OK, mas nenhuma empresa cadastrada no NFE.io. Cadastre uma empresa primeiro.");
      }
    } catch (e: any) {
      logger.error("[NFSeConfig] test connection error", e);
      toast.error(`Erro na conexão: ${e.message}`);
    } finally {
      setIsTestingConnection(false);
    }
  };

  const handleUploadCertificate = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith(".pfx") && !file.name.endsWith(".p12")) {
      toast.error("Selecione um arquivo de certificado .pfx ou .p12");
      return;
    }

    if (!certPassword) {
      toast.error("Informe a senha do certificado");
      return;
    }

    if (!companyId) {
      toast.error("Informe o ID da empresa no NFE.io primeiro");
      return;
    }

    setIsUploadingCert(true);
    try {
      const base64 = await certificadoParaBase64(file);
      const client = new NFEioClient({ apiKey: apiKey.trim() });
      
      await client.uploadCertificado(companyId, {
        file: base64,
        password: certPassword,
      });

      // Verify certificate
      const certInfo = await client.verificarCertificado(companyId);
      
      if (certInfo.hasCertificate) {
        await (supabase as any)
          .from("tenants")
          .update({ nfeio_certificate_expires: certInfo.expiresOn })
          .eq("id", tenantId);

        setSettings({ ...settings, nfeio_certificate_expires: certInfo.expiresOn || null });
        toast.success("Certificado digital enviado com sucesso!");
        setCertPassword("");
      }
    } catch (e: any) {
      logger.error("[NFSeConfig] upload certificate error", e);
      toast.error(`Erro ao enviar certificado: ${e.message}`);
    } finally {
      setIsUploadingCert(false);
      e.target.value = "";
    }
  };

  const handleDisconnect = async () => {
    setIsSaving(true);
    try {
      await (supabase as any)
        .from("tenants")
        .update({
          nfeio_api_key: null,
          nfeio_company_id: null,
          nfeio_active: false,
          nfeio_auto_emit: false,
          nfeio_certificate_expires: null,
        })
        .eq("id", tenantId);

      setSettings({
        nfeio_api_key: null,
        nfeio_company_id: null,
        nfeio_active: false,
        nfeio_auto_emit: false,
        nfeio_default_service_code: "4.03",
        nfeio_certificate_expires: null,
      });
      setApiKey("");
      setCompanyId("");
      setAutoEmit(false);

      toast.success("Integração NFE.io removida.");
    } catch (e) {
      toast.error("Erro ao remover integração.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isConfigured = Boolean(settings.nfeio_api_key && settings.nfeio_company_id);
  const hasCertificate = Boolean(settings.nfeio_certificate_expires);
  const certExpired = settings.nfeio_certificate_expires 
    ? new Date(settings.nfeio_certificate_expires) < new Date() 
    : false;

  return (
    <div className="space-y-6">
      {/* Status Card */}
      <Card>
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center gap-4">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40">
              <FileText className="h-7 w-7 text-blue-600" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">NFS-e via NFE.io</p>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isConfigured 
                  ? hasCertificate 
                    ? "Pronto para emitir notas fiscais" 
                    : "Falta enviar certificado digital"
                  : "Não configurado"}
              </p>
            </div>
            <StatusBadge 
              status={isConfigured && hasCertificate && !certExpired ? "connected" : isConfigured ? "disconnected" : "not_configured"} 
            />
          </div>

          <Separator className="my-4" />

          <div className="space-y-4">
            {/* API Key */}
            <div className="space-y-1.5">
              <Label>API Key do NFE.io <span className="text-destructive">*</span></Label>
              <div className="flex gap-2">
                <Input
                  type={showApiKey ? "text" : "password"}
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Sua chave de API do NFE.io"
                  className="font-mono text-xs"
                />
                <Button variant="outline" size="icon" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={handleTestConnection}
                  disabled={isTestingConnection || !apiKey.trim()}
                >
                  {isTestingConnection ? <Loader2 className="h-4 w-4 animate-spin" /> : "Testar"}
                </Button>
              </div>
            </div>

            {/* Company ID */}
            <div className="space-y-1.5">
              <Label>ID da Empresa no NFE.io</Label>
              <Input
                value={companyId}
                onChange={(e) => setCompanyId(e.target.value)}
                placeholder="ID retornado ao cadastrar empresa no NFE.io"
                className="font-mono text-xs"
              />
              <p className="text-xs text-muted-foreground">
                Clique em "Testar" para listar empresas cadastradas. Se tiver apenas uma, será preenchido automaticamente.
              </p>
            </div>

            {/* Default Service Code */}
            <div className="space-y-1.5">
              <Label>Código de Serviço Padrão (LC 116)</Label>
              <select
                value={defaultServiceCode}
                onChange={(e) => setDefaultServiceCode(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {Object.entries(CODIGOS_SERVICO_CLINICA).map(([code, desc]) => (
                  <option key={code} value={code}>
                    {code} - {desc}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                Código mais comum para clínicas: 4.03 (Hospitais, clínicas, laboratórios...)
              </p>
            </div>

            {/* Auto emit toggle */}
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <p className="text-sm font-medium">Emissão automática</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Emitir NFS-e automaticamente quando um pagamento for confirmado
                </p>
              </div>
              <Switch checked={autoEmit} onCheckedChange={setAutoEmit} />
            </div>

            {/* Actions */}
            <div className="flex items-center justify-between gap-2">
              {isConfigured && (
                <Button
                  variant="outline"
                  size="sm"
                  className="text-destructive border-destructive/30 hover:bg-destructive/5 gap-1.5"
                  onClick={handleDisconnect}
                  disabled={isSaving}
                >
                  <XCircle className="h-4 w-4" /> Remover integração
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={isSaving || !apiKey.trim()}
                className="ml-auto gap-2"
              >
                {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                Salvar configurações
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Certificate Card */}
      {isConfigured && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Shield className="h-4 w-4" /> Certificado Digital A1
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {hasCertificate ? (
              <div className={`rounded-lg border p-4 flex items-center gap-3 ${certExpired ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950/30" : "border-green-200 bg-green-50 dark:border-green-800 dark:bg-green-950/30"}`}>
                {certExpired ? (
                  <XCircle className="h-5 w-5 text-red-500 shrink-0" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${certExpired ? "text-red-700 dark:text-red-300" : "text-green-700 dark:text-green-300"}`}>
                    {certExpired ? "Certificado expirado" : "Certificado válido"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Calendar className="h-3 w-3" />
                    Expira em: {new Date(settings.nfeio_certificate_expires!).toLocaleDateString("pt-BR")}
                  </p>
                </div>
                {certExpired && (
                  <Badge variant="destructive">Renovar</Badge>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/30 p-4 flex gap-3">
                <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700 dark:text-amber-300">
                  <p className="font-semibold">Certificado não enviado</p>
                  <p>Para emitir NFS-e, você precisa enviar o certificado digital A1 (.pfx) da sua empresa.</p>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <div className="space-y-1.5">
                <Label>Senha do certificado</Label>
                <div className="flex gap-2">
                  <Input
                    type={showCertPassword ? "text" : "password"}
                    value={certPassword}
                    onChange={(e) => setCertPassword(e.target.value)}
                    placeholder="Senha do arquivo .pfx"
                  />
                  <Button variant="outline" size="icon" onClick={() => setShowCertPassword(!showCertPassword)}>
                    {showCertPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="file"
                  accept=".pfx,.p12"
                  onChange={handleUploadCertificate}
                  className="hidden"
                  id="cert-upload"
                  disabled={isUploadingCert || !certPassword}
                />
                <Button
                  variant="outline"
                  className="gap-2"
                  onClick={() => document.getElementById("cert-upload")?.click()}
                  disabled={isUploadingCert || !certPassword}
                >
                  {isUploadingCert ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {hasCertificate ? "Substituir certificado" : "Enviar certificado (.pfx)"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* How to get credentials */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <BookOpen className="h-4 w-4" /> Como configurar
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-3 text-sm">
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">1</span>
              <div>
                <p className="font-medium">Crie uma conta no NFE.io</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Acesse <a href="https://app.nfe.io" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">app.nfe.io</a> e cadastre-se. O NFE.io cobre mais de 2.000 prefeituras brasileiras.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">2</span>
              <div>
                <p className="font-medium">Cadastre sua empresa</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  No painel do NFE.io, cadastre os dados da clínica (CNPJ, endereço, inscrição municipal).
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">3</span>
              <div>
                <p className="font-medium">Copie a API Key</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Vá em <span className="font-medium">Configurações → API</span> e copie sua chave de API.
                </p>
              </div>
            </li>
            <li className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">4</span>
              <div>
                <p className="font-medium">Envie o certificado digital</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Faça upload do certificado A1 (.pfx) da sua empresa. É necessário para assinar as notas fiscais.
                </p>
              </div>
            </li>
          </ol>

          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => window.open("https://nfe.io", "_blank")}
            >
              <ExternalLink className="h-3 w-3" /> Site NFE.io
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="gap-2 text-xs"
              onClick={() => window.open("https://nfe.io/docs", "_blank")}
            >
              <BookOpen className="h-3 w-3" /> Documentação
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Pricing info */}
      <div className="rounded-xl border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/30 p-4 flex gap-3">
        <Building2 className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
        <div className="text-xs text-blue-700 dark:text-blue-300 space-y-1">
          <p className="font-semibold">Sobre o NFE.io</p>
          <p>
            O NFE.io é um serviço intermediário que simplifica a emissão de NFS-e em mais de 2.000 prefeituras brasileiras. 
            O custo médio é de R$ 0,15 a R$ 0,30 por nota emitida. A clínica contrata diretamente com o NFE.io e configura 
            as credenciais aqui no ClinicNest.
          </p>
        </div>
      </div>
    </div>
  );
}
