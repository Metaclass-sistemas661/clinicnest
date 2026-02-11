import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Check, Crown, Sparkles, Loader2, LogOut } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface TrialExpiredModalProps {
  open: boolean;
  isStaff?: boolean;
}

const plans = [
  {
    key: "monthly" as const,
    name: "Mensal",
    price: "79,90",
    period: "/mês",
    features: ["Agendamentos ilimitados", "Gestão de clientes", "Controle financeiro"],
  },
  {
    key: "quarterly" as const,
    name: "Trimestral",
    price: "69,90",
    period: "/mês",
    popular: true,
    savings: "Economize R$30",
    features: ["Tudo do mensal", "Relatórios avançados", "Suporte prioritário"],
  },
  {
    key: "annual" as const,
    name: "Anual",
    price: "49,90",
    period: "/mês",
    savings: "Economize R$360",
    features: ["Tudo do trimestral", "Treinamento exclusivo", "Consultoria mensal"],
  },
];

export function TrialExpiredModal({ open, isStaff = false }: TrialExpiredModalProps) {
  const { createCheckout } = useSubscription();
  const { signOut } = useAuth();
  const [loading, setLoading] = useState<string | null>(null);

  const handleSelectPlan = async (planKey: "monthly" | "quarterly" | "annual") => {
    try {
      setLoading(planKey);
      await createCheckout(planKey);
      toast.success("Redirecionando para o checkout...");
    } catch (error) {
      logger.error("Error creating checkout:", error);
      toast.error("Erro ao iniciar checkout. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  const handleSair = async () => {
    await signOut();
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className={isStaff ? "max-w-md" : "max-w-4xl max-h-[90vh] overflow-y-auto"}
        hideCloseButton={isStaff}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => isStaff && e.preventDefault()}
      >
        {isStaff ? (
          <>
            <DialogHeader className="text-center">
              <div className="flex justify-center mb-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/20 text-amber-600">
                  <Crown className="h-8 w-8" />
                </div>
              </div>
              <DialogTitle className="text-2xl font-bold">
                Seu período de teste expirou
              </DialogTitle>
              <DialogDescription className="text-base">
                Entre em contato com o administrador do salão para continuar usando o VynloBella.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-center mt-6">
              <Button onClick={handleSair} variant="outline" className="gap-2">
                <LogOut className="h-4 w-4" />
                Sair
              </Button>
            </div>
          </>
        ) : (
          <>
        <DialogHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-600 to-fuchsia-500 shadow-lg">
              <Crown className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold">
            Seu período de teste expirou
          </DialogTitle>
          <DialogDescription className="text-base">
            Para continuar usando o VynloBella, escolha um plano e desbloqueie todas as funcionalidades.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-3 gap-4 mt-6">
          {plans.map((plan) => (
            <Card
              key={plan.key}
              className={`relative p-5 flex flex-col ${
                plan.popular
                  ? "border-2 border-violet-500 shadow-lg shadow-violet-500/20"
                  : "border"
              }`}
            >
              {plan.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Mais Popular
                </Badge>
              )}

              <div className="text-center mb-4">
                <h3 className="font-semibold text-lg">{plan.name}</h3>
                <div className="mt-2">
                  <span className="text-3xl font-bold">R${plan.price}</span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                {plan.savings && (
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                    {plan.savings}
                  </Badge>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-4">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(plan.key)}
                disabled={loading !== null}
                className={
                  plan.popular
                    ? "w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90"
                    : "w-full"
                }
                variant={plan.popular ? "default" : "outline"}
              >
                {loading === plan.key ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Escolher Plano"
                )}
              </Button>
            </Card>
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Pagamento seguro via Stripe. Cancele quando quiser.
        </p>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
