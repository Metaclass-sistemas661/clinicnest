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
import { CreditCard, Check, Sparkles, Crown, Loader2, Calendar, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { formatInAppTz } from "@/lib/date";

type TierKey = "basic" | "pro" | "premium";
type IntervalKey = "monthly" | "quarterly" | "annual";

const intervalNames: Record<IntervalKey, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

const tierNames: Record<TierKey, string> = {
  basic: "Básico",
  pro: "Pro",
  premium: "Premium",
};

const PRICING: Record<TierKey, Record<IntervalKey, { label: string; amountCents: number; savings?: string }>> = {
  basic: {
    monthly: { label: "R$79,90", amountCents: 7990 },
    quarterly: { label: "R$219,90", amountCents: 21990, savings: "Economize ~8%" },
    annual: { label: "R$719,00", amountCents: 71900, savings: "Economize ~25%" },
  },
  pro: {
    monthly: { label: "R$119,90", amountCents: 11990 },
    quarterly: { label: "R$329,90", amountCents: 32990, savings: "Economize ~8%" },
    annual: { label: "R$1.079,00", amountCents: 107900, savings: "Economize ~25%" },
  },
  premium: {
    monthly: { label: "R$169,90", amountCents: 16990 },
    quarterly: { label: "R$469,90", amountCents: 46990, savings: "Economize ~8%" },
    annual: { label: "R$1.499,00", amountCents: 149900, savings: "Economize ~25%" },
  },
};

const tiers: Array<{
  key: TierKey;
  description: string;
  recommended?: boolean;
  features: string[];
}> = [
  {
    key: "basic",
    description: "Essencial para começar",
    features: [
      "Equipe: 2 usuários (inclui 1 admin)",
      "Clientes: até 300",
      "Histórico: 6 meses",
      "Controle financeiro",
      "Suporte por email",
    ],
  },
  {
    key: "pro",
    description: "Para crescer com controle",
    recommended: true,
    features: [
      "Equipe: 5 usuários (inclui 1 admin)",
      "Clientes: até 2.000",
      "Histórico: 24 meses",
      "Relatórios avançados",
      "Exportação",
      "Suporte prioritário",
    ],
  },
  {
    key: "premium",
    description: "Tudo liberado",
    features: [
      "Equipe ilimitada (inclui 1 admin)",
      "Clientes ilimitados",
      "Histórico ilimitado",
      "Relatórios e exportação completos",
      "PDFs e automações avançadas",
    ],
  },
];

function parseStoredPlan(plan: string | null): { tier: TierKey; interval: IntervalKey } | null {
  if (!plan) return null;
  const s = plan.trim();
  if (!s) return null;

  // Legacy format: "monthly" | "quarterly" | "annual"
  if (s === "monthly" || s === "quarterly" || s === "annual") {
    return { tier: "basic", interval: s };
  }

  const [tierRaw, intervalRaw] = s.split("_");
  if (
    (tierRaw === "basic" || tierRaw === "pro" || tierRaw === "premium") &&
    (intervalRaw === "monthly" || intervalRaw === "quarterly" || intervalRaw === "annual")
  ) {
    return { tier: tierRaw, interval: intervalRaw };
  }

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
    basic: "monthly",
    pro: "annual",
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
      <div className="grid gap-6 md:grid-cols-3">
        {tiers.map((tier) => {
          const stored = parseStoredPlan(plan);
          const isCurrentPlan = subscribed && stored?.tier === tier.key;
          const interval = selectedInterval[tier.key];
          const currentPrice = PRICING[tier.key][interval];
          const loadingKey = `${tier.key}_${interval}`;
          
          return (
            <Card
              key={tier.key}
              className={`relative ${tier.recommended ? "border-2 border-violet-500 shadow-lg shadow-violet-500/20" : ""} ${isCurrentPlan ? "ring-2 ring-green-500" : ""}`}
            >
              {tier.recommended && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white border-0">
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
                <CardTitle>{tierNames[tier.key]}</CardTitle>
                <CardDescription>{tier.description}</CardDescription>

                <div className="pt-4">
                  <ToggleGroup
                    type="single"
                    value={interval}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v !== "monthly" && v !== "quarterly" && v !== "annual") return;
                      setSelectedInterval((prev) => ({ ...prev, [tier.key]: v }));
                    }}
                    className="justify-start"
                  >
                    <ToggleGroupItem value="monthly" data-tour={`subscription-interval-${tier.key}-monthly`}>Mensal</ToggleGroupItem>
                    <ToggleGroupItem value="quarterly" data-tour={`subscription-interval-${tier.key}-quarterly`}>Trimestral</ToggleGroupItem>
                    <ToggleGroupItem value="annual" data-tour={`subscription-interval-${tier.key}-annual`}>Anual</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="pt-4">
                  <span className="text-4xl font-bold">{currentPrice.label}</span>
                  <span className="text-muted-foreground">
                    {interval === "monthly" ? "/mês" : interval === "quarterly" ? "/trimestre" : "/ano"}
                  </span>
                </div>
                {currentPrice.savings && (
                  <Badge variant="secondary" className="mt-2 w-fit bg-green-100 text-green-700">
                    {currentPrice.savings}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <ul className="mb-6 space-y-3">
                  {tier.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2">
                      <div className="flex h-5 w-5 items-center justify-center rounded-full bg-green-500/20 text-green-600">
                        <Check className="h-3 w-3" />
                      </div>
                      <span className="text-sm">{feature}</span>
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
                        ? "w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90"
                        : "w-full"
                    }
                    variant={tier.recommended ? "default" : "outline"}
                    onClick={() => handleSubscribe(tier.key)}
                    disabled={loadingPlan !== null}
                    data-tour={tier.key === "pro" ? "subscription-choose-pro" : tier.key === "premium" ? "subscription-choose-premium" : "subscription-choose-basic"}
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

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Cancele a qualquer momento sem multas.
        </p>
      </div>
    </MainLayout>
  );
}
