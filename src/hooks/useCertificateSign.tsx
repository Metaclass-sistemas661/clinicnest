import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { signWithCertificate, type ICPSignatureResult } from "@/lib/icp-brasil-signature";
import { decryptPfx } from "@/components/settings/CertificateManager";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";

interface CertificateInfo {
  id: string;
  certificate_type: "A1" | "A3" | "cloud";
  common_name: string;
  cpf_cnpj: string | null;
  issuer: string;
  thumbprint: string;
}

interface SigningState {
  isLoading: boolean;
  needsPassword: boolean;
  certificate: CertificateInfo | null;
  error: string | null;
}

interface UseSignatureReturn {
  state: SigningState;
  hasCertificate: boolean;
  checkCertificate: () => Promise<boolean>;
  signData: (data: string, password: string) => Promise<ICPSignatureResult | null>;
  reset: () => void;
}

export function useCertificateSign(): UseSignatureReturn {
  const [state, setState] = useState<SigningState>({
    isLoading: false,
    needsPassword: false,
    certificate: null,
    error: null,
  });

  const checkCertificate = useCallback(async (): Promise<boolean> => {
    setState(s => ({ ...s, isLoading: true, error: null }));
    
    try {
      const { data, error } = await supabase.rpc("get_certificate_for_signing");
      
      if (error) throw error;
      
      if (!data?.success) {
        setState({
          isLoading: false,
          needsPassword: false,
          certificate: null,
          error: data?.error || "Nenhum certificado encontrado",
        });
        return false;
      }

      const cert = data.certificate;
      setState({
        isLoading: false,
        needsPassword: true,
        certificate: {
          id: cert.id,
          certificate_type: cert.certificate_type,
          common_name: cert.common_name,
          cpf_cnpj: cert.cpf_cnpj,
          issuer: cert.issuer,
          thumbprint: cert.thumbprint,
        },
        error: null,
      });
      
      return true;
    } catch (err) {
      logger.error("useCertificateSign.check", err);
      setState({
        isLoading: false,
        needsPassword: false,
        certificate: null,
        error: "Erro ao buscar certificado",
      });
      return false;
    }
  }, []);

  const signData = useCallback(async (
    data: string,
    password: string
  ): Promise<ICPSignatureResult | null> => {
    if (!state.certificate) {
      toast.error("Nenhum certificado selecionado");
      return null;
    }

    setState(s => ({ ...s, isLoading: true, error: null }));

    try {
      const { data: certData, error } = await supabase.rpc("get_certificate_for_signing", {
        p_certificate_id: state.certificate.id,
      });

      if (error) throw error;
      if (!certData?.success) throw new Error(certData?.error || "Erro ao obter certificado");

      const cert = certData.certificate;
      
      if (!cert.encrypted_pfx || !cert.encryption_iv || !cert.encryption_salt) {
        throw new Error("Certificado não possui dados criptografados");
      }

      const pfxBytes = await decryptPfx(
        cert.encrypted_pfx,
        cert.encryption_iv,
        cert.encryption_salt,
        password
      );

      const result = await signWithCertificate(data, pfxBytes, password);

      setState(s => ({ ...s, isLoading: false }));
      return result;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao assinar";
      logger.error("useCertificateSign.sign", err);
      
      if (msg.includes("Senha") || msg.includes("password") || msg.includes("decrypt")) {
        setState(s => ({ ...s, isLoading: false, error: "Senha incorreta" }));
        toast.error("Senha do certificado incorreta");
      } else {
        setState(s => ({ ...s, isLoading: false, error: msg }));
        toast.error("Erro ao assinar documento", { description: normalizeError(msg, "Não foi possível assinar. Verifique o certificado e tente novamente.") });
      }
      
      return null;
    }
  }, [state.certificate]);

  const reset = useCallback(() => {
    setState({
      isLoading: false,
      needsPassword: false,
      certificate: null,
      error: null,
    });
  }, []);

  return {
    state,
    hasCertificate: state.certificate !== null,
    checkCertificate,
    signData,
    reset,
  };
}

export function SignaturePasswordDialog({
  open,
  onOpenChange,
  certificateName,
  isLoading,
  error,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  certificateName: string;
  isLoading: boolean;
  error: string | null;
  onSubmit: (password: string) => void;
}) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password) {
      onSubmit(password);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPassword("");
      setShowPassword(false);
    }
    onOpenChange(newOpen);
  };

  return (
    <div className={`fixed inset-0 z-50 ${open ? "" : "hidden"}`}>
      <div className="fixed inset-0 bg-black/50" role="button" tabIndex={0} aria-label="Fechar" onClick={() => handleOpenChange(false)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleOpenChange(false); } }} />
      <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-background rounded-lg shadow-lg p-6">
        <h3 className="text-lg font-semibold mb-2">Assinar com Certificado Digital</h3>
        <p className="text-sm text-muted-foreground mb-4">
          Informe a senha do certificado <strong>{certificateName}</strong> para assinar o documento.
        </p>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label htmlFor="cert-password" className="text-sm font-medium">Senha do Certificado</label>
            <div className="relative">
              <input
                id="cert-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Digite a senha"
                className="w-full px-3 py-2 border rounded-md pr-10"
                autoFocus
                disabled={isLoading}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? "Ocultar" : "Mostrar"}
              </button>
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              className="px-4 py-2 text-sm border rounded-md hover:bg-muted"
              disabled={isLoading}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={!password || isLoading}
              className="px-4 py-2 text-sm bg-primary text-primary-foreground rounded-md hover:bg-primary/90 disabled:opacity-50"
            >
              {isLoading ? "Assinando..." : "Assinar"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
