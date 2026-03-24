import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ShieldCheck,
  Upload,
  Trash2,
  Star,
  StarOff,
  AlertTriangle,
  CheckCircle2,
  Clock,
  FileKey,
  Loader2,
  Eye,
  EyeOff,
  Info,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import { readPfxFile, parsePfxCertificateInfo, type ICPCertificateInfo } from "@/lib/icp-brasil-signature";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Certificate {
  id: string;
  certificate_type: "A1" | "A3" | "cloud";
  common_name: string;
  cpf_cnpj: string | null;
  issuer: string;
  serial_number: string;
  not_before: string;
  not_after: string;
  thumbprint: string;
  is_active: boolean;
  is_default: boolean;
  nickname: string | null;
  created_at: string;
  last_used_at: string | null;
  days_until_expiry: number;
  is_expired: boolean;
  has_encrypted_pfx: boolean;
}

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
}

async function encryptPfx(pfxBytes: Uint8Array, password: string): Promise<{ encrypted: Uint8Array; iv: Uint8Array; salt: Uint8Array }> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(password, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    pfxBytes
  );
  return { encrypted: new Uint8Array(encrypted), iv, salt };
}

export async function decryptPfx(encryptedBase64: string, ivBase64: string, saltBase64: string, password: string): Promise<Uint8Array> {
  const encrypted = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));
  const key = await deriveKey(password, salt);
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    encrypted
  );
  return new Uint8Array(decrypted);
}

function generateThumbprint(pfxBytes: Uint8Array): string {
  let hash = 0;
  for (let i = 0; i < pfxBytes.length; i++) {
    hash = ((hash << 5) - hash) + pfxBytes[i];
    hash = hash & hash;
  }
  return Math.abs(hash).toString(16).padStart(16, '0');
}

export default function CertificateManager() {
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [pfxFile, setPfxFile] = useState<File | null>(null);
  const [pfxPassword, setPfxPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [certInfo, setCertInfo] = useState<ICPCertificateInfo | null>(null);
  const [certNickname, setCertNickname] = useState("");
  const [setAsDefault, setSetAsDefault] = useState(true);
  const [parseError, setParseError] = useState<string | null>(null);

  const fetchCertificates = useCallback(async () => {
    try {
      const { data, error } = await supabase.rpc("list_my_certificates");
      if (error) throw error;
      if (data?.success) {
        setCertificates(data.certificates || []);
      }
    } catch (err) {
      logger.error("CertificateManager.fetch", err);
      toast.error("Erro ao carregar certificados", { description: normalizeError(err, "Não foi possível listar os certificados.") });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCertificates();
  }, [fetchCertificates]);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith(".pfx") && !file.name.toLowerCase().endsWith(".p12")) {
      toast.error("Selecione um arquivo .pfx ou .p12");
      return;
    }

    setPfxFile(file);
    setCertInfo(null);
    setParseError(null);
    setCertNickname("");
  };

  const handleValidateCertificate = async () => {
    if (!pfxFile || !pfxPassword) {
      toast.error("Selecione o arquivo e informe a senha");
      return;
    }

    try {
      const pfxBytes = await readPfxFile(pfxFile);
      const info = parsePfxCertificateInfo(pfxBytes, pfxPassword);
      setCertInfo(info);
      setParseError(null);
      setCertNickname(info.commonName.split(":")[0].trim());
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao validar certificado";
      setParseError(msg);
      setCertInfo(null);
      logger.error("CertificateManager.validate", err);
    }
  };

  const handleUploadCertificate = async () => {
    if (!pfxFile || !pfxPassword || !certInfo) {
      toast.error("Valide o certificado primeiro");
      return;
    }

    setIsUploading(true);
    try {
      const pfxBytes = await readPfxFile(pfxFile);
      const { encrypted, iv, salt } = await encryptPfx(pfxBytes, pfxPassword);
      const thumbprint = generateThumbprint(pfxBytes);

      const { data, error } = await supabase.rpc("register_certificate_a1", {
        p_common_name: certInfo.commonName,
        p_cpf_cnpj: certInfo.cpfCnpj || null,
        p_issuer: certInfo.issuer,
        p_serial_number: certInfo.serialNumber,
        p_not_before: certInfo.notBefore.toISOString(),
        p_not_after: certInfo.notAfter.toISOString(),
        p_thumbprint: thumbprint,
        p_encrypted_pfx: Array.from(encrypted),
        p_encryption_iv: Array.from(iv),
        p_encryption_salt: Array.from(salt),
        p_nickname: certNickname || null,
        p_is_default: setAsDefault,
      });

      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Erro ao cadastrar");

      toast.success(data.updated ? "Certificado atualizado" : "Certificado cadastrado");
      setUploadDialogOpen(false);
      resetUploadForm();
      fetchCertificates();
    } catch (err) {
      logger.error("CertificateManager.upload", err);
      toast.error("Erro ao cadastrar certificado", { description: normalizeError(err, "Verifique o arquivo e a senha do certificado.") });
    } finally {
      setIsUploading(false);
    }
  };

  const handleSetDefault = async (certId: string) => {
    try {
      const { data, error } = await supabase.rpc("set_default_certificate", {
        p_certificate_id: certId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success("Certificado definido como padrão");
      fetchCertificates();
    } catch (err) {
      logger.error("CertificateManager.setDefault", err);
      toast.error("Erro ao definir certificado padrão", { description: normalizeError(err, "Não foi possível alterar o certificado padrão.") });
    }
  };

  const handleDelete = async () => {
    if (!deletingId) return;
    try {
      const { data, error } = await supabase.rpc("remove_certificate", {
        p_certificate_id: deletingId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      toast.success("Certificado removido");
      setDeleteDialogOpen(false);
      setDeletingId(null);
      fetchCertificates();
    } catch (err) {
      logger.error("CertificateManager.delete", err);
      toast.error("Erro ao remover certificado", { description: normalizeError(err, "Não foi possível remover o certificado.") });
    }
  };

  const resetUploadForm = () => {
    setPfxFile(null);
    setPfxPassword("");
    setCertInfo(null);
    setCertNickname("");
    setSetAsDefault(true);
    setParseError(null);
  };

  const openUploadDialog = () => {
    resetUploadForm();
    setUploadDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Certificados Digitais ICP-Brasil</h3>
          <p className="text-sm text-muted-foreground">
            Cadastre seu certificado digital para assinar documentos médicos
          </p>
        </div>
        <Button onClick={openUploadDialog} className="gap-2">
          <Upload className="h-4 w-4" />
          Cadastrar Certificado A1
        </Button>
      </div>

      {certificates.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="h-14 w-14 rounded-full bg-muted flex items-center justify-center mb-4">
              <FileKey className="h-7 w-7 text-muted-foreground" />
            </div>
            <h4 className="font-semibold mb-1">Nenhum certificado cadastrado</h4>
            <p className="text-sm text-muted-foreground max-w-sm mb-4">
              Cadastre seu certificado digital ICP-Brasil A1 (.pfx) para assinar
              atestados, receitas e outros documentos médicos.
            </p>
            <Button onClick={openUploadDialog} variant="outline" className="gap-2">
              <Upload className="h-4 w-4" />
              Cadastrar Certificado
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {certificates.map((cert) => (
            <Card key={cert.id} className={cert.is_default ? "border-primary" : ""}>
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`h-10 w-10 rounded-full flex items-center justify-center ${
                      cert.is_expired ? "bg-red-100" : cert.days_until_expiry < 30 ? "bg-yellow-100" : "bg-green-100"
                    }`}>
                      <ShieldCheck className={`h-5 w-5 ${
                        cert.is_expired ? "text-red-600" : cert.days_until_expiry < 30 ? "text-yellow-600" : "text-green-600"
                      }`} />
                    </div>
                    <div>
                      <CardTitle className="text-base flex items-center gap-2">
                        {cert.nickname || cert.common_name}
                        {cert.is_default && (
                          <Badge variant="default" className="text-xs">Padrão</Badge>
                        )}
                        <Badge variant="outline" className="text-xs">{cert.certificate_type}</Badge>
                      </CardTitle>
                      <CardDescription className="text-xs">
                        {cert.issuer} • {cert.cpf_cnpj || "CPF não identificado"}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {!cert.is_default && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleSetDefault(cert.id)}
                        title="Definir como padrão"
                      >
                        <StarOff className="h-4 w-4" />
                      </Button>
                    )}
                    {cert.is_default && (
                      <Button variant="ghost" size="icon" disabled title="Certificado padrão">
                        <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => { setDeletingId(cert.id); setDeleteDialogOpen(true); }}
                      title="Remover certificado"
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground text-xs">Válido de</p>
                    <p>{format(new Date(cert.not_before), "dd/MM/yyyy", { locale: ptBR })}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Válido até</p>
                    <p className={cert.is_expired ? "text-red-600 font-medium" : cert.days_until_expiry < 30 ? "text-yellow-600 font-medium" : ""}>
                      {format(new Date(cert.not_after), "dd/MM/yyyy", { locale: ptBR })}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Status</p>
                    <div className="flex items-center gap-1">
                      {cert.is_expired ? (
                        <>
                          <AlertTriangle className="h-3 w-3 text-red-600" />
                          <span className="text-red-600">Expirado</span>
                        </>
                      ) : cert.days_until_expiry < 30 ? (
                        <>
                          <Clock className="h-3 w-3 text-yellow-600" />
                          <span className="text-yellow-600">Expira em {cert.days_until_expiry}d</span>
                        </>
                      ) : (
                        <>
                          <CheckCircle2 className="h-3 w-3 text-green-600" />
                          <span className="text-green-600">Válido</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div>
                    <p className="text-muted-foreground text-xs">Último uso</p>
                    <p>{cert.last_used_at ? format(new Date(cert.last_used_at), "dd/MM/yyyy HH:mm", { locale: ptBR }) : "Nunca usado"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="h-5 w-5 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium text-foreground mb-1">Como funciona a assinatura digital?</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Seu certificado é armazenado de forma criptografada (AES-256)</li>
                <li>Ao assinar um documento, você informa apenas a senha do certificado</li>
                <li>A assinatura usa SHA-256 com RSA, padrão ICP-Brasil</li>
                <li>Documentos assinados não podem ser alterados</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog open={uploadDialogOpen} onOpenChange={setUploadDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Cadastrar Certificado Digital A1</DialogTitle>
            <DialogDescription>
              Selecione seu arquivo .pfx ou .p12 e informe a senha para validar
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Arquivo do Certificado (.pfx / .p12)</Label>
              <Input
                type="file"
                accept=".pfx,.p12"
                onChange={handleFileChange}
                className="cursor-pointer"
              />
              {pfxFile && (
                <p className="text-xs text-muted-foreground">
                  Arquivo selecionado: {pfxFile.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label>Senha do Certificado</Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={pfxPassword}
                  onChange={(e) => setPfxPassword(e.target.value)}
                  placeholder="Digite a senha do certificado"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-0 top-0 h-full"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </Button>
              </div>
            </div>

            {!certInfo && (
              <Button
                onClick={handleValidateCertificate}
                disabled={!pfxFile || !pfxPassword}
                variant="outline"
                className="w-full"
              >
                Validar Certificado
              </Button>
            )}

            {parseError && (
              <div className="rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-3 text-sm text-red-700 dark:text-red-300">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4" />
                  {parseError}
                </div>
              </div>
            )}

            {certInfo && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-800 p-4 space-y-3">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-5 w-5" />
                  <span className="font-medium">Certificado válido</span>
                </div>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-green-800/60 dark:text-green-300/60 text-xs">Titular</p>
                    <p className="font-medium text-green-900 dark:text-green-100">{certInfo.commonName}</p>
                  </div>
                  <div>
                    <p className="text-green-800/60 dark:text-green-300/60 text-xs">CPF/CNPJ</p>
                    <p className="text-green-900 dark:text-green-100">{certInfo.cpfCnpj || "Não identificado"}</p>
                  </div>
                  <div>
                    <p className="text-green-800/60 dark:text-green-300/60 text-xs">Emissor</p>
                    <p className="text-green-900 dark:text-green-100">{certInfo.issuer}</p>
                  </div>
                  <div>
                    <p className="text-green-800/60 dark:text-green-300/60 text-xs">Validade</p>
                    <p className={certInfo.daysUntilExpiry < 30 ? "text-yellow-600 dark:text-yellow-400" : "text-green-900 dark:text-green-100"}>
                      {certInfo.daysUntilExpiry} dias restantes
                    </p>
                  </div>
                </div>

                <div className="pt-2 border-t border-green-200 dark:border-green-800 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-green-900 dark:text-green-100">Apelido (opcional)</Label>
                    <Input
                      value={certNickname}
                      onChange={(e) => setCertNickname(e.target.value)}
                      placeholder="Ex: Certificado Principal"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="setAsDefault"
                      checked={setAsDefault}
                      onChange={(e) => setSetAsDefault(e.target.checked)}
                      className="rounded"
                    />
                    <Label htmlFor="setAsDefault" className="text-sm font-normal cursor-pointer text-green-900 dark:text-green-100">
                      Definir como certificado padrão para assinaturas
                    </Label>
                  </div>
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUploadDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleUploadCertificate}
              disabled={!certInfo || isUploading}
              className="gap-2"
            >
              {isUploading && <Loader2 className="h-4 w-4 animate-spin" />}
              Cadastrar Certificado
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover certificado?</AlertDialogTitle>
            <AlertDialogDescription>
              O certificado será removido da sua conta. Você poderá cadastrá-lo novamente se necessário.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
