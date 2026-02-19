import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ArrowRight,
  CalendarDays,
  Clock,
  Eye,
  EyeOff,
  FileText,
  Loader2,
  Mail,
  ShieldCheck,
  Star,
  Stethoscope,
  Users,
} from "lucide-react";
import { toast } from "sonner";

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [salonName, setSalonName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<1 | 2>(1);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const phoneDigits = phone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length >= 10;
  const isPasswordValid = password.length >= 6;
  const isConfirmValid = confirmPassword.length > 0 && password === confirmPassword;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
  const canContinueStep1 =
    !!fullName.trim() && !!salonName.trim() && !!phone.trim() && isPhoneValid && !!email.trim() && isEmailValid;
  const canSubmit =
    !isLoading &&
    !!fullName.trim() &&
    !!salonName.trim() &&
    !!email.trim() &&
    !!phone.trim() &&
    isPhoneValid &&
    isEmailValid &&
    isPasswordValid &&
    isConfirmValid &&
    legalAccepted;

  const handleContinue = () => {
    if (!fullName.trim() || !salonName.trim() || !phone.trim() || !email.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!isPhoneValid) { toast.error("Informe um telefone válido."); return; }
    if (!isEmailValid) { toast.error("Informe um e-mail válido."); return; }
    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !salonName.trim() || !phone.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!isPhoneValid) { toast.error("Informe um telefone válido."); return; }
    if (password !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
    if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (!legalAccepted) { toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade."); return; }

    setIsLoading(true);
    const { error } = await signUp(email, password, fullName, salonName, phone, new Date().toISOString());
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      setIsLoading(false);
      return;
    }
    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setSubmitted(true);
    setIsLoading(false);
  };

  return (
    <div className="flex min-h-screen">

      {/* ── Painel Esquerdo — Foto + Branding ── */}
      <div className="relative hidden lg:flex lg:w-[45%] xl:w-[50%] flex-col overflow-hidden">

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
              "linear-gradient(135deg, rgba(15,76,76,0.93) 0%, rgba(13,110,110,0.82) 45%, rgba(8,145,178,0.72) 100%)",
          }}
        />

        {/* Conteúdo sobre a foto */}
        <div className="relative z-10 flex flex-col h-full p-10 xl:p-12">

          {/* Logo */}
          <div className="flex items-center gap-3 mb-auto">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm border border-white/20">
              <Stethoscope className="h-6 w-6 text-white" />
            </div>
            <div>
              <div className="font-display text-2xl font-bold text-white tracking-tight leading-none">ClinicNest</div>
              <div className="text-[10px] text-white/50 tracking-widest uppercase">by Metaclass</div>
            </div>
          </div>

          {/* Headline */}
          <div className="mt-auto mb-8">
            <h1 className="font-display text-3xl xl:text-4xl font-bold text-white leading-tight mb-3">
              Comece grátis.
              <br />
              <span className="text-cyan-300">Sem cartão de crédito.</span>
            </h1>
            <p className="text-white/70 text-base max-w-sm leading-relaxed">
              5 dias para explorar tudo. Configure sua clínica em menos de 10 minutos.
            </p>
          </div>

          {/* Bullets */}
          <div className="flex flex-col gap-3 mb-8">
            {[
              { icon: CalendarDays, label: "Agenda médica pronta para usar" },
              { icon: FileText, label: "Prontuários eletrônicos seguros" },
              { icon: Users, label: "Gestão de equipe e comissões" },
              { icon: Clock, label: "Setup completo em menos de 10 min" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="flex items-center gap-3">
                  <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/20 flex-shrink-0">
                    <Icon className="h-4 w-4 text-cyan-300" />
                  </div>
                  <span className="text-sm text-white/80">{item.label}</span>
                </div>
              );
            })}
          </div>

          {/* Rodapé */}
          <div className="flex items-center justify-between text-white/50 text-xs">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-teal-400" />
              <span>LGPD · SSL · Dados protegidos</span>
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
      <div className="flex w-full lg:w-[55%] xl:w-[50%] flex-col items-center justify-center bg-white px-6 py-10 sm:px-10 xl:px-14 overflow-y-auto">

        {/* Logo mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-8">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
            <Stethoscope className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-teal-700 leading-none">ClinicNest</div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">by Metaclass</div>
          </div>
        </div>

        <div className="w-full max-w-sm">

          {submitted ? (
            /* ── Tela de confirmação de e-mail ── */
            <div className="flex flex-col items-center text-center py-8">
              <div className="mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
                <Mail className="h-8 w-8 text-teal-600" />
              </div>
              <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Verifique seu e-mail</h2>
              <p className="text-sm text-muted-foreground mb-6">
                Enviamos um link de confirmação para{" "}
                <span className="font-semibold text-gray-800">{email}</span>.
                Abra sua caixa de entrada e confirme para continuar.
              </p>
              <Button
                onClick={() => navigate("/login")}
                className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/25"
              >
                Ir para o login
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
              <p className="mt-4 text-xs text-muted-foreground">
                Não encontrou? Verifique o spam ou promoções.
              </p>
            </div>
          ) : (
            <>
              {/* Cabeçalho */}
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-1">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <button
                      type="button"
                      onClick={() => step === 2 && setStep(1)}
                      className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold transition-colors ${
                        step >= 1 ? "bg-teal-600 text-white" : "bg-gray-100 text-muted-foreground"
                      }`}
                    >
                      1
                    </button>
                    <span className={step === 1 ? "font-medium text-gray-700" : "text-muted-foreground"}>Dados</span>
                  </div>
                  <div className="flex-1 h-px bg-gray-200 mx-1" />
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <div
                      className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold transition-colors ${
                        step === 2 ? "bg-teal-600 text-white" : "bg-gray-100 text-muted-foreground"
                      }`}
                    >
                      2
                    </div>
                    <span className={step === 2 ? "font-medium text-gray-700" : "text-muted-foreground"}>Acesso</span>
                  </div>
                </div>
                <h2 className="font-display text-2xl font-bold text-gray-900 mt-4">
                  {step === 1 ? "Crie sua conta" : "Defina sua senha"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {step === 1
                    ? "Dados da clínica e responsável."
                    : "Crie uma senha segura para acessar a plataforma."}
                </p>
              </div>

              {/* Formulário */}
              <form onSubmit={handleSubmit} className="space-y-4">
                {step === 1 ? (
                  <>
                    <div className="space-y-2">
                      <Label htmlFor="fullName" className="text-sm font-medium text-gray-700">Seu nome completo</Label>
                      <Input
                        id="fullName"
                        type="text"
                        placeholder="Dra. Maria Silva"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-500 focus:ring-teal-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="salonName" className="text-sm font-medium text-gray-700">Nome da clínica</Label>
                      <Input
                        id="salonName"
                        type="text"
                        placeholder="Clínica São Lucas"
                        value={salonName}
                        onChange={(e) => setSalonName(e.target.value)}
                        required
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-500 focus:ring-teal-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone" className="text-sm font-medium text-gray-700">Telefone / WhatsApp</Label>
                      <Input
                        id="phone"
                        type="tel"
                        inputMode="tel"
                        placeholder="(11) 99999-9999"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        onInput={(e) => {
                          const input = e.currentTarget;
                          input.value = input.value.replace(/[^0-9()\-\s]/g, "");
                        }}
                        required
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-500 focus:ring-teal-500"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email" className="text-sm font-medium text-gray-700">E-mail</Label>
                      <Input
                        id="email"
                        type="email"
                        placeholder="seu@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        autoComplete="email"
                        required
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-500 focus:ring-teal-500"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleContinue}
                      disabled={!canContinueStep1}
                      className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:scale-[1.01] transition-all"
                    >
                      Continuar
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </>
                ) : (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label htmlFor="password" className="text-sm font-medium text-gray-700">Senha</Label>
                        <div className="relative">
                          <Input
                            id="password"
                            type={showPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                            className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white pr-10 focus:border-teal-500 focus:ring-teal-500"
                          />
                          <button
                            type="button"
                            aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                            onClick={() => setShowPassword((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-sm font-medium text-gray-700">Confirmar</Label>
                        <div className="relative">
                          <Input
                            id="confirmPassword"
                            type={showConfirmPassword ? "text" : "password"}
                            placeholder="••••••••"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            autoComplete="new-password"
                            required
                            className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white pr-10 focus:border-teal-500 focus:ring-teal-500"
                          />
                          <button
                            type="button"
                            aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                            onClick={() => setShowConfirmPassword((v) => !v)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                          >
                            {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Aceite dos termos */}
                    <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3.5">
                      <label htmlFor="legalAccepted" className="flex items-start gap-2.5 text-sm text-muted-foreground cursor-pointer">
                        <input
                          id="legalAccepted"
                          type="checkbox"
                          checked={legalAccepted}
                          onChange={(e) => setLegalAccepted(e.target.checked)}
                          className="mt-0.5 h-4 w-4 rounded border-teal-300 accent-teal-600"
                          required
                        />
                        <span>
                          Li e aceito os{" "}
                          <Link to="/termos-de-uso" className="font-medium text-teal-600 hover:text-teal-700 underline underline-offset-2">
                            Termos de Uso
                          </Link>
                          {" e a "}
                          <Link to="/politica-de-privacidade" className="font-medium text-teal-600 hover:text-teal-700 underline underline-offset-2">
                            Política de Privacidade
                          </Link>
                          .
                        </span>
                      </label>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl border-gray-200"
                        onClick={() => setStep(1)}
                        disabled={isLoading}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="submit"
                        className="h-12 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:scale-[1.01] transition-all"
                        disabled={!canSubmit}
                      >
                        {isLoading ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Criando...
                          </>
                        ) : (
                          <>
                            Criar conta
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </div>
                  </>
                )}
              </form>

              {/* Link para login */}
              <p className="text-center text-sm text-muted-foreground mt-5">
                Já tem uma conta?{" "}
                <Link to="/login" className="font-semibold text-teal-600 hover:text-teal-700 transition-colors">
                  Faça login
                </Link>
              </p>

              {/* Trust badges */}
              <div className="mt-6 flex items-center justify-center gap-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-500" />
                  <span>Conexão segura</span>
                </div>
                <span className="opacity-30">·</span>
                <span>LGPD</span>
                <span className="opacity-30">·</span>
                <span>5 dias grátis</span>
              </div>

              {/* Footer */}
              <div className="mt-6 text-center text-xs text-muted-foreground/60 space-y-1">
                <div className="flex items-center justify-center gap-3">
                  <Link to="/termos-de-uso" className="hover:text-foreground transition-colors">Termos</Link>
                  <span className="opacity-40">·</span>
                  <Link to="/politica-de-privacidade" className="hover:text-foreground transition-colors">Privacidade</Link>
                  <span className="opacity-40">·</span>
                  <a href="mailto:contato@metaclass.com.br" className="hover:text-foreground transition-colors">Suporte</a>
                </div>
                <div>© {new Date().getFullYear()} ClinicNest by Metaclass</div>
              </div>
            </>
          )}
        </div>
      </div>

    </div>
  );
}
