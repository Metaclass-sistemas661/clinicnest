import { useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowLeft, Mail } from "lucide-react";
import { toast } from "sonner";
import TurnstileWidget, { useTurnstile, isTurnstileEnabled } from "@/components/auth/TurnstileWidget";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSent, setIsSent] = useState(false);
  const { resetPassword } = useAuth();
  const { token: captchaToken, onVerify, onExpire, onError, reset: resetCaptcha } = useTurnstile();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isTurnstileEnabled && !captchaToken) {
      toast.error("Aguarde a verificação de segurança.");
      return;
    }
    setIsLoading(true);

    const { error } = await resetPassword(email, captchaToken ?? undefined);

    if (error) {
      const msg = error.message?.toLowerCase() || "";
      let description = error.message;
      if (msg.includes("rate limit") || msg.includes("too many"))
        description = "Muitas tentativas. Aguarde alguns minutos e tente novamente.";
      else if (msg.includes("user not found"))
        description = "Nenhuma conta encontrada com esse e-mail.";
      else if (msg.includes("fetch") || msg.includes("network"))
        description = "Erro de conexão. Verifique sua internet e tente novamente.";
      else if (msg.includes("captcha"))
        description = "Erro na verificação de segurança. Recarregue a página e tente novamente.";
      toast.error("Erro ao enviar email de recuperação", {
        description,
      });
      resetCaptcha();
      setIsLoading(false);
      return;
    }

    setIsSent(true);
    setIsLoading(false);
    toast.success("Email de recuperação enviado!");
  };

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
            <CardTitle className="text-2xl font-display">Recuperar Senha</CardTitle>
            <CardDescription>
              {isSent
                ? "Verifique sua caixa de entrada"
                : "Digite seu email para receber o link de recuperação"}
            </CardDescription>
          </CardHeader>
          {!isSent ? (
            <form onSubmit={handleSubmit} data-allow-enter-submit>
              <CardContent className="space-y-5 pt-4">
                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="seu@email.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    className="h-12 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm focus:border-primary focus:ring-primary"
                  />
                </div>
              </CardContent>
              <CardFooter className="flex flex-col gap-5 pt-2">
                <TurnstileWidget
                  onVerify={onVerify}
                  onExpire={onExpire}
                  onError={onError}
                  theme="light"
                  className="flex justify-center"
                />
                {isTurnstileEnabled && !captchaToken && (
                  <p className="text-xs text-amber-600 text-center">Aguarde a verificação de segurança acima...</p>
                )}
                <Button
                  type="submit"
                  variant="gradient"
                  className="h-12 w-full rounded-xl font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                  disabled={isLoading || (isTurnstileEnabled && !captchaToken)}
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                      Enviando...
                    </>
                  ) : (
                    <>
                      <Mail className="mr-2 h-5 w-5" />
                      Enviar link de recuperação
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
          ) : (
            <CardContent className="space-y-5 pt-4">
              <div className="rounded-xl bg-primary/10 border border-primary/20 p-6 text-center">
                <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Enviamos um email para <strong>{email}</strong>
                </p>
                <p className="text-sm text-muted-foreground">
                  Clique no link no email para redefinir sua senha.
                </p>
              </div>
              <Link
                to="/login"
                className="flex items-center justify-center text-sm font-medium text-primary hover:text-accent transition-colors"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar para o login
              </Link>
            </CardContent>
          )}
        </Card>
      </div>
    </div>
  );
}
