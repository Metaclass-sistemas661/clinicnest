import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Eye,
  EyeOff,
  Loader2,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  CalendarDays,
  FileText,
  Users,
  Star,
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
    void import("@/pages/Pacientes");
    void import("@/pages/Produtos");
    void import("@/pages/Notificacoes");
    void import("@/pages/MinhasConfiguracoes");
    void import("@/pages/Financeiro");
    void import("@/pages/Assinatura");
    void import("@/pages/Equipe");
    void import("@/pages/Configuracoes");
    void import("@/pages/MinhasComissoes");
    void import("@/pages/MeusSalarios");
  };

  const normalizeAuthError = (message: string) => {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials")) return "E-mail ou senha incorretos.";
    if (m.includes("email not confirmed")) return "Confirme seu e-mail antes de entrar.";
    if (m.includes("too many requests")) return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    return message;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    const { error } = await signIn(email, password);
    if (error) {
      toast.error("Erro ao fazer login", { description: normalizeAuthError(error.message) });
      setIsLoading(false);
      return;
    }
    toast.success("Login realizado com sucesso!");
    prefetchMainRoutes();
    navigate("/dashboard", { replace: true });
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Painel Esquerdo — Foto + Branding ── */}
      <div className="relative hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col overflow-hidden">

        {/* Foto de fundo */}
        <img
          src="https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?auto=format&fit=crop&w=1400&q=80"
          alt="Médica sorrindo em consultório moderno"
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
        />

        {/* Overlay gradiente teal */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(15,76,76,0.92) 0%, rgba(13,110,110,0.80) 40%, rgba(8,145,178,0.70) 100%)",
          }}
        />

        {/* Conteúdo sobre a foto */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/20">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-white tracking-tight leading-none">
                ClinicNest
              </div>
              <div className="text-[10px] text-white/50 tracking-widest uppercase">by Metaclass</div>
            </div>
          </div>

          {/* Headline central */}
          <div className="mt-auto mb-10">
            <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Sua clínica,
              <br />
              <span className="text-cyan-300">organizada e crescendo.</span>
            </h1>
            <p className="text-white/75 text-lg max-w-md leading-relaxed">
              Prontuários, agenda, financeiro e equipe — tudo em um sistema seguro e intuitivo.
            </p>
          </div>

          {/* Feature pills */}
          <div className="flex flex-col gap-3 mb-10">
            {[
              { icon: CalendarDays, label: "Agenda médica inteligente", sub: "Confirmações e lembretes automáticos" },
              { icon: FileText, label: "Prontuário eletrônico", sub: "Histórico clínico seguro e acessível" },
              { icon: Users, label: "Gestão de equipe", sub: "Permissões, comissões e metas" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-3.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/20 flex-shrink-0">
                    <Icon className="h-5 w-5 text-cyan-300" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{item.label}</div>
                    <div className="text-xs text-white/60 mt-0.5">{item.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Rodapé da foto */}
          <div className="flex items-center justify-between text-white/50 text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              <span>LGPD Compliant · SSL Certificado</span>
            </div>
            <div className="flex items-center gap-1">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
              ))}
              <span className="ml-1.5">4.9 · +500 clínicas</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="flex w-full lg:w-[45%] xl:w-[40%] flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 xl:px-16">

        {/* Logo mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-teal-700 leading-none">ClinicNest</div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">by Metaclass</div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Cabeçalho */}
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-gray-900 mb-2">Bem-vindo de volta</h2>
            <p className="text-muted-foreground text-sm">Entre com suas credenciais para acessar sua clínica.</p>
          </div>

          {/* Formulário */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                E-mail
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-500 focus:ring-teal-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-sm font-medium text-gray-700">
                  Senha
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-12 rounded-xl border-gray-200 bg-gray-50 focus:bg-white pr-12 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.01] transition-all duration-300 text-base"
              disabled={isLoading || !email.trim() || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Entrar na plataforma
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          {/* Divisor */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          {/* Link para cadastro */}
          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem uma conta?{" "}
            <Link
              to="/cadastro"
              className="font-semibold text-teal-600 hover:text-teal-700 transition-colors"
            >
              Comece grátis por 5 dias
            </Link>
          </p>

          {/* Trust badges */}
          <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-500" />
              <span>Conexão segura</span>
            </div>
            <span className="opacity-30">·</span>
            <span>LGPD</span>
            <span className="opacity-30">·</span>
            <span>Sem cartão de crédito</span>
          </div>

          {/* Footer links */}
          <div className="mt-8 text-center text-xs text-muted-foreground/60 space-y-1">
            <div className="flex items-center justify-center gap-3">
              <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">Termos de Uso</Link>
              <span className="opacity-40">·</span>
              <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
              <span className="opacity-40">·</span>
              <a href="mailto:contato@metaclass.com.br" className="hover:text-foreground transition-colors">Suporte</a>
            </div>
            <div>© {new Date().getFullYear()} ClinicNest by Metaclass</div>
          </div>
        </div>
      </div>

    </div>
  );
}
