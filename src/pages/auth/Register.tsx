import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ArrowRight,
  BadgeCheck,
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
import TurnstileWidget, { useTurnstile, isTurnstileEnabled } from "@/components/auth/TurnstileWidget";
import type { ProfessionalType } from "@/types/database";
import { COUNCIL_BY_TYPE, PROFESSIONAL_TYPE_LABELS } from "@/types/database";
import { BRAZILIAN_STATES } from "@/utils/brazilianStates";
import {
  requiresCouncil,
  getCouncilType,
  validateCouncilFormat,
  validateCouncilAsync,
} from "@/utils/councilValidation";

/** Tipos profissionais disponíveis para cadastro (exclui perfis puramente administrativos) */
const REGISTRATION_PROFESSIONAL_TYPES: ProfessionalType[] = [
  "medico",
  "dentista",
  "enfermeiro",
  "fisioterapeuta",
  "nutricionista",
  "psicologo",
  "fonoaudiologo",
  "tec_enfermagem",
  "secretaria",
  "faturista",
  "admin",
];

export default function Register() {
  const [fullName, setFullName] = useState("");
  const [clinicName, setClinicName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [legalAccepted, setLegalAccepted] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Campos profissionais
  const [professionalType, setProfessionalType] = useState<ProfessionalType | "">("");
  const [councilNumber, setCouncilNumber] = useState("");
  const [councilState, setCouncilState] = useState("");
  const [councilError, setCouncilError] = useState("");
  const [isValidatingCouncil, setIsValidatingCouncil] = useState(false);
  const [councilValidated, setCouncilValidated] = useState(false);

  const { signUp } = useAuth();
  const navigate = useNavigate();
  const { token: captchaToken, onVerify, onExpire, onError, reset: resetCaptcha } = useTurnstile();

  const phoneDigits = phone.replace(/\D/g, "");
  const isPhoneValid = phoneDigits.length >= 10;
  const isPasswordValid = password.length >= 6;
  const isConfirmValid = confirmPassword.length > 0 && password === confirmPassword;
  const isEmailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const needsCouncil = professionalType ? requiresCouncil(professionalType as ProfessionalType) : false;
  const councilType = professionalType ? getCouncilType(professionalType as ProfessionalType) : null;

  const canContinueStep1 =
    !!fullName.trim() && !!clinicName.trim() && !!phone.trim() && isPhoneValid && !!email.trim() && isEmailValid;

  const canContinueStep2 = (() => {
    if (!professionalType) return false;
    if (needsCouncil) {
      if (!councilNumber.trim() || !councilState) return false;
      if (councilError) return false;
    }
    return true;
  })();

  const canSubmit =
    !isLoading &&
    canContinueStep1 &&
    canContinueStep2 &&
    isPasswordValid &&
    isConfirmValid &&
    legalAccepted &&
    (!isTurnstileEnabled || !!captchaToken);

  const handleContinueStep1 = () => {
    if (!fullName.trim() || !clinicName.trim() || !phone.trim() || !email.trim()) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (!isPhoneValid) { toast.error("Informe um telefone válido."); return; }
    if (!isEmailValid) { toast.error("Informe um e-mail válido."); return; }
    setStep(2);
  };

  const handleCouncilNumberBlur = async () => {
    if (!councilType || !councilNumber.trim()) {
      setCouncilError("");
      setCouncilValidated(false);
      return;
    }

    // Validação de formato local
    const formatResult = validateCouncilFormat(councilType, councilNumber.trim());
    if (!formatResult.valid) {
      setCouncilError(formatResult.message);
      setCouncilValidated(false);
      return;
    }

    if (!councilState) {
      setCouncilError("");
      setCouncilValidated(false);
      return;
    }

    // Validação assíncrona (tenta API, fallback para formato)
    setIsValidatingCouncil(true);
    setCouncilError("");
    try {
      const result = await validateCouncilAsync(councilType, councilNumber.trim(), councilState);
      if (!result.valid) {
        setCouncilError(result.message);
        setCouncilValidated(false);
      } else {
        setCouncilError("");
        setCouncilValidated(true);
        if (!result.formatOnly) {
          toast.success(`${councilType} ${councilNumber}/${councilState} verificado com sucesso!`);
        }
      }
    } finally {
      setIsValidatingCouncil(false);
    }
  };

  const handleContinueStep2 = () => {
    if (!professionalType) {
      toast.error("Selecione sua profissão.");
      return;
    }
    if (needsCouncil && !councilNumber.trim()) {
      toast.error(`Informe o número do ${councilType}.`);
      return;
    }
    if (needsCouncil && !councilState) {
      toast.error("Selecione a UF do conselho.");
      return;
    }
    if (councilError) {
      toast.error("Corrija o número do conselho antes de continuar.");
      return;
    }
    setStep(3);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }
    if (password !== confirmPassword) { toast.error("As senhas não coincidem"); return; }
    if (password.length < 6) { toast.error("A senha deve ter pelo menos 6 caracteres"); return; }
    if (!legalAccepted) { toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade."); return; }

    setIsLoading(true);
    const { error } = await signUp(
      email,
      password,
      fullName,
      clinicName,
      phone,
      new Date().toISOString(),
      {
        professional_type: professionalType || undefined,
        council_type: councilType || undefined,
        council_number: needsCouncil ? councilNumber.trim() : undefined,
        council_state: needsCouncil ? councilState : undefined,
      },
      captchaToken ?? undefined,
    );
    if (error) {
      toast.error("Erro ao criar conta", { description: error.message });
      resetCaptcha();
      setIsLoading(false);
      return;
    }
    toast.success("Conta criada com sucesso!", { description: "Verifique seu e-mail para confirmar." });
    setSubmitted(true);
    setIsLoading(false);
  };

  /** Stepper indicators */
  const StepIndicator = () => (
    <div className="flex items-center gap-3 mb-1">
      {[
        { num: 1 as const, label: "Dados" },
        { num: 2 as const, label: "Profissão" },
        { num: 3 as const, label: "Acesso" },
      ].map((s, i, arr) => (
        <div key={s.num} className="flex items-center gap-1.5">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <button
              type="button"
              onClick={() => {
                if (s.num < step) setStep(s.num);
              }}
              className={`flex items-center justify-center h-6 w-6 rounded-full text-xs font-semibold transition-colors ${
                step >= s.num ? "bg-teal-600 text-white" : "bg-gray-100 text-muted-foreground"
              }`}
            >
              {s.num}
            </button>
            <span className={step === s.num ? "font-medium text-gray-700" : "text-muted-foreground"}>
              {s.label}
            </span>
          </div>
          {i < arr.length - 1 && <div className="flex-1 h-px bg-gray-200 mx-1 w-6" />}
        </div>
      ))}
    </div>
  );

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
              7 dias para explorar tudo. Configure sua clínica em menos de 10 minutos.
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
                <StepIndicator />
                <h2 className="font-display text-2xl font-bold text-gray-900 mt-4">
                  {step === 1 ? "Crie sua conta" : step === 2 ? "Sua profissão" : "Defina sua senha"}
                </h2>
                <p className="text-sm text-muted-foreground mt-1">
                  {step === 1
                    ? "Dados da clínica e responsável."
                    : step === 2
                    ? "Informe sua profissão e registro profissional."
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
                      <Label htmlFor="clinicName" className="text-sm font-medium text-gray-700">Nome da clínica</Label>
                      <Input
                        id="clinicName"
                        type="text"
                        placeholder="Clínica São Lucas"
                        value={clinicName}
                        onChange={(e) => setClinicName(e.target.value)}
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
                      onClick={handleContinueStep1}
                      disabled={!canContinueStep1}
                      className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:scale-[1.01] transition-all"
                    >
                      Continuar
                      <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                  </>
                ) : step === 2 ? (
                  <>
                    {/* Seleção de profissão */}
                    <div className="space-y-2">
                      <Label htmlFor="professionalType" className="text-sm font-medium text-gray-700">
                        Sua profissão
                      </Label>
                      <Select
                        value={professionalType}
                        onValueChange={(val) => {
                          setProfessionalType(val as ProfessionalType);
                          setCouncilNumber("");
                          setCouncilState("");
                          setCouncilError("");
                          setCouncilValidated(false);
                        }}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-gray-200 bg-gray-50 focus:bg-white focus:border-teal-500 focus:ring-teal-500">
                          <SelectValue placeholder="Selecione sua profissão" />
                        </SelectTrigger>
                        <SelectContent>
                          {REGISTRATION_PROFESSIONAL_TYPES.map((type) => (
                            <SelectItem key={type} value={type}>
                              {PROFESSIONAL_TYPE_LABELS[type]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Campos de conselho (condicional) */}
                    {needsCouncil && councilType && (
                      <>
                        <div className="rounded-xl border border-teal-100 bg-teal-50/40 p-3 space-y-3">
                          <p className="text-xs font-medium text-teal-700">
                            Registro no {councilType}
                          </p>
                          <div className="grid grid-cols-[1fr_auto] gap-3">
                            <div className="space-y-1.5">
                              <Label htmlFor="councilNumber" className="text-xs text-gray-600">
                                Número do {councilType}
                              </Label>
                              <div className="relative">
                                <Input
                                  id="councilNumber"
                                  type="text"
                                  placeholder={councilType === "CRP" ? "06/12345" : councilType === "CRFa" ? "2-12345" : "123456"}
                                  value={councilNumber}
                                  onChange={(e) => {
                                    setCouncilNumber(e.target.value);
                                    setCouncilError("");
                                    setCouncilValidated(false);
                                  }}
                                  onBlur={handleCouncilNumberBlur}
                                  className="h-10 rounded-lg border-gray-200 bg-white focus:border-teal-500 focus:ring-teal-500 pr-8"
                                />
                                {isValidatingCouncil && (
                                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-teal-600" />
                                )}
                                {councilValidated && !councilError && !isValidatingCouncil && (
                                  <BadgeCheck className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                                )}
                              </div>
                            </div>
                            <div className="space-y-1.5">
                              <Label htmlFor="councilState" className="text-xs text-gray-600">
                                UF
                              </Label>
                              <Select
                                value={councilState}
                                onValueChange={(val) => {
                                  setCouncilState(val);
                                  setCouncilError("");
                                  setCouncilValidated(false);
                                }}
                              >
                                <SelectTrigger className="h-10 w-[90px] rounded-lg border-gray-200 bg-white focus:border-teal-500 focus:ring-teal-500">
                                  <SelectValue placeholder="UF" />
                                </SelectTrigger>
                                <SelectContent className="max-h-[200px]">
                                  {BRAZILIAN_STATES.map((s) => (
                                    <SelectItem key={s.value} value={s.value}>
                                      {s.value}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                          {councilError && (
                            <p className="text-xs text-red-600">{councilError}</p>
                          )}
                        </div>
                      </>
                    )}

                    {/* Nota para profissões sem conselho */}
                    {professionalType && !needsCouncil && (
                      <div className="rounded-xl border border-gray-100 bg-gray-50/50 p-3">
                        <p className="text-xs text-muted-foreground">
                          A profissão <strong>{PROFESSIONAL_TYPE_LABELS[professionalType as ProfessionalType]}</strong> não requer
                          registro em conselho profissional.
                        </p>
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl border-gray-200"
                        onClick={() => setStep(1)}
                      >
                        Voltar
                      </Button>
                      <Button
                        type="button"
                        onClick={handleContinueStep2}
                        disabled={!canContinueStep2 || isValidatingCouncil}
                        className="h-12 rounded-xl bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:scale-[1.01] transition-all"
                      >
                        {isValidatingCouncil ? (
                          <>
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            Verificando...
                          </>
                        ) : (
                          <>
                            Continuar
                            <ArrowRight className="ml-2 h-5 w-5" />
                          </>
                        )}
                      </Button>
                    </div>
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

                    <div className="grid grid-cols-2 gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-xl border-gray-200"
                        onClick={() => setStep(2)}
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
                <span>7 dias grátis</span>
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
