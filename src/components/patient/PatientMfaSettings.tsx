import { useState, useCallback, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, Loader2, Smartphone, X, CheckCircle2, AlertTriangle } from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

type MfaStatus = "loading" | "disabled" | "enabled" | "enrolling" | "verifying";

export function PatientMfaSettings() {
  const [status, setStatus] = useState<MfaStatus>("loading");
  const [qrCode, setQrCode] = useState<string>("");
  const [secret, setSecret] = useState<string>("");
  const [factorId, setFactorId] = useState<string>("");
  const [verifyCode, setVerifyCode] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showDisableDialog, setShowDisableDialog] = useState(false);
  const [disableCode, setDisableCode] = useState("");

  const checkMfaStatus = useCallback(async () => {
    try {
      const { data, error } = await supabasePatient.auth.mfa.listFactors();
      if (error) {
        logger.error("[MFA] listFactors error:", error);
        setStatus("disabled");
        return;
      }

      const totpFactors = data.totp ?? [];
      const verifiedFactor = totpFactors.find((f) => f.status === "verified");

      if (verifiedFactor) {
        setFactorId(verifiedFactor.id);
        setStatus("enabled");
      } else {
        setStatus("disabled");
      }
    } catch (err) {
      logger.error("[MFA] check error:", err);
      setStatus("disabled");
    }
  }, []);

  useEffect(() => {
    checkMfaStatus();
  }, [checkMfaStatus]);

  const handleEnroll = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabasePatient.auth.mfa.enroll({
        factorType: "totp",
        friendlyName: "ClinicNest Portal",
      });

      if (error) {
        logger.error("[MFA] enroll error:", error);
        toast.error("Erro ao configurar 2FA", { description: error.message });
        return;
      }

      setQrCode(data.totp.qr_code);
      setSecret(data.totp.secret);
      setFactorId(data.id);
      setStatus("enrolling");
    } catch (err) {
      logger.error("[MFA] enroll error:", err);
      toast.error("Erro inesperado ao configurar 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerify = async () => {
    if (verifyCode.length !== 6) {
      toast.error("Informe o código de 6 dígitos.");
      return;
    }

    setIsLoading(true);
    try {
      const challenge = await supabasePatient.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        toast.error("Erro ao criar desafio MFA", { description: challenge.error.message });
        return;
      }

      const verify = await supabasePatient.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: verifyCode,
      });

      if (verify.error) {
        toast.error("Código inválido", { description: "Verifique o código no seu app e tente novamente." });
        return;
      }

      toast.success("2FA ativado com sucesso!", { description: "Sua conta está mais segura agora." });
      setStatus("enabled");
      setQrCode("");
      setSecret("");
      setVerifyCode("");
    } catch (err) {
      logger.error("[MFA] verify error:", err);
      toast.error("Erro ao verificar código");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisable = async () => {
    if (disableCode.length !== 6) {
      toast.error("Informe o código de 6 dígitos para desativar.");
      return;
    }

    setIsLoading(true);
    try {
      // Verify the code first
      const challenge = await supabasePatient.auth.mfa.challenge({ factorId });
      if (challenge.error) {
        toast.error("Erro ao verificar", { description: challenge.error.message });
        return;
      }

      const verify = await supabasePatient.auth.mfa.verify({
        factorId,
        challengeId: challenge.data.id,
        code: disableCode,
      });

      if (verify.error) {
        toast.error("Código inválido");
        return;
      }

      // Now unenroll
      const { error } = await supabasePatient.auth.mfa.unenroll({ factorId });
      if (error) {
        toast.error("Erro ao desativar 2FA", { description: error.message });
        return;
      }

      toast.success("2FA desativado");
      setStatus("disabled");
      setFactorId("");
      setShowDisableDialog(false);
      setDisableCode("");
    } catch (err) {
      logger.error("[MFA] unenroll error:", err);
      toast.error("Erro ao desativar 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const cancelEnroll = async () => {
    // Unenroll the unverified factor
    if (factorId) {
      try {
        await supabasePatient.auth.mfa.unenroll({ factorId });
      } catch {
        // ignore
      }
    }
    setStatus("disabled");
    setQrCode("");
    setSecret("");
    setVerifyCode("");
    setFactorId("");
  };

  if (status === "loading") {
    return (
      <Card>
        <CardContent className="py-6 flex items-center justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
            Autenticação em 2 fatores (2FA)
          </CardTitle>
          <CardDescription className="mt-1">
            {status === "enabled"
              ? "Sua conta possui uma camada extra de segurança"
              : "Adicione uma camada extra de segurança à sua conta"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* DISABLED — show activate button */}
          {status === "disabled" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 dark:bg-amber-950/40">
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">2FA desativado</p>
                  <p className="text-xs text-muted-foreground">
                    Recomendado para proteger dados de saúde
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
                onClick={handleEnroll}
                disabled={isLoading}
              >
                {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Smartphone className="h-4 w-4" />}
                Ativar 2FA
              </Button>
            </div>
          )}

          {/* ENROLLING — show QR code */}
          {status === "enrolling" && (
            <div className="space-y-4">
              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">1. Escaneie o QR Code com seu app autenticador</p>
                <p className="text-xs text-muted-foreground">
                  Use o Google Authenticator, Authy ou Microsoft Authenticator.
                </p>
                <div className="flex justify-center py-2">
                  {qrCode && (
                    <img
                      src={qrCode}
                      alt="QR Code para 2FA"
                      className="h-48 w-48 rounded-lg border"
                    />
                  )}
                </div>
                {secret && (
                  <div className="text-center">
                    <p className="text-xs text-muted-foreground mb-1">Ou insira manualmente:</p>
                    <code className="text-xs bg-gray-100 dark:bg-gray-800 px-2 py-1 rounded font-mono select-all">
                      {secret}
                    </code>
                  </div>
                )}
              </div>

              <div className="rounded-lg border p-4 space-y-3">
                <p className="text-sm font-medium">2. Informe o código de 6 dígitos</p>
                <div className="flex items-end gap-3">
                  <div className="flex-1">
                    <Label htmlFor="mfa-verify" className="sr-only">Código</Label>
                    <Input
                      id="mfa-verify"
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={verifyCode}
                      onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                      className="h-11 text-center text-lg font-mono tracking-[0.3em]"
                      autoFocus
                    />
                  </div>
                  <Button
                    className="h-11 bg-teal-600 hover:bg-teal-700 text-white"
                    onClick={handleVerify}
                    disabled={isLoading || verifyCode.length !== 6}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verificar"}
                  </Button>
                </div>
              </div>

              <Button
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={cancelEnroll}
              >
                <X className="h-4 w-4 mr-1" />
                Cancelar
              </Button>
            </div>
          )}

          {/* ENABLED — show status + disable */}
          {status === "enabled" && (
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-50 dark:bg-green-950/40">
                  <CheckCircle2 className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">2FA ativado</p>
                  <p className="text-xs text-muted-foreground">
                    Um código será solicitado a cada login
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowDisableDialog(true)}
              >
                Desativar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Disable confirmation dialog */}
      <Dialog open={showDisableDialog} onOpenChange={setShowDisableDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Desativar autenticação em 2 fatores</DialogTitle>
            <DialogDescription>
              Para confirmar, insira o código do seu app autenticador.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="mfa-disable" className="sr-only">Código</Label>
            <Input
              id="mfa-disable"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="h-11 text-center text-lg font-mono tracking-[0.3em]"
              autoFocus
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" onClick={() => { setShowDisableDialog(false); setDisableCode(""); }}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleDisable}
              disabled={isLoading || disableCode.length !== 6}
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Desativar 2FA
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
