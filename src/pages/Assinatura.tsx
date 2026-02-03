import { useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { useSubscription } from "@/hooks/useSubscription";
import { CreditCard, Check, Sparkles, Crown, Loader2, Calendar, RefreshCw, Settings } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const plans = [
  {
    key: "monthly" as const,
    name: "Mensal",
    price: "79,90",
    period: "/mês",
    description: "Flexibilidade total",
    features: [
      "Agendamentos ilimitados",
      "Gestão de clientes",
      "Controle financeiro",
      "Gestão de equipe",
      "Suporte por email",
    ],
  },
  {
    key: "quarterly" as const,
    name: "Trimestral",
    price: "69,90",
    period: "/mês",
    description: "Mais popular",
    savings: "Economize R$30",
    recommended: true,
    features: [
      "Tudo do mensal",
      "Relatórios avançados",
      "Suporte prioritário",
      "Backup diário",
    ],
  },
  {
    key: "annual" as const,
    name: "Anual",
    price: "49,90",
    period: "/mês",
    description: "Melhor valor",
    savings: "Economize R$360",
    features: [
      "Tudo do trimestral",
      "Treinamento exclusivo",
      "Consultoria mensal",
      "Acesso antecipado",
    ],
  },
];

const planNames: Record<string, string> = {
  monthly: "Mensal",
  quarterly: "Trimestral",
  annual: "Anual",
};

export default function Assinatura() {
  const { isAdmin } = useAuth();
  const { 
    subscribed, 
    trialing, 
    trial_expired,
    days_remaining, 
    plan, 
    subscription_end,
    isLoading,
    createCheckout,
    openCustomerPortal,
    checkSubscription,
  } = useSubscription();
  
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [loadingPortal, setLoadingPortal] = useState(false);

  const handleSubscribe = async (planKey: "monthly" | "quarterly" | "annual") => {
    try {
      setLoadingPlan(planKey);
      await createCheckout(planKey);
      toast.success("Redirecionando para o checkout...");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Erro ao iniciar checkout.";
      toast.error(msg);
    } finally {
      setLoadingPlan(null);
    }
  };

  const handleManageSubscription = async () => {
    try {
      setLoadingPortal(true);
      await openCustomerPortal();
      toast.success("Abrindo portal de gerenciamento...");
    } catch {
      toast.error("Erro ao abrir portal. Tente novamente.");
    } finally {
      setLoadingPortal(false);
    }
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
        <Button variant="outline" size="sm" onClick={() => checkSubscription()}>
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
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Carregando...</span>
                  </div>
                ) : subscribed ? (
                  <>
                    <p className="font-semibold">Plano {planNames[plan || ""] || plan}</p>
                    {subscription_end && (
                      <p className="text-sm text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        Renova em {format(new Date(subscription_end), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })}
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
            <div className="flex gap-2">
              {subscribed ? (
                <>
                  <Badge className="bg-green-500/20 text-green-600 border-green-500/30">Ativo</Badge>
                  <Button variant="outline" size="sm" onClick={handleManageSubscription} disabled={loadingPortal}>
                    {loadingPortal ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Settings className="mr-2 h-4 w-4" />}
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
        {plans.map((planItem) => {
          const isCurrentPlan = subscribed && plan === planItem.key;
          
          return (
            <Card
              key={planItem.key}
              className={`relative ${planItem.recommended ? "border-2 border-violet-500 shadow-lg shadow-violet-500/20" : ""} ${isCurrentPlan ? "ring-2 ring-green-500" : ""}`}
            >
              {planItem.recommended && (
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
                <CardTitle>{planItem.name}</CardTitle>
                <CardDescription>{planItem.description}</CardDescription>
                <div className="pt-4">
                  <span className="text-4xl font-bold">R${planItem.price}</span>
                  <span className="text-muted-foreground">{planItem.period}</span>
                </div>
                {planItem.savings && (
                  <Badge variant="secondary" className="mt-2 w-fit bg-green-100 text-green-700">
                    {planItem.savings}
                  </Badge>
                )}
              </CardHeader>
              <CardContent>
                <ul className="mb-6 space-y-3">
                  {planItem.features.map((feature) => (
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
                      planItem.recommended
                        ? "w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90"
                        : "w-full"
                    }
                    variant={planItem.recommended ? "default" : "outline"}
                    onClick={() => handleSubscribe(planItem.key)}
                    disabled={loadingPlan !== null}
                  >
                    {loadingPlan === planItem.key ? (
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
          Pagamentos processados com segurança via Stripe.
          <br />
          Cancele a qualquer momento sem multas.
        </p>
      </div>
    </MainLayout>
  );
}
