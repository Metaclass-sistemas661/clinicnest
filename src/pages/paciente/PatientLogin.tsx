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
  ArrowLeft,
  ShieldCheck,
  Stethoscope,
  Heart,
  Calendar,
  FileText,
  Video,
  CheckCircle2,
  KeyRound,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";
import { apiPatient } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import TurnstileWidget, { useTurnstile } from "@/components/auth/TurnstileWidget";
import { PasswordStrengthIndicator, isPasswordValid } from "@/components/patient/PasswordStrengthIndicator";

type Step = "identify" | "login" | "create_password" | "success";

interface PatientInfo {
  patient_id: string;
  masked_name: string;
  masked_email: string | null;
  clinic_name: string | null;
  status: "new" | "has_account";
}

export default function PatientLogin() {
  const [step, setStep] = useState<Step>("identify");
  const [identifier, setIdentifier] = useState("");
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null);

  // Login fields
  const [loginEmail, setLoginEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Create password fields
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);

  const navigate = useNavigate();
  const { token: captchaToken, onVerify, onExpire, onError, reset: resetCaptcha } = useTurnstile();

  const normalizeAuthError = (message: string) => {
    const m = message.toLowerCase();
    if (m.includes("invalid login credentials") || m.includes("invalid credentials"))
      return "Senha incorreta.";
    if (m.includes("email not confirmed"))
      return "Confirme seu e-mail antes de entrar.";
    if (m.includes("too many requests") || m.includes("rate limit"))
      return "Muitas tentativas. Aguarde um pouco e tente novamente.";
    if (m.includes("user not found"))
      return "Conta não encontrada. Verifique seus dados.";
    if (m.includes("captcha"))
      return "Erro na verificação de segurança. Recarregue a página e tente novamente.";
    if (m.includes("fetch") || m.includes("network") || m.includes("failed to fetch"))
      return "Erro de conexão. Verifique sua internet e tente novamente.";
    return message;
  };

  // ── Step 1: Identify patient by code or CPF ──
  const handleIdentify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier.trim()) return;
    setIsLoading(true);

    try {
      const { data, error } = await apiPatient.rpc("validate_patient_access", {
        p_identifier: identifier.trim(),
      });

      if (error) {
        logger.error("validate_patient_access error:", error);
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("timeout") || msg.includes("statement"))
          toast.error("Servidor lento", { description: "Tente novamente em alguns segundos." });
        else if (msg.includes("fetch") || msg.includes("network"))
          toast.error("Erro de conexão", { description: "Verifique sua internet e tente novamente." });
        else
          toast.error("Erro ao verificar código", { description: "Tente novamente ou entre em contato com a clínica." });
        return;
      }

      if (!data?.found) {
        toast.error("Paciente não encontrado", {
          description: "Verifique o código de acesso ou CPF informado.",
        });
        return;
      }

      const info: PatientInfo = {
        patient_id: data.patient_id,
        masked_name: data.masked_name || "Paciente",
        masked_email: data.masked_email,
        clinic_name: data.clinic_name,
        status: data.status,
      };
      setPatientInfo(info);

      if (data.status === "has_account") {
        setStep("login");
      } else {
        setStep("create_password");
      }
    } catch (err) {
      logger.error("Identify error:", err);
      toast.error("Erro inesperado");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2a: Login with existing account ──
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim() || !password) return;
    setIsLoading(true);

    try {
      const { data, error } = await apiPatient.auth.signInWithPassword({
        email: loginEmail.trim(),
        password,
        options: captchaToken ? { captchaToken } : undefined,
      });

      if (error) {
        toast.error("Erro ao fazer login", { description: normalizeAuthError(error.message) });
        resetCaptcha();
        return;
      }

      const accountType = data.user?.user_metadata?.account_type;
      if (accountType !== "patient") {
        await apiPatient.auth.signOut();
        toast.error("Esta conta não é de paciente.", {
          description: "Use o login de clínica se for profissional.",
        });
        return;
      }

      toast.success("Login realizado com sucesso!");
      localStorage.setItem("patient-session-start", Date.now().toString());
      navigate("/paciente/dashboard", { replace: true });
    } catch {
      toast.error("Erro inesperado ao fazer login");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Step 2b: Create password (first access) ──
  const handleCreatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!patientInfo) return;

    if (newPassword !== confirmPassword) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (!isPasswordValid(newPassword)) {
      toast.error("A senha deve conter pelo menos 1 letra maiúscula e 1 número.");
      return;
    }
    if (!email.trim()) {
      toast.error("Informe um e-mail para sua conta.");
      return;
    }

    setIsLoading(true);

    try {
      const { data, error } = await apiPatient.functions.invoke("activate-patient-account", {
        body: {
          patient_id: patientInfo.patient_id,
          email: email.trim(),
          password: newPassword,
          full_name: patientInfo.masked_name,
        },
      });

      if (error) {
        logger.error("activate-patient-account invoke error:", error);
        const msg = error.message?.toLowerCase() || "";
        if (msg.includes("already") || msg.includes("exists") || msg.includes("já"))
          toast.error("Este e-mail já está em uso", { description: "Tente fazer login ou use outro e-mail." });
        else if (msg.includes("fetch") || msg.includes("network"))
          toast.error("Erro de conexão", { description: "Verifique sua internet e tente novamente." });
        else
          toast.error("Erro ao criar conta", { description: "Tente novamente ou entre em contato com a clínica." });
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      setStep("success");
    } catch (err) {
      logger.error("Create password error:", err);
      toast.error("Erro inesperado ao criar conta");
    } finally {
      setIsLoading(false);
    }
  };

  // ── Auto-login after account creation ──
  const handleAutoLogin = async () => {
    if (!email || !newPassword) {
      navigate("/paciente/login", { replace: true });
      return;
    }
    setIsLoading(true);
    try {
      const { error } = await apiPatient.auth.signInWithPassword({
        email: email.trim(),
        password: newPassword,
      });
      if (error) {
        toast.error("Conta criada! Faça login manualmente.");
        goToStart();
        return;
      }
      toast.success("Bem-vindo ao portal!");
      localStorage.setItem("patient-session-start", Date.now().toString());
      navigate("/paciente/dashboard", { replace: true });
    } catch {
      goToStart();
    } finally {
      setIsLoading(false);
    }
  };

  const goToStart = () => {
    setStep("identify");
    setIdentifier("");
    setPatientInfo(null);
    setLoginEmail("");
    setPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setEmail("");
  };

  // ── Render right panel content based on step ──
  const renderFormContent = () => {
    // ── SUCCESS ──
    if (step === "success") {
      return (
        <div className="text-center space-y-6">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-100">
            <CheckCircle2 className="h-8 w-8 text-green-600" />
          </div>
          <div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-2">Conta criada!</h2>
            <p className="text-muted-foreground text-sm">
              Olá, <strong>{patientInfo?.masked_name}</strong>! Sua conta foi ativada com sucesso.
            </p>
          </div>
          <Button
            onClick={handleAutoLogin}
            disabled={isLoading}
            className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold shadow-lg shadow-teal-500/25 transition-all duration-300 text-base"
          >
            {isLoading ? (
              <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Entrando...</>
            ) : (
              <>Acessar meu portal<ArrowRight className="ml-2 h-5 w-5" /></>
            )}
          </Button>
        </div>
      );
    }

    // ── IDENTIFY ──
    if (step === "identify") {
      return (
        <>
          <div className="mb-8">
            <h2 className="font-display text-3xl font-bold text-gray-900 mb-2">Olá, paciente!</h2>
            <p className="text-muted-foreground text-sm">
              Informe seu <strong>código de acesso</strong> ou <strong>CPF</strong> para continuar.
            </p>
          </div>

          <form onSubmit={handleIdentify} className="space-y-5" data-allow-enter-submit>
            <div className="space-y-2">
              <Label htmlFor="patient-identifier" className="text-sm font-medium text-gray-700">
                Código de acesso ou CPF
              </Label>
              <Input
                id="patient-identifier"
                type="text"
                placeholder="PAC-XXXXXX ou 000.000.000-00"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="off"
                autoFocus
                required
                className="h-12 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-teal-500 focus:ring-teal-500 transition-colors uppercase"
              />
              <p className="text-xs text-muted-foreground">
                O código foi fornecido pela sua clínica ao realizar seu cadastro.
              </p>
            </div>

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.01] transition-all duration-300 text-base"
              disabled={isLoading || !identifier.trim()}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Verificando...</>
              ) : (
                <>Continuar<ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </form>
        </>
      );
    }

    // ── LOGIN (existing account) ──
    if (step === "login") {
      return (
        <>
          <button
            type="button"
            onClick={goToStart}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                <UserCheck className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{patientInfo?.masked_name}</h3>
                {patientInfo?.clinic_name && (
                  <p className="text-xs text-muted-foreground">{patientInfo.clinic_name}</p>
                )}
              </div>
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-1">Bem-vindo de volta!</h2>
            <p className="text-muted-foreground text-sm">
              Informe seu e-mail e senha para acessar o portal.
              {patientInfo?.masked_email && (
                <span className="block mt-1 text-xs">Dica: {patientInfo.masked_email}</span>
              )}
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-5" data-allow-enter-submit>
            <div className="space-y-2">
              <Label htmlFor="patient-login-email" className="text-sm font-medium text-gray-700">
                E-mail
              </Label>
              <Input
                id="patient-login-email"
                type="email"
                placeholder="seu@email.com"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                autoComplete="email"
                autoFocus
                required
                className="h-12 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-teal-500 focus:ring-teal-500 transition-colors"
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="patient-password" className="text-sm font-medium text-gray-700">
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
                  id="patient-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  autoFocus
                  required
                  className="h-12 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white pr-12 focus:border-teal-500 focus:ring-teal-500 transition-colors"
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

            <TurnstileWidget
              onVerify={onVerify}
              onExpire={onExpire}
              onError={onError}
              theme="light"
              className="flex justify-center"
            />

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.01] transition-all duration-300 text-base"
              disabled={isLoading || !loginEmail.trim() || !password}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Entrando...</>
              ) : (
                <>Acessar meu portal<ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </form>
        </>
      );
    }

    // ── CREATE PASSWORD (first access) ──
    if (step === "create_password") {
      return (
        <>
          <button
            type="button"
            onClick={goToStart}
            className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-6"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </button>

          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100">
                <KeyRound className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <h3 className="font-semibold text-gray-900">{patientInfo?.masked_name}</h3>
                {patientInfo?.clinic_name && (
                  <p className="text-xs text-muted-foreground">{patientInfo.clinic_name}</p>
                )}
              </div>
            </div>
            <h2 className="font-display text-2xl font-bold text-gray-900 mb-1">Primeiro acesso</h2>
            <p className="text-muted-foreground text-sm">
              Crie uma senha para acessar seu portal do paciente.
            </p>
          </div>

          <form onSubmit={handleCreatePassword} className="space-y-4" data-allow-enter-submit>
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
                className="h-11 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-teal-500 focus:ring-teal-500 transition-colors"
              />
              <p className="text-xs text-muted-foreground">
                Informe o e-mail que deseja usar para acessar o portal.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-new-password" className="text-sm font-medium text-gray-700">
                Criar senha
              </Label>
              <div className="relative">
                <Input
                  id="patient-new-password"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Mínimo 8 caracteres"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  autoFocus
                  required
                  minLength={8}
                  className="h-11 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white pr-12 focus:border-teal-500 focus:ring-teal-500 transition-colors"
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? "Ocultar senha" : "Mostrar senha"}
                  onClick={() => setShowNewPassword((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                >
                  {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              <PasswordStrengthIndicator password={newPassword} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="patient-confirm-password" className="text-sm font-medium text-gray-700">
                Confirmar senha
              </Label>
              <Input
                id="patient-confirm-password"
                type="password"
                placeholder="Repita a senha"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                required
                minLength={8}
                className="h-11 rounded-xl border-gray-200 bg-gray-50 text-gray-900 placeholder:text-gray-400 focus:bg-white focus:border-teal-500 focus:ring-teal-500 transition-colors"
              />
            </div>

            <TurnstileWidget
              onVerify={onVerify}
              onExpire={onExpire}
              onError={onError}
              theme="light"
              className="flex justify-center"
            />

            <Button
              type="submit"
              className="h-12 w-full rounded-xl bg-gradient-to-r from-teal-600 to-teal-500 hover:from-teal-700 hover:to-teal-600 text-white font-semibold shadow-lg shadow-teal-500/25 hover:shadow-teal-500/40 hover:scale-[1.01] transition-all duration-300 text-base"
              disabled={isLoading || !email.trim() || !newPassword || !confirmPassword}
            >
              {isLoading ? (
                <><Loader2 className="mr-2 h-5 w-5 animate-spin" />Criando conta...</>
              ) : (
                <>Criar minha conta<ArrowRight className="ml-2 h-5 w-5" /></>
              )}
            </Button>
          </form>
        </>
      );
    }

    return null;
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
              "linear-gradient(135deg, rgba(13,148,136,0.90) 0%, rgba(20,184,166,0.78) 40%, rgba(45,212,191,0.68) 100%)",
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
              <span className="text-teal-200">na palma da mão.</span>
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
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-300/20 flex-shrink-0">
                    <Icon className="h-5 w-5 text-teal-200" />
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
            <ShieldCheck className="h-3.5 w-3.5 text-teal-300" />
            <span>Dados protegidos · LGPD · Conexão criptografada</span>
          </div>
        </div>
      </div>

      {/* ── Painel Direito — Formulário ── */}
      <div className="flex w-full lg:w-[45%] xl:w-[40%] flex-col items-center justify-center bg-white px-6 py-12 sm:px-10 xl:px-16 relative">

        {/* Botão Voltar */}
        <Link
          to="/"
          className="absolute top-6 left-6 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-gray-900 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Voltar
        </Link>

        {/* Logo mobile */}
        <div className="flex lg:hidden items-center gap-3 mb-10">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-600">
            <Heart className="h-5 w-5 text-white" />
          </div>
          <div>
            <div className="font-display text-xl font-bold text-teal-700 leading-none">ClinicNest</div>
            <div className="text-[9px] text-muted-foreground tracking-widest uppercase">Portal do Paciente</div>
          </div>
        </div>

        <div className="w-full max-w-sm">
          {/* Badge */}
          <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-50 border border-teal-100 px-3 py-1 text-xs font-medium text-teal-700 mb-6">
            <Heart className="h-3 w-3" />
            Portal do Paciente
          </div>

          {renderFormContent()}

          {step !== "success" && (
            <>
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
                  <ShieldCheck className="h-3.5 w-3.5 text-teal-500" />
                  <span>Conexão segura</span>
                </div>
                <span className="opacity-30">·</span>
                <span>LGPD</span>
              </div>
            </>
          )}

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
