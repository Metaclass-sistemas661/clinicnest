import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { 
  CreditCard, Check, Sparkles, Crown, Loader2, Calendar, RefreshCw, Settings,
  Stethoscope, Building2, Shield
} from "lucide-react";
import { toast } from "sonner";
import { formatInAppTz } from "@/lib/date";

type TierKey = "starter" | "solo" | "clinic" | "premium";
type IntervalKey = "monthly" | "annual";

const intervalNames: Record<IntervalKey, string> = {
  monthly: "Mensal",
  annual: "Anual",
};

const tierNames: Record<TierKey, string> = {
  starter: "Starter",
  solo: "Solo",
  clinic: "Clínica",
  premium: "Premium",
};

const tierIcons: Record<TierKey, React.ElementType> = {
  starter: Stethoscope,
  solo: Stethoscope,
  clinic: Building2,
  premium: Shield,
};

const PRICING: Record<TierKey, Record<IntervalKey, { label: string; amountCents: number; perMonth?: string; savings?: string }>> = {
  starter: {
    monthly: { label: "R$89,90", amountCents: 8990 },
    annual:  { label: "R$809,00", amountCents: 80900, perMonth: "R$67,42/mês", savings: "Economize R$269,80/ano" },
  },
  solo: {
    monthly: { label: "R$159,90", amountCents: 15990 },
    annual:  { label: "R$1.439,10", amountCents: 143910, perMonth: "R$119,93/mês", savings: "Economize R$479,70/ano" },
  },
  clinic: {
    monthly: { label: "R$289,90", amountCents: 28990 },
    annual:  { label: "R$2.609,10", amountCents: 260910, perMonth: "R$217,43/mês", savings: "Economize R$869,70/ano" },
  },
  premium: {
    monthly: { label: "R$399,90", amountCents: 39990 },
    annual:  { label: "R$3.599,00", amountCents: 359900, perMonth: "R$299,92/mês", savings: "Economize R$1.199,80/ano" },
  },
};

const tiers: Array<{
  key: TierKey;
  tagline: string;
  description: string;
  recommended?: boolean;
  features: string[];
}> = [
  {
    key: "starter",
    tagline: "Para começar",
    description: "Profissional iniciante, consultório simples",
    features: [
      "1 profissional",
      "Até 100 pacientes",
      "200 agendamentos/mês",
      "Prontuário básico",
      "Financeiro básico",
      "Histórico de 6 meses",
      "Suporte por e-mail",
      "IA Essencial (triagem + CID + chat) — 10/dia",
    ],
  },
  {
    key: "solo",
    tagline: "Para profissionais autônomos",
    description: "Médico, dentista, psicólogo individual",
    features: [
      "1 profissional + 1 admin",
      "Até 500 pacientes",
      "500 agendamentos/mês",
      "Prontuário SOAP completo",
      "Odontograma básico",
      "Financeiro + receitas",
      "Portal do paciente",
      "Histórico de 12 meses",
      "Suporte por e-mail",
      "IA Clínica (+ resumo + sentimento) — 25/dia",
    ],
  },
  {
    key: "clinic",
    tagline: "Para clínicas em crescimento",
    description: "Clínicas médicas e odontológicas com equipe",
    recommended: true,
    features: [
      "Até 5 profissionais + admin",
      "Até 3.000 pacientes",
      "Agendamentos ilimitados",
      "Prontuário + 7 tipos evolução",
      "Odontograma + Periograma",
      "TISS médico + GTO odonto",
      "Financeiro avançado",
      "Comissões e metas",
      "Portal paciente + Teleconsulta",
      "RBAC (5 perfis)",
      "Suporte via chat (Seg–Sáb)",
      "IA Avançada (+ transcrição + agente) — 60/dia",
    ],
  },
  {
    key: "premium",
    tagline: "Para policlínicas e centros médicos",
    description: "Múltiplas especialidades, alta demanda",
    features: [
      "Profissionais ilimitados",
      "Pacientes ilimitados",
      "Prontuário + modelos custom",
      "Módulo odonto completo",
      "TISS + Recurso de glosas",
      "SNGPC para controlados",
      "RBAC (11 perfis) + Auditoria",
      "Assinatura Digital (A1/A3/Nuvem)",
      "IA Ilimitada (todos os módulos)",
      "API REST + Webhooks",
      "FHIR R4 + Relatórios custom",
      "Suporte prioritário WhatsApp",
    ],
  },
];

/** Converte chave de plano armazenada no banco para { tier, interval } */
function parseStoredPlan(plan: string | null): { tier: TierKey; interval: IntervalKey } | null {
  if (!plan) return null;
  const s = plan.trim();
  if (!s) return null;

  // Legado: "monthly" | "annual" sem tier → starter
  if (s === "monthly" || s === "annual") {
    return { tier: "starter", interval: s };
  }

  const [tierRaw, intervalRaw] = s.split("_");
  const interval = intervalRaw === "monthly" || intervalRaw === "annual" ? intervalRaw : null;
  if (!interval) return null;

  // Novos nomes
  if (tierRaw === "starter" || tierRaw === "solo" || tierRaw === "clinic" || tierRaw === "premium") {
    return { tier: tierRaw, interval };
  }

  // Legado: basic → starter, pro → clinic, clinica → clinic
  if (tierRaw === "basic") return { tier: "starter", interval };
  if (tierRaw === "pro" || tierRaw === "clinica") return { tier: "clinic", interval };

  return null;
}

export default function Assinatura() {
  const navigate = useNavigate();
  const { isAdmin } = useAuth();
  const {
    subscribed,
    trialing,
    trial_expired: _trial_expired,
    days_remaining,
    plan,
    subscription_end,
    isLoading,
    createCheckout,
    checkSubscription,
  } = useSubscription();

  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<Record<TierKey, IntervalKey>>({
    starter: "annual",
    solo:    "annual",
    clinic:  "annual",
    premium: "annual",
  });

  const handleSubscribe = async (tier: TierKey) => {
    try {
      const interval = selectedInterval[tier];
      const planKey = `${tier}_${interval}`;
      setLoadingPlan(planKey);
      await createCheckout({ tier, interval });
      toast.success("Redirecionando para o checkout...");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar checkout.";
      toast.error(msg);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    navigate("/assinatura/gerenciar");
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Assinatura" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem gerenciar a assinatura
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Assinatura"
      subtitle="Gerencie seu plano"
      actions={
        <Button variant="outline" size="sm" onClick={() => checkSubscription()} data-tour="subscription-refresh">
          <RefreshCw className="mr-2 h-4 w-4" />
          Atualizar Status
        </Button>
      }
    >
      {/* Current Plan Status */}
      <div className="mb-8">
        <Card className={`border-2 ${subscribed ? 'border-green-500/30 bg-green-500/5' : trialing ? 'border-amber-500/30 bg-amber-500/5' : 'border-red-500/30 bg-red-500/5'}`}>
          <CardContent className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-4">
              <div className={`flex h-12 w-12 items-center justify-center rounded-full ${subscribed ? 'bg-green-500/20 text-green-600' : trialing ? 'bg-amber-500/20 text-amber-600' : 'bg-red-500/20 text-red-600'}`}>
                {subscribed ? <Crown className="h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
              </div>
              <div>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                  </div>
                ) : subscribed ? (
                  <>
                    {(() => {
                      const parsed = parseStoredPlan(plan);
                      if (!parsed) {
                        return <p className="font-semibold">Plano {plan}</p>;
                      }
                      return (
                        <p className="font-semibold">
                          Plano {tierNames[parsed.tier]} ({intervalNames[parsed.interval]})
                        </p>
                      );
                    })()}
                    {subscription_end && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Renova em {formatInAppTz(subscription_end, "dd 'de' MMMM 'de' yyyy")}
                      </p>
                    )}
                  </>
                ) : trialing ? (
                  <>
                    <p className="font-semibold">Período de Teste</p>
                    <p className="text-sm text-muted-foreground">
                      {days_remaining} {days_remaining === 1 ? 'dia restante' : 'dias restantes'}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">Teste Expirado</p>
                    <p className="text-sm text-muted-foreground">
                      Escolha um plano para continuar
                    </p>
                  </>
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {subscribed ? (
                <>
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Ativo</Badge>
                  <Button variant="outline" size="sm" onClick={handleManageSubscription} data-tour="subscription-manage">
                    <Settings className="mr-2 h-4 w-4" />
                    Gerenciar
                  </Button>
                </>
              ) : trialing ? (
                <Badge className="bg-amber-500/20 text-amber-600 border-amber-500/30">Teste Ativo</Badge>
              ) : (
                <Badge className="bg-red-500/20 text-red-600 border-red-500/30">Expirado</Badge>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Plans */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {tiers.map((tier) => {
          const stored = parseStoredPlan(plan);
          const isCurrentPlan = subscribed && stored?.tier === tier.key;
          const interval = selectedInterval[tier.key];
          const currentPrice = PRICING[tier.key][interval];
          const loadingKey = `${tier.key}_${interval}`;
          const TierIcon = tierIcons[tier.key];

          return (
            <Card
              key={tier.key}
              className={`relative flex flex-col ${tier.recommended ? "border-2 border-teal-500 shadow-lg shadow-teal-500/20" : ""} ${isCurrentPlan ? "ring-2 ring-green-500" : ""}`}
            >
              {tier.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-teal-600 to-cyan-500 text-white border-0">
                    <Sparkles className="mr-1 h-3 w-3" />
                    Mais Popular
                  </Badge>
                </div>
              )}
              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <Badge className="bg-green-500 text-white border-0">
                    <Check className="mr-1 h-3 w-3" />
                    Seu Plano
                  </Badge>
                </div>
              )}
              <CardHeader className="pt-8">
                <div className="flex items-center gap-3 mb-2">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-50">
                    <TierIcon className="h-5 w-5 text-teal-600" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tierNames[tier.key]}</CardTitle>
                    <p className="text-xs text-muted-foreground">{tier.tagline}</p>
                  </div>
                </div>
                <CardDescription className="text-xs bg-teal-50 text-teal-700 px-2 py-1 rounded-md">
                  {tier.description}
                </CardDescription>

                <div className="pt-4">
                  <ToggleGroup
                    type="single"
                    value={interval}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v !== "monthly" && v !== "annual") return;
                      setSelectedInterval((prev) => ({ ...prev, [tier.key]: v }));
                    }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="monthly" data-tour={`subscription-interval-${tier.key}-monthly`}>Mensal</ToggleGroupItem>
                    <ToggleGroupItem value="annual" data-tour={`subscription-interval-${tier.key}-annual`}>Anual</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="pt-4">
                  <span className="text-3xl font-bold">{currentPrice.label}</span>
                  <span className="text-muted-foreground text-sm">
                    {interval === "monthly" ? "/mês" : "/ano"}
                  </span>
                  {currentPrice.perMonth && interval === "annual" && (
                    <p className="text-xs text-muted-foreground mt-1">
                      equivale a {currentPrice.perMonth}
                    </p>
                  )}
                </div>
                {currentPrice.savings && interval === "annual" && (
                  <Badge variant="secondary" className="mt-2 w-fit bg-green-100 text-green-700 text-xs">
                    <Check className="h-3 w-3 mr-1" />
                    {currentPrice.savings}
                  </Badge>
                )}
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <ul className="mb-6 space-y-2 flex-1">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2">
                      <div className="flex h-4 w-4 items-center justify-center rounded-full bg-teal-100 text-teal-600 mt-0.5 flex-shrink-0">
                        <Check className="h-2.5 w-2.5" />
                      </div>
                      <span className="text-xs leading-relaxed">{feature}</span>
                    </li>
                  ))}
                </ul>
                {isCurrentPlan ? (
                  <Button variant="outline" className="w-full" disabled>
                    Plano Atual
                  </Button>
                ) : (
                  <Button
                    className={
                      tier.recommended
                        ? "w-full bg-gradient-to-r from-teal-600 to-cyan-500 hover:opacity-90"
                        : "w-full"
                    }
                    variant={tier.recommended ? "default" : "outline"}
                    onClick={() => handleSubscribe(tier.key)}
                    disabled={loadingPlan !== null}
                    data-tour={`subscription-choose-${tier.key}`}
                  >
                    {loadingPlan === loadingKey ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processando...
                      </>
                    ) : subscribed ? (
                      "Trocar Plano"
                    ) : (
                      "Assinar Agora"
                    )}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <div className="mt-8 text-center space-y-2">
        <p className="text-sm text-muted-foreground">
          5 dias grátis · Sem cartão de crédito · Cancele a qualquer momento
        </p>
        <p className="text-xs text-muted-foreground">
          Precisa de um plano personalizado?{" "}
          <a href="mailto:contato@metaclass.com.br" className="text-teal-600 hover:underline">
            Fale com nossa equipe
          </a>
        </p>
      </div>
    </MainLayout>
  );
}
