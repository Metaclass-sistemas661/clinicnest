import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, ArrowLeft, Lock } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isValid, setIsValid] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Verificar se há um token válido na URL
    const checkSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        setIsValid(true);
      } else {
        // Tentar recuperar sessão do hash da URL
        const hashParams = new URLSearchParams(window.location.hash.substring(1));
        const accessToken = hashParams.get("access_token");
        const type = hashParams.get("type");

        if (accessToken && type === "recovery") {
          setIsValid(true);
        } else {
          toast.error("Link inválido ou expirado");
          setTimeout(() => navigate("/forgot-password"), 2000);
        }
      }
    };

    checkSession();
  }, [navigate]);

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

    // Usar Edge Function para atualizar senha sem email automático do Supabase
    // A Edge Function atualiza a senha usando admin.updateUserById (não envia email automático)
    // e então envia nosso email customizado
    try {
      const { data, error } = await supabase.functions.invoke("update-password", {
        body: {
          password: password,
        },
      });

      if (error) {
        toast.error("Erro ao atualizar senha", {
          description: error.message,
        });
        setIsLoading(false);
        return;
      }

      if (!data?.success) {
        toast.error("Erro ao atualizar senha", {
          description: data?.error || "Erro desconhecido",
        });
        setIsLoading(false);
        return;
      }

      toast.success("Senha atualizada com sucesso!");
      setTimeout(() => navigate("/login"), 2000);
    } catch (err) {
      toast.error("Erro ao atualizar senha", {
        description: err instanceof Error ? err.message : "Erro desconhecido",
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
          <h1 className="font-display text-4xl font-bold text-gradient">VynloBella</h1>
          <p className="mt-2 text-muted-foreground">Gestão profissional para seu salão</p>
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
                className="h-12 w-full rounded-xl gradient-primary text-white font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
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
