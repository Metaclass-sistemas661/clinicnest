import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, EyeOff, Loader2, ArrowRight } from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const normalizeAuthError = (message: string) => {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials")) {
      return "E-mail ou senha incorretos.";
    }
    if (m.includes("email not confirmed")) {
      return "Confirme seu e-mail antes de entrar.";
    }
    if (m.includes("too many requests")) {
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    }
    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    const { error } = await signIn(email, password);

    if (error) {
      toast.error("Erro ao fazer login", {
        description: normalizeAuthError(error.message),
      });
      setIsLoading(false);
      return;
    }

    toast.success("Login realizado com sucesso!");
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background p-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/15 blur-3xl" />
        <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-accent/15 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-96 w-96 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md animate-slide-up">
        {/* Brand */}
        <div className="mb-10 flex flex-col items-center">
          <div className="mb-6 relative">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-vibrant shadow-glow">
              <span className="font-display text-3xl font-extrabold tracking-tight text-white">VB</span>
            </div>
            <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-xl -z-10" />
          </div>
          <h1 className="font-display text-4xl font-bold text-gradient">VynloBella</h1>
          <p className="mt-2 text-muted-foreground">Gestão profissional para seu salão</p>
        </div>

        <Card className="glass border-white/20 shadow-2xl">
          <CardHeader className="space-y-2 text-center pb-2">
            <CardTitle className="text-2xl font-display">Bem-vindo de volta</CardTitle>
            <CardDescription>
              Entre com suas credenciais para acessar
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-5 pt-4">
              <div className="space-y-2">
                <Label htmlFor="email" className="text-sm font-medium">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoComplete="email"
                  required
                  className="h-12 rounded-xl border-white/20 bg-white/50 backdrop-blur-sm focus:border-primary focus:ring-primary"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="h-12 rounded-xl border-white/20 bg-white/50 pr-12 backdrop-blur-sm focus:border-primary focus:ring-primary"
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-5 pt-2">
              <Button
                type="submit"
                className="h-12 w-full rounded-xl gradient-primary text-white font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                disabled={isLoading || !email.trim() || !password}
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    Entrando...
                  </>
                ) : (
                  <>
                    Entrar
                    <ArrowRight className="ml-2 h-5 w-5" />
                  </>
                )}
              </Button>
              <div className="space-y-2 text-center">
                <Link
                  to="/forgot-password"
                  className="text-sm font-medium text-primary hover:text-accent transition-colors"
                >
                  Esqueci minha senha
                </Link>
                <p className="text-sm text-muted-foreground">
                  Não tem uma conta?{" "}
                  <Link
                    to="/cadastro"
                    className="font-semibold text-primary hover:text-accent transition-colors"
                  >
                    Cadastre-se gratuitamente
                  </Link>
                </p>
              </div>
              <div className="pt-2 text-center text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1">
                  <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">
                    Termos de Uso
                  </Link>
                  <span className="opacity-40">|</span>
                  <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">
                    Política de Privacidade
                  </Link>
                  <span className="opacity-40">|</span>
                  <a
                    href="mailto:contato@vynlobella.com"
                    className="hover:text-foreground transition-colors"
                  >
                    Suporte
                  </a>
                </div>
                <div className="mt-2">© {new Date().getFullYear()} VynloBella</div>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
