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
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export default function PatientRegister() {
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [acceptedTerms, setAcceptedTerms] = useState(false);
  const [success, setSuccess] = useState(false);
  const navigate = useNavigate();

  const siteOrigin = typeof window !== "undefined" ? window.location.origin : "";

  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres.");
      return;
    }

    if (!acceptedTerms) {
      toast.error("Você precisa aceitar os termos de uso.");
      return;
    }

    setIsLoading(true);

    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: siteOrigin ? `${siteOrigin}/paciente/login` : undefined,
          data: {
            full_name: fullName,
            phone: phone.replace(/\D/g, ""),
            account_type: "patient",
            terms_accepted: true,
            privacy_policy_accepted: true,
            legal_accepted_at: new Date().toISOString(),
          },
        },
      });

      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes("already registered") || m.includes("already been registered")) {
          toast.error("Este e-mail já está cadastrado.", {
            description: "Tente fazer login ou use outro e-mail.",
          });
        } else if (m.includes("password")) {
          toast.error("Senha muito fraca.", { description: "Use pelo menos 6 caracteres." });
        } else {
          toast.error("Erro ao criar conta", { description: error.message });
        }
        setIsLoading(false);
        return;
      }

      setSuccess(true);
    } catch {
      toast.error("Erro inesperado ao criar conta");
    } finally {
      setIsLoading(false);
    }
  };

  if (success) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-purple-50 to-violet-50 px-4">
        <div className="w-full max-w-md text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <h1 className="font-display text-2xl font-bold text-gray-900">Conta criada com sucesso!</h1>
          <p className="text-muted-foreground">
            Enviamos um e-mail de confirmação para <strong>{email}</strong>.
            <br />
            Verifique sua caixa de entrada e clique no link para ativar sua conta.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => navigate("/paciente/login")}
              className="bg-gradient-to-r from-purple-600 to-violet-500 text-white"
            >
              Ir para o login
            </Button>
            <Link to="/" className="text-sm text-muted-foreground hover:text-foreground transition-colors">
              Voltar para o site
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen">

      {/* ── Painel Esquerdo — Branding ── */}
      <div className="relative hidden lg:flex lg:w-[55%] xl:w-[60%] flex-col overflow-hidden">
        <img
          src="https://images.unsplash.com/photo-1579684385127-1ef15d508118?auto=format&fit=crop&w=1400&q=80"
          alt="Ambiente médico moderno"
          className="absolute inset-0 h-full w-full object-cover object-center"
          loading="eager"
        />

        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, rgba(88,28,135,0.92) 0%, rgba(124,58,237,0.80) 40%, rgba(139,92,246,0.70) 100%)",
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
              Crie sua conta
              <br />
              <span className="text-purple-200">em segundos.</span>
            </h1>
            <p className="text-white/75 text-lg max-w-md leading-relaxed">
              Cadastre-se gratuitamente para acessar suas consultas, exames e teleconsultas.
            </p>
          </div>

          <div className="flex flex-col gap-2.5 mb-10">
            {[
              "Acesso a resultados de exames",
              "Teleconsulta por vídeo",
              "Receitas e atestados digitais",
              "Histórico de consultas",
            ].map((item) => (
              <div key={item} className="flex items-center gap-3 text-white/80 text-sm">
                <CheckCircle2 className="h-4 w-4 text-purple-300 flex-shrink-0" />
                <span>{item}</span>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-1.5 text-white/50 text-xs">
            <ShieldCheck className="h-3.5 w-3.5 text-purple-300" />
            <span>100% gratuito · Dados protegidos · LGPD</span>
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="flex w-full lg:w-[45%] xl:w-[40%] flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 xl:px-16">

        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-purple-700 leading-none">ClinicNest</div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">Portal do Paciente</div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-purple-50 border border-purple-100 px-3 py-1 text-xs font-medium text-purple-700 mb-6">
            <Heart className="h-3 w-3" />
            Cadastro de Paciente
          </div>

          <div className="mb-6">
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-1">Crie sua conta</h2>
            <p className="text-muted-foreground text-sm">Preencha seus dados para começar.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="patient-name" className="text-sm font-medium text-gray-700">
                Nome completo
              </Label>
              <Input
                id="patient-name"
                type="text"
                placeholder="Maria da Silva"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                required
                className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patient-reg-email" className="text-sm font-medium text-gray-700">
                E-mail
              </Label>
              <Input
                id="patient-reg-email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patient-phone" className="text-sm font-medium text-gray-700">
                Telefone / WhatsApp
              </Label>
              <Input
                id="patient-phone"
                type="tel"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(formatPhone(e.target.value))}
                autoComplete="tel"
                required
                className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patient-reg-password" className="text-sm font-medium text-gray-700">
                Senha
              </Label>
              <div className="relative">
                <Input
                  id="patient-reg-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Mínimo 6 caracteres"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white pr-12 focus:border-purple-500 focus:ring-purple-500 transition-colors"
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="patient-confirm-password" className="text-sm font-medium text-gray-700">
                Confirmar senha
              </Label>
              <Input
                id="patient-confirm-password"
                type={showPassword ? "text" : "password"}
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={6}
                className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-purple-500 focus:ring-purple-500 transition-colors"
              />
            </div>

            <div className="flex items-start gap-2 pt-1">
              <input
                type="checkbox"
                id="patient-terms"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="mt-1 h-4 w-4 rounded border-gray-300 text-purple-600 focus:ring-purple-500"
              />
              <label htmlFor="patient-terms" className="text-xs text-muted-foreground leading-relaxed">
                Li e aceito os{" "}
                <Link to="/termos-de-uso" className="text-purple-600 hover:underline" target="_blank">
                  Termos de Uso
                </Link>{" "}
                e a{" "}
                <Link to="/politica-de-privacidade" className="text-purple-600 hover:underline" target="_blank">
                  Política de Privacidade
                </Link>
                .
              </label>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-purple-600 to-violet-500 hover:from-purple-700 hover:to-violet-600 text-white font-semibold shadow-lg shadow-purple-500/25 hover:shadow-purple-500/40 hover:scale-[1.01] transition-all duration-300 text-base"
              disabled={isLoading || !fullName.trim() || !email.trim() || !password || !acceptedTerms}
            >
              {isLoading ? (
                <>
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  Criando conta...
                </>
              ) : (
                <>
                  Criar minha conta
                  <ArrowRight className="ml-2 h-5 w-5" />
                </>
              )}
            </Button>
          </form>

          <div className="my-5 flex items-center gap-3">
            <div className="flex-1 h-px bg-gray-100" />
            <span className="text-xs text-muted-foreground">ou</span>
            <div className="flex-1 h-px bg-gray-100" />
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Já tem uma conta?{" "}
            <Link
              to="/paciente/login"
              className="font-semibold text-purple-600 hover:text-purple-700 transition-colors"
            >
              Faça login
            </Link>
          </p>

          <div className="mt-6 text-center text-xs text-muted-foreground/60 space-y-1">
            <div className="flex items-center justify-center gap-3">
              <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">Termos</Link>
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
