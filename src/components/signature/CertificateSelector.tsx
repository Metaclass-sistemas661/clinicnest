import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { 
  KeyRound, 
  CreditCard, 
  Cloud, 
  RefreshCw, 
  AlertTriangle, 
  CheckCircle2,
  ExternalLink,
  Loader2,
  ShieldCheck,
  Info
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import {
  initWebPki,
  getWebPkiInstallUrl,
  formatCertificateName,
  isCertificateValid,
  listA3Certificates,
  type WebPkiCertificate,
  type WebPkiStatus,
} from "@/lib/webpki-integration";
import {
  isAuthenticated as isBirdIdAuthenticated,
  getAuthorizationUrl,
  listCloudCertificates,
  formatBirdIdCertificateName,
  isBirdIdCertificateValid,
  type BirdIdCertificate,
} from "@/lib/birdid-integration";

export type CertificateType = "A1" | "A3" | "cloud";

export interface SelectedCertificate {
  type: CertificateType;
  id: string;
  name: string;
  thumbprint?: string;
  cpf?: string;
  validTo: Date;
}

interface CertificateSelectorProps {
  onSelect: (certificate: SelectedCertificate | null) => void;
  selectedCertificate?: SelectedCertificate | null;
  showA1?: boolean;
  showA3?: boolean;
  showCloud?: boolean;
}

interface A1Certificate {
  id: string;
  common_name: string;
  cpf_cnpj: string | null;
  issuer: string;
  not_after: string;
  thumbprint: string;
  is_default: boolean;
  is_active: boolean;
}

export function CertificateSelector({
  onSelect,
  selectedCertificate,
  showA1 = true,
  showA3 = true,
  showCloud = true,
}: CertificateSelectorProps) {
  const [certificateType, setCertificateType] = useState<CertificateType>("A1");
  
  const [a1Certificates, setA1Certificates] = useState<A1Certificate[]>([]);
  const [a1Loading, setA1Loading] = useState(false);
  
  const [webPkiStatus, setWebPkiStatus] = useState<WebPkiStatus>("checking");
  const [a3Certificates, setA3Certificates] = useState<WebPkiCertificate[]>([]);
  const [a3Loading, setA3Loading] = useState(false);
  
  const [cloudAuthenticated, setCloudAuthenticated] = useState(false);
  const [cloudCertificates, setCloudCertificates] = useState<BirdIdCertificate[]>([]);
  const [cloudLoading, setCloudLoading] = useState(false);

  const loadA1Certificates = useCallback(async () => {
    setA1Loading(true);
    try {
      const { data, error } = await supabase.rpc("list_my_certificates");
      if (error) throw error;
      
      const certs = data?.certificates || [];
      setA1Certificates(certs);
      
      if (certs.length > 0 && !selectedCertificate) {
        const defaultCert = certs.find((c: A1Certificate) => c.is_default) || certs[0];
        onSelect({
          type: "A1",
          id: defaultCert.id,
          name: defaultCert.common_name,
          thumbprint: defaultCert.thumbprint,
          cpf: defaultCert.cpf_cnpj || undefined,
          validTo: new Date(defaultCert.not_after),
        });
      }
    } catch (err) {
      logger.error("Error loading A1 certificates:", err);
    } finally {
      setA1Loading(false);
    }
  }, [onSelect, selectedCertificate]);

  const loadA3Certificates = useCallback(async () => {
    setA3Loading(true);
    try {
      const status = await initWebPki();
      setWebPkiStatus(status);
      
      if (status === "ready") {
        const certs = await listA3Certificates();
        setA3Certificates(certs.filter(isCertificateValid));
      }
    } catch (err) {
      logger.error("Error loading A3 certificates:", err);
    } finally {
      setA3Loading(false);
    }
  }, []);

  const loadCloudCertificates = useCallback(async () => {
    setCloudLoading(true);
    try {
      const authenticated = isBirdIdAuthenticated();
      setCloudAuthenticated(authenticated);
      
      if (authenticated) {
        const certs = await listCloudCertificates();
        setCloudCertificates(certs.filter(isBirdIdCertificateValid));
      }
    } catch (err) {
      logger.error("Error loading cloud certificates:", err);
    } finally {
      setCloudLoading(false);
    }
  }, []);

  useEffect(() => {
    if (showA1) loadA1Certificates();
  }, [showA1, loadA1Certificates]);

  useEffect(() => {
    if (showA3 && certificateType === "A3") {
      loadA3Certificates();
    }
  }, [showA3, certificateType, loadA3Certificates]);

  useEffect(() => {
    if (showCloud && certificateType === "cloud") {
      loadCloudCertificates();
    }
  }, [showCloud, certificateType, loadCloudCertificates]);

  const handleTypeChange = (type: CertificateType) => {
    setCertificateType(type);
    onSelect(null);
  };

  const handleA1Select = (cert: A1Certificate) => {
    onSelect({
      type: "A1",
      id: cert.id,
      name: cert.common_name,
      thumbprint: cert.thumbprint,
      cpf: cert.cpf_cnpj || undefined,
      validTo: new Date(cert.not_after),
    });
  };

  const handleA3Select = (cert: WebPkiCertificate) => {
    onSelect({
      type: "A3",
      id: cert.thumbprint,
      name: formatCertificateName(cert),
      thumbprint: cert.thumbprint,
      cpf: cert.pkiBrazil?.cpf,
      validTo: cert.validTo,
    });
  };

  const handleCloudSelect = (cert: BirdIdCertificate) => {
    onSelect({
      type: "cloud",
      id: cert.id,
      name: formatBirdIdCertificateName(cert),
      cpf: cert.cpf,
      validTo: cert.validTo,
    });
  };

  const handleBirdIdLogin = () => {
    const authUrl = getAuthorizationUrl();
    window.location.href = authUrl;
  };

  const getCertificateStatusBadge = (validTo: Date) => {
    const now = new Date();
    const daysUntilExpiry = Math.ceil((validTo.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    
    if (daysUntilExpiry <= 0) {
      return <Badge variant="destructive">Expirado</Badge>;
    }
    if (daysUntilExpiry <= 30) {
      return <Badge variant="outline" className="border-amber-500 text-amber-600">Expira em {daysUntilExpiry}d</Badge>;
    }
    return <Badge variant="outline" className="border-green-500 text-green-600">Válido</Badge>;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          Selecionar Certificado Digital
        </CardTitle>
        <CardDescription>
          Escolha o tipo de certificado ICP-Brasil para assinatura digital
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <RadioGroup
          value={certificateType}
          onValueChange={(v) => handleTypeChange(v as CertificateType)}
          className="grid grid-cols-3 gap-4"
        >
          {showA1 && (
            <div>
              <RadioGroupItem value="A1" id="type-a1" className="peer sr-only" />
              <Label
                htmlFor="type-a1"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <KeyRound className="mb-3 h-6 w-6" />
                <span className="font-medium">Certificado A1</span>
                <span className="text-xs text-muted-foreground mt-1">Arquivo .pfx/.p12</span>
              </Label>
            </div>
          )}
          
          {showA3 && (
            <div>
              <RadioGroupItem value="A3" id="type-a3" className="peer sr-only" />
              <Label
                htmlFor="type-a3"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <CreditCard className="mb-3 h-6 w-6" />
                <span className="font-medium">Certificado A3</span>
                <span className="text-xs text-muted-foreground mt-1">Token/Cartão</span>
              </Label>
            </div>
          )}
          
          {showCloud && (
            <div>
              <RadioGroupItem value="cloud" id="type-cloud" className="peer sr-only" />
              <Label
                htmlFor="type-cloud"
                className="flex flex-col items-center justify-between rounded-md border-2 border-muted bg-popover p-4 hover:bg-accent hover:text-accent-foreground peer-data-[state=checked]:border-primary [&:has([data-state=checked])]:border-primary cursor-pointer"
              >
                <Cloud className="mb-3 h-6 w-6" />
                <span className="font-medium">Certificado Nuvem</span>
                <span className="text-xs text-muted-foreground mt-1">BirdID/RemoteID</span>
              </Label>
            </div>
          )}
        </RadioGroup>

        <Separator />

        {/* Certificados A1 */}
        {certificateType === "A1" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Certificados A1 Cadastrados</h4>
              <Button variant="ghost" size="sm" onClick={loadA1Certificates} disabled={a1Loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${a1Loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {a1Loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : a1Certificates.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Nenhum certificado A1 cadastrado. Vá em Configurações → Certificados para adicionar.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {a1Certificates.map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => handleA1Select(cert)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCertificate?.id === cert.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <KeyRound className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{cert.common_name}</p>
                        <p className="text-xs text-muted-foreground">
                          Válido até {format(new Date(cert.not_after), "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {cert.is_default && <Badge variant="secondary">Padrão</Badge>}
                      {getCertificateStatusBadge(new Date(cert.not_after))}
                      {selectedCertificate?.id === cert.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Certificados A3 */}
        {certificateType === "A3" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Certificados A3 Detectados</h4>
              <Button variant="ghost" size="sm" onClick={loadA3Certificates} disabled={a3Loading}>
                <RefreshCw className={`h-4 w-4 mr-2 ${a3Loading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>

            {a3Loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : webPkiStatus === "not_installed" ? (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>WebPKI não instalado. Necessário para certificados A3.</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={getWebPkiInstallUrl()} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Instalar
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : webPkiStatus === "outdated" ? (
              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="flex items-center justify-between">
                  <span>WebPKI desatualizado. Atualize para usar certificados A3.</span>
                  <Button variant="outline" size="sm" asChild>
                    <a href={getWebPkiInstallUrl()} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Atualizar
                    </a>
                  </Button>
                </AlertDescription>
              </Alert>
            ) : a3Certificates.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Nenhum certificado A3 detectado. Conecte seu token ou cartão e clique em Atualizar.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {a3Certificates.map((cert) => (
                  <div
                    key={cert.thumbprint}
                    onClick={() => handleA3Select(cert)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCertificate?.thumbprint === cert.thumbprint
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <CreditCard className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{formatCertificateName(cert)}</p>
                        <p className="text-xs text-muted-foreground">
                          {cert.issuerName.split(",")[0].replace("CN=", "")} · 
                          Válido até {format(cert.validTo, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getCertificateStatusBadge(cert.validTo)}
                      {selectedCertificate?.thumbprint === cert.thumbprint && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Certificados Cloud */}
        {certificateType === "cloud" && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-medium">Certificados em Nuvem</h4>
              {cloudAuthenticated && (
                <Button variant="ghost" size="sm" onClick={loadCloudCertificates} disabled={cloudLoading}>
                  <RefreshCw className={`h-4 w-4 mr-2 ${cloudLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              )}
            </div>

            {cloudLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : !cloudAuthenticated ? (
              <div className="text-center py-6 space-y-4">
                <Cloud className="h-12 w-12 mx-auto text-muted-foreground" />
                <div>
                  <p className="font-medium">Conecte sua conta BirdID</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Acesse seus certificados em nuvem para assinatura digital
                  </p>
                </div>
                <Button onClick={handleBirdIdLogin}>
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Conectar BirdID
                </Button>
              </div>
            ) : cloudCertificates.length === 0 ? (
              <Alert>
                <Info className="h-4 w-4" />
                <AlertDescription>
                  Nenhum certificado em nuvem encontrado na sua conta BirdID.
                </AlertDescription>
              </Alert>
            ) : (
              <div className="space-y-2">
                {cloudCertificates.map((cert) => (
                  <div
                    key={cert.id}
                    onClick={() => handleCloudSelect(cert)}
                    className={`flex items-center justify-between p-3 rounded-lg border cursor-pointer transition-colors ${
                      selectedCertificate?.id === cert.id
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Cloud className="h-5 w-5 text-muted-foreground" />
                      <div>
                        <p className="font-medium text-sm">{formatBirdIdCertificateName(cert)}</p>
                        <p className="text-xs text-muted-foreground">
                          Válido até {format(cert.validTo, "dd/MM/yyyy", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getCertificateStatusBadge(cert.validTo)}
                      {selectedCertificate?.id === cert.id && (
                        <CheckCircle2 className="h-5 w-5 text-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Certificado Selecionado */}
        {selectedCertificate && (
          <>
            <Separator />
            <div className="bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 rounded-lg p-4">
              <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">Certificado Selecionado</span>
              </div>
              <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                {selectedCertificate.name}
              </p>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default CertificateSelector;
