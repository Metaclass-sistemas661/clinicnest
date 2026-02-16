import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRight,
  CalendarDays,
  Eye,
  EyeOff,
  Headset,
  Loader2,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
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
    !!fullName.trim() &&
    !!salonName.trim() &&
    !!phone.trim() &&
    isPhoneValid &&
    !!email.trim() &&
    isEmailValid;
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

    if (!isPhoneValid) {
      toast.error("Informe um telefone válido.");
      return;
    }

    if (!isEmailValid) {
      toast.error("Informe um e-mail válido.");
      return;
    }

    setStep(2);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fullName.trim() || !salonName.trim() || !phone.trim() || !email.trim() || !password || !confirmPassword) {
      toast.error("Preencha todos os campos obrigatórios.");
      return;
    }

    if (!isPhoneValid) {
      toast.error("Informe um telefone válido.");
      return;
    }

    if (password !== confirmPassword) {
      toast.error("As senhas não coincidem");
      return;
    }

    if (password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }

    if (!legalAccepted) {
      toast.error("Você precisa aceitar os Termos de Uso e a Política de Privacidade.");
      return;
    }

    setIsLoading(true);

    const { error } = await signUp(
      email,
      password,
      fullName,
      salonName,
      phone,
      new Date().toISOString()
    );

    if (error) {
      toast.error("Erro ao criar conta", {
        description: error.message,
      });
      setIsLoading(false);
      return;
    }

    toast.success("Conta criada! Verifique seu e-mail para confirmar.");
    setSubmitted(true);
    setIsLoading(false);
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
          <div className="hidden lg:flex flex-col rounded-3xl bg-gradient-to-br from-violet-950 via-fuchsia-900 to-violet-950 p-10">
            <div className="mb-10">
              <div className="mb-6 relative inline-block">
                <img
                  src="/beautyg.logo.png"
                  alt="BeautyGest"
                  className="h-24 w-24 object-contain"
                  loading="eager"
                />
                <div className="absolute -inset-4 rounded-3xl bg-gradient-to-r from-white/10 to-white/0 blur-2xl -z-10" />
              </div>
              <p className="mt-3 text-white/80 max-w-md">
                Crie sua conta e confirme seu e-mail para começar.
              </p>
            </div>

            <div className="space-y-4 max-w-md">
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <CalendarDays className="h-5 w-5 text-white mt-0.5" />
                <div>
                  <div className="font-medium text-white">Agenda e atendimento</div>
                  <div className="text-sm text-white/75">Organize horários, serviços e profissionais.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <Users className="h-5 w-5 text-white mt-0.5" />
                <div>
                  <div className="font-medium text-white">Clientes e recorrência</div>
                  <div className="text-sm text-white/75">Histórico e relacionamento em um só lugar.</div>
                </div>
              </div>
              <div className="flex gap-3 rounded-2xl border border-white/10 bg-white/10 p-4 backdrop-blur">
                <Wallet className="h-5 w-5 text-white mt-0.5" />
                <div>
                  <div className="font-medium text-white">Financeiro e comissões</div>
                  <div className="text-sm text-white/75">Controle entradas, saídas e repasses.</div>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4 text-sm text-white/80">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-white" />
                <span>Conexão segura</span>
              </div>
              <div className="flex items-center gap-2">
                <Headset className="h-4 w-4 text-white" />
                <span>Suporte por e-mail</span>
              </div>
            </div>
          </div>

          <div className="w-full max-w-md justify-self-center">
            <div className="mb-10 flex flex-col items-center lg:hidden rounded-3xl bg-gradient-to-br from-violet-950 via-fuchsia-900 to-violet-950 p-6 text-center">
              <img
                src="/beautyg.logo.png"
                alt="BeautyGest"
                className="h-24 w-24 object-contain"
                loading="eager"
              />
              <p className="mt-3 text-white/80">Gestão profissional para seu salão</p>
            </div>

            <Card className="border-violet-100/60 bg-white/80 shadow-2xl backdrop-blur-md">
              <CardHeader className="space-y-1 text-center pb-2">
                <CardTitle className="text-2xl font-display">Crie sua conta</CardTitle>
                <CardDescription>
                  Confirme seu e-mail para liberar o acesso.
                </CardDescription>
              </CardHeader>

              {submitted ? (
                <CardContent className="space-y-4 pt-2">
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-violet-100 text-violet-700">
                      <Mail className="h-7 w-7" />
                    </div>
                    <h2 className="font-display text-xl font-semibold text-foreground">
                      Verifique seu e-mail
                    </h2>
                    <p className="mt-2 text-sm text-muted-foreground max-w-sm">
                      Enviamos um link de confirmação para <span className="font-medium text-foreground">{email}</span>.
                      Abra sua caixa de entrada e confirme para continuar.
                    </p>
                    <div className="mt-6 flex w-full flex-col gap-3">
                      <Button
                        type="button"
                        onClick={() => navigate("/login")}
                        className="h-12 w-full rounded-xl gradient-primary text-white font-semibold shadow-glow"
                      >
                        Ir para o login
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                      <p className="text-xs text-muted-foreground">
                        Se não encontrar, verifique o spam ou promoções.
                      </p>
                    </div>
                  </div>
                </CardContent>
              ) : (
                <form onSubmit={handleSubmit}>
                  <CardContent className="space-y-4 pt-2">
                    <div className="flex items-center justify-center gap-2 pb-1 text-xs text-muted-foreground">
                      <span className={step === 1 ? "font-medium text-foreground" : ""}>1. Dados</span>
                      <span className="opacity-40">›</span>
                      <span className={step === 2 ? "font-medium text-foreground" : ""}>2. Acesso</span>
                    </div>

                    {step === 1 ? (
                      <>
                        <div className="space-y-2">
                          <Label htmlFor="fullName" className="text-sm font-medium">Seu nome</Label>
                          <Input
                            id="fullName"
                            type="text"
                            placeholder="Maria Silva"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            required
                            className="h-11 rounded-xl border-violet-100 bg-white/70 backdrop-blur-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="salonName" className="text-sm font-medium">Nome do salão</Label>
                          <Input
                            id="salonName"
                            type="text"
                            placeholder="Salão Beleza & Estilo"
                            value={salonName}
                            onChange={(e) => setSalonName(e.target.value)}
                            required
                            className="h-11 rounded-xl border-violet-100 bg-white/70 backdrop-blur-sm"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label htmlFor="phone" className="text-sm font-medium">Telefone / Celular</Label>
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
                            className="h-11 rounded-xl border-violet-100 bg-white/70 backdrop-blur-sm"
                          />
                        </div>
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
                            className="h-11 rounded-xl border-violet-100 bg-white/70 backdrop-blur-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-2">
                            <Label htmlFor="password" className="text-sm font-medium">Senha</Label>
                            <div className="relative">
                              <Input
                                id="password"
                                type={showPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                                className="h-11 rounded-xl border-violet-100 bg-white/70 pr-10 backdrop-blur-sm"
                              />
                              <button
                                type="button"
                                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                                onClick={() => setShowPassword((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-sm font-medium">Confirmar</Label>
                            <div className="relative">
                              <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                placeholder="••••••••"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                autoComplete="new-password"
                                required
                                className="h-11 rounded-xl border-violet-100 bg-white/70 pr-10 backdrop-blur-sm"
                              />
                              <button
                                type="button"
                                aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                                onClick={() => setShowConfirmPassword((v) => !v)}
                                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                              >
                                {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                        <div className="rounded-lg border border-violet-100 bg-violet-50/40 p-3">
                          <label htmlFor="legalAccepted" className="flex items-start gap-2 text-sm text-muted-foreground">
                            <input
                              id="legalAccepted"
                              type="checkbox"
                              checked={legalAccepted}
                              onChange={(e) => setLegalAccepted(e.target.checked)}
                              className="mt-0.5 h-4 w-4 rounded border-violet-200"
                              required
                            />
                            <span>
                              Li e aceito os{" "}
                              <Link to="/termos-de-uso" className="font-medium text-primary hover:text-accent underline underline-offset-2">
                                Termos de Uso
                              </Link>
                              {" "+"e a"+" "}
                              <Link to="/politica-de-privacidade" className="font-medium text-primary hover:text-accent underline underline-offset-2">
                                Política de Privacidade
                              </Link>
                              .
                            </span>
                          </label>
                        </div>
                      </>
                    )}
                  </CardContent>

                  <CardFooter className="flex flex-col gap-4 pt-2">
                    {step === 1 ? (
                      <Button
                        type="button"
                        className="h-12 w-full rounded-xl gradient-primary text-white font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
                        onClick={handleContinue}
                        disabled={isLoading || !canContinueStep1}
                      >
                        Continuar
                        <ArrowRight className="ml-2 h-5 w-5" />
                      </Button>
                    ) : (
                      <>
                        <div className="grid w-full grid-cols-2 gap-3">
                          <Button
                            type="button"
                            variant="outline"
                            className="h-12 w-full rounded-xl"
                            onClick={() => setStep(1)}
                            disabled={isLoading}
                          >
                            Voltar
                          </Button>
                          <Button
                            type="submit"
                            className="h-12 w-full rounded-xl gradient-primary text-white font-semibold shadow-glow hover:shadow-xl hover:scale-[1.02] transition-all duration-300"
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

                    <p className="text-center text-sm text-muted-foreground">
                      Já tem uma conta?{" "}
                      <Link
                        to="/login"
                        className="font-semibold text-primary hover:text-accent transition-colors"
                      >
                        Faça login
                      </Link>
                    </p>
                    <div className="pt-1 text-center text-xs text-muted-foreground">
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
                          href="mailto:contato@metaclass.com.br"
                          className="hover:text-foreground transition-colors"
                        >
                          Suporte
                        </a>
                      </div>
                      <div className="mt-2">© {new Date().getFullYear()} BeautyGest</div>
                    </div>
                  </CardFooter>
                </form>
              )}
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
