import { useState, useEffect } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { auth } from "@/integrations/gcp/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowLeft, Lock } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

function normalizeResetError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("same password") || m.includes("same_password"))
    return "A nova senha deve ser diferente da senha atual.";
  if (m.includes("password") && (m.includes("weak") || m.includes("short") || m.includes("length")))
    return "A senha é muito fraca. Use no mínimo 6 caracteres.";
  if (m.includes("session expired") || m.includes("refresh_token") || m.includes("not authenticated") || m.includes("expired") || m.includes("invalid-action-code"))
    return "Link expirado ou já utilizado. Solicite um novo link de recuperação.";
  if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch"))
    return "Erro de conexão. Verifique sua internet e tente novamente.";
  if (m.includes("rate limit") || m.includes("too many"))
    return "Muitas tentativas. Aguarde alguns minutos.";
  return message;
}

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const [oobCode, setOobCode] = useState<string | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  useEffect(() => {
    // Firebase password reset links use ?oobCode=xxx&mode=resetPassword
    const code = searchParams.get("oobCode");
    const mode = searchParams.get("mode");

    if (code && mode === "resetPassword") {
      setOobCode(code);
      setIsValid(true);
    } else {
      // Fallback: check if user is already signed in (e.g., changing password from settings)
      auth.getSession().then(({ data }) => {
        if (data?.session) {
          setIsValid(true);
        } else {
          logger.warn("[ResetPassword] No oobCode and no session — invalid link");
          toast.error("Link inválido ou expirado");
          setTimeout(() => navigate("/forgot-password"), 2000);
        }
      });
    }
  }, [navigate, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter no mínimo 6 caracteres");
      return;
    }

    setIsLoading(true);

    try {
      if (oobCode) {
        // Firebase flow: confirm password reset with oobCode
        logger.debug("[ResetPassword] Confirmando reset via oobCode");
        const { error } = await auth.confirmPasswordReset(oobCode, password);
        if (error) {
          logger.error("[ResetPassword] confirmPasswordReset failed:", error);
          toast.error("Erro ao atualizar senha", {
            description: normalizeResetError(error.message || "Erro desconhecido"),
          });
          setIsLoading(false);
          return;
        }
      } else {
        // Fallback: user is already signed in, update password directly
        logger.debug("[ResetPassword] Atualizando senha via updateUser (usuário autenticado)");
        const { error } = await auth.updateUser({ password });
        if (error) {
          logger.error("[ResetPassword] updateUser failed:", error);
          toast.error("Erro ao atualizar senha", {
            description: normalizeResetError(error.message || "Erro desconhecido"),
          });
          setIsLoading(false);
          return;
        }
      }

      toast.success("Senha atualizada com sucesso!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      logger.error("[ResetPassword] Exceção ao atualizar senha:", err);
      toast.error("Erro ao atualizar senha", {
        description: err instanceof Error ? normalizeResetError(err.message) : "Erro desconhecido. Tente novamente.",
      });
      setIsLoading(false);
    }
  };

  if (!isValid) {
    return (
      <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
        <div className="relative z-10 w-full max-w-md">
          <Card className="glass border-white/20 shadow-2xl">
            <CardContent className="pt-6">
              <div className="text-center">
                <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                <p className="text-muted-foreground">Verificando link...</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/20 blur-3xl animate-pulse" />
        <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-accent/20 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Logo */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-6 relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-vibrant shadow-glow animate-glow">
              <Sparkles className="h-10 w-10 text-white" />
            </div>
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-xl -z-10" />
          </div>
          <h1 className="font-display text-4xl font-bold text-gradient">ClinicNest</h1>
          <p className="mt-2 text-muted-foreground">Gestão completa para sua clínica</p>
        </div>

        <Card className="glass border-white/20 shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-2">
            <CardTitle className="text-2xl font-display">Nova Senha</CardTitle>
            <CardDescription>
              Digite sua nova senha abaixo
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Nova Senha</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm focus:border-primary focus:ring-primary"
                />
                <p className="text-xs text-muted-foreground">Mínimo de 6 caracteres</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar Senha</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="h-12 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm focus:border-primary focus:ring-primary"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-5 pt-2">
              <Button
                type="submit"
                variant="gradient"
                className="h-12 w-full rounded-xl font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Atualizando...
                  </>
                ) : (
                  <>
                    <Lock className="mr-2 h-5 w-5" />
                    Atualizar Senha
                  </>
                )}
              </Button>
              <Link
                to="/login"
                className="flex items-center justify-center text-sm font-medium text-primary hover:text-accent transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Link>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
