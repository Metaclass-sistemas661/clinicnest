import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
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
  Heart,
  Calendar,
  FileText,
  Video,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function PatientLogin() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const navigate = useNavigate();

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

    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });

      if (error) {
        toast.error("Erro ao fazer login", { description: normalizeAuthError(error.message) });
        setIsLoading(false);
        return;
      }

      // Verificar se é conta de paciente
      const accountType = data.user?.user_metadata?.account_type;
      if (accountType !== "patient") {
        await supabase.auth.signOut();
        toast.error("Esta conta não é de paciente.", {
          description: "Use o login de clínica ou crie uma conta de paciente.",
        });
        setIsLoading(false);
        return;
      }

      toast.success("Login realizado com sucesso!");
      navigate("/paciente/dashboard", { replace: true });
    } catch {
      toast.error("Erro inesperado ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Painel Esquerdo — Foto + Branding ── */}
      <div className="relative hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1631815588090-d4bfec5b1ccb?auto=format&fit=crop&w=1400&q=80"
          alt="Paciente em consulta médica"
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(88,28,135,0.90) 0%, rgba(124,58,237,0.78) 40%, rgba(139,92,246,0.68) 100%)",
          }}
        />

        <div className="relative z-10 flex flex-col h-full p-10 xl:p-14">
          <div className="flex items-center gap-3 mb-auto">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/20">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-white tracking-tight leading-none">
                ClinicNest
              </div>
              <div className="text-[10px] text-white/50 tracking-widest uppercase">Portal do Paciente</div>
            </div>
          </div>

          <div className="mt-auto mb-10">
            <h1 className="font-display text-4xl xl:text-5xl font-bold text-white leading-tight mb-4">
              Sua saúde,
              <br />
              <span className="text-purple-200">na palma da mão.</span>
            </h1>
            <p className="text-white/75 text-lg max-w-md leading-relaxed">
              Acesse suas consultas, exames, receitas e teleconsultas de qualquer lugar.
            </p>
          </div>

          <div className="flex flex-col gap-3 mb-10">
            {[
              { icon: Calendar, label: "Suas consultas", sub: "Veja agendamentos e histórico" },
              { icon: Video, label: "Teleconsulta", sub: "Atendimento por vídeo seguro" },
              { icon: FileText, label: "Exames e receitas", sub: "Acesse resultados e prescrições" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-4 rounded-2xl border border-white/15 bg-white/10 backdrop-blur-sm px-5 py-3.5"
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-300/20 flex-shrink-0">
                    <Icon className="h-5 w-5 text-purple-200" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white leading-tight">{item.label}</div>
                    <div className="text-xs text-white/60 mt-0.5">{item.sub}</div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex items-center gap-1.5 text-white/50 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-300" />
            <span>Dados protegidos · LGPD · Conexão criptografada</span>
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="flex w-full lg:w-[45%] xl:w-[40%] flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 xl:px-16">

        {/* Logo mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-purple-700 leading-none">ClinicNest</div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">Portal do Paciente</div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-100 px-3 py-1 text-xs font-medium text-purple-700 mb-6">
            <Heart className="h-3 w-3" />
            Portal do Paciente
          </div>

          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-gray-900 mb-2">Olá, paciente!</h2>
            <p className="text-muted-foreground text-sm">Entre com suas credenciais para acessar seu portal.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="patient-email" className="text-sm font-medium text-gray-700">
                E-mail
              </Label>
              <Input
                id="patient-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-12 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-purple-500 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="patient-password" className="text-sm font-medium text-gray-700">
                  Senha
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-medium text-purple-600 hover:text-purple-700 transition-colors"
                >
                  Esqueceu a senha?
                </Link>
              </div>
              <div className="relative">
                <Input
                  id="patient-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  className="h-12 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white pr-12 focus:border-purple-500 focus:ring-purple-500 transition-colors"
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
              className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-700 hover:to-violet-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.01] transition-all duration-300 text-base"
              disabled={isLoading || !email.trim() || !password}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                <>
                  Acessar meu portal
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Ainda não tem conta?{" "}
            <Link
              to="/paciente/cadastro"
              className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
            >
              Cadastre-se aqui
            </Link>
          </p>

          <div className="mt-6 text-center">
            <Link
              to="/login"
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              É profissional de saúde? Acesse o painel da clínica →
            </Link>
          </div>

          <div className="mt-8 flex items-center justify-center gap-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-purple-500" />
              <span>Conexão segura</span>
            </div>
            <span className="opacity-30">·</span>
            <span>LGPD</span>
          </div>

          <div className="mt-8 text-center text-xs text-muted-foreground/60 space-y-1">
            <div className="flex items-center justify-center gap-3">
              <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">Termos de Uso</Link>
              <span className="opacity-40">·</span>
              <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
            </div>
            <div>© {new Date().getFullYear()} ClinicNest by Metaclass</div>
          </div>
        </div>
      </div>
    </div>
  );
}
