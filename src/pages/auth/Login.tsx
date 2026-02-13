import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  CalendarDays,
  Eye,
  EyeOff,
  Headset,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Wallet,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const { signIn } = useAuth();
  const navigate = useNavigate();

  const prefetchMainRoutes = () => {
    void import("@/pages/Dashboard");
    void import("@/pages/Agenda");
    void import("@/pages/Clientes");
    void import("@/pages/Servicos");
    void import("@/pages/Produtos");
    void import("@/pages/Notificacoes");
    void import("@/pages/MinhasConfiguracoes");
    void import("@/pages/Financeiro");
    void import("@/pages/Assinatura");
    void import("@/pages/Equipe");
    void import("@/pages/Configuracoes");
    void import("@/pages/Metas");
    void import("@/pages/MinhasComissoes");
    void import("@/pages/MeusSalarios");
    void import("@/pages/MinhasMetas");
  };

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
    prefetchMainRoutes();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-b from-white to-violet-50/40 p-4">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -left-40 -top-40 h-80 w-80 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -right-40 -bottom-40 h-80 w-80 rounded-full bg-accent/10 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-6xl animate-slide-up">
        <div className="grid items-center gap-10 lg:grid-cols-2">
          <div className="hidden lg:flex flex-col">
            <div className="mb-10">
              <div className="mb-6 relative inline-block">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-vibrant shadow-glow">
                  <span className="font-display text-3xl font-extrabold tracking-tight text-white">VB</span>
                </div>
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-xl -z-10" />
              </div>
              <h1 className="font-display text-4xl font-bold text-gradient">VynloBella</h1>
              <p className="mt-3 text-muted-foreground max-w-md">
                Gestão profissional para salões, com foco em agilidade e organização.
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div className="flex gap-3 rounded-2xl border border-violet-100 bg-white/60 p-4 backdrop-blur">
                <CalendarDays className="h-5 w-5 text-violet-600 mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">Agenda e atendimento</div>
                  <div className="text-sm text-muted-foreground">Organize horários, serviços e profissionais.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-violet-100 bg-white/60 p-4 backdrop-blur">
                <Users className="h-5 w-5 text-violet-600 mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">Clientes e recorrência</div>
                  <div className="text-sm text-muted-foreground">Histórico e relacionamento em um só lugar.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-violet-100 bg-white/60 p-4 backdrop-blur">
                <Wallet className="h-5 w-5 text-violet-600 mt-0.5" />
                <div>
                  <div className="font-medium text-foreground">Financeiro e comissões</div>
                  <div className="text-sm text-muted-foreground">Controle entradas, saídas e repasses.</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-violet-600" />
                <span>Conexão segura</span>
              </div>
              <div className="flex items-center gap-2">
                <Headset className="h-4 w-4 text-violet-600" />
                <span>Suporte por e-mail</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md justify-self-center">
            <div className="mb-10 flex flex-col items-center lg:hidden">
              <div className="mb-6 relative">
                <div className="flex h-20 w-20 items-center justify-center rounded-3xl gradient-vibrant shadow-glow">
                  <span className="font-display text-3xl font-extrabold tracking-tight text-white">VB</span>
                </div>
                <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-primary/20 to-accent/20 blur-xl -z-10" />
              </div>
              <h1 className="font-display text-4xl font-bold text-gradient">VynloBella</h1>
              <p className="mt-2 text-muted-foreground">Gestão profissional para seu salão</p>
            </div>

            <Card className="border-violet-100/60 bg-white/80 shadow-2xl backdrop-blur-md">
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
      </div>
    </div>
  );
}
