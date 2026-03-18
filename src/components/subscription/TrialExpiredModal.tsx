import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Check, Crown, Sparkles, Loader2, LogOut } from "lucide-react";
import { useSubscription } from "@/hooks/useSubscription";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface TrialExpiredModalProps {
  open: boolean;
  isStaff?: boolean;
}

type TierKey = "starter" | "solo" | "clinica" | "premium";
type IntervalKey = "monthly" | "annual";

const PRICING: Record<TierKey, Record<IntervalKey, { label: string; savings?: string }>> = {
  starter: {
    monthly: { label: "R$89,90" },
    annual: { label: "R$809,00", savings: "Economize ~25%" },
  },
  solo: {
    monthly: { label: "R$159,90" },
    annual: { label: "R$1.439,10", savings: "Economize ~25%" },
  },
  clinica: {
    monthly: { label: "R$289,90" },
    annual: { label: "R$2.609,10", savings: "Economize ~25%" },
  },
  premium: {
    monthly: { label: "R$399,90" },
    annual: { label: "R$3.599,00", savings: "Economize ~25%" },
  },
};

const tiers: Array<{ key: TierKey; name: string; description: string; popular?: boolean; features: string[] }> = [
  {
    key: "starter",
    name: "Starter",
    description: "Essencial para começar",
    features: ["1 profissional", "Até 100 pacientes", "Histórico: 6 meses"],
  },
  {
    key: "solo",
    name: "Solo",
    description: "Para profissionais autônomos",
    features: ["Até 2 profissionais", "Até 500 pacientes", "Histórico: 12 meses"],
  },
  {
    key: "clinica",
    name: "Clínica",
    description: "Para clínicas com equipe",
    popular: true,
    features: ["Até 6 profissionais", "Até 3.000 pacientes", "Histórico ilimitado"],
  },
  {
    key: "premium",
    name: "Premium",
    description: "Tudo ilimitado",
    features: ["Profissionais ilimitados", "Pacientes ilimitados", "Histórico ilimitado"],
  },
];

export function TrialExpiredModal({ open, isStaff = false }: TrialExpiredModalProps) {
  const { createCheckout } = useSubscription();
  const { signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState<string | null>(null);

  const [selectedInterval, setSelectedInterval] = useState<Record<TierKey, IntervalKey>>({
    starter: "monthly",
    solo: "annual",
    clinica: "annual",
    premium: "annual",
  });

  const handleSelectPlan = async (tier: TierKey) => {
    try {
      const interval = selectedInterval[tier];
      const loadingKey = `${tier}_${interval}`;
      setLoading(loadingKey);
      await createCheckout({ tier, interval });
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
    navigate("/", { replace: true });
  };

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        className={isStaff ? "max-w-md" : "max-w-5xl max-h-[90vh] overflow-y-auto"}
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
                Entre em contato com o administrador do clínica para continuar usando o ClinicNest.
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
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-600 to-cyan-500 shadow-lg">
              <Crown className="h-8 w-8 text-white" />
            </div>
          </div>
          <DialogTitle className="text-2xl font-bold">
            Seu período de teste expirou
          </DialogTitle>
          <DialogDescription className="text-base">
            Para continuar usando o ClinicNest, escolha um plano e desbloqueie todas as funcionalidades.
          </DialogDescription>
        </DialogHeader>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
          {tiers.map((tier) => {
            const interval = selectedInterval[tier.key];
            const price = PRICING[tier.key][interval];
            const loadingKey = `${tier.key}_${interval}`;

            return (
            <Card
              key={tier.key}
              className={`relative p-5 flex flex-col ${
                tier.popular
                  ? "border-2 border-violet-500 shadow-lg shadow-violet-500/20"
                  : "border"
              }`}
            >
              {tier.popular && (
                <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white">
                  <Sparkles className="h-3 w-3 mr-1" />
                  Mais Popular
                </Badge>
              )}

              <div className="text-center mb-4">
                <h3 className="font-semibold text-lg">{tier.name}</h3>
                <p className="text-xs text-muted-foreground mt-1">{tier.description}</p>

                <div className="mt-3 flex justify-center">
                  <ToggleGroup
                    type="single"
                    value={interval}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v !== "monthly" && v !== "annual") return;
                      setSelectedInterval((prev) => ({ ...prev, [tier.key]: v }));
                    }}
                  >
                    <ToggleGroupItem value="monthly">Mensal</ToggleGroupItem>
                    <ToggleGroupItem value="annual">Anual</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="mt-2">
                  <span className="text-3xl font-bold">{price.label}</span>
                  <span className="text-muted-foreground">
                    {interval === "monthly" ? "/mês" : "/ano"}
                  </span>
                </div>
                {price.savings && (
                  <Badge variant="secondary" className="mt-2 bg-green-100 text-green-700">
                    {price.savings}
                  </Badge>
                )}
              </div>

              <ul className="space-y-2 flex-1 mb-4">
                {tier.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <Button
                onClick={() => handleSelectPlan(tier.key)}
                disabled={loading !== null}
                className={
                  tier.popular
                    ? "w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:opacity-90"
                    : "w-full"
                }
                variant={tier.popular ? "default" : "outline"}
              >
                {loading === loadingKey ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processando...
                  </>
                ) : (
                  "Escolher Plano"
                )}
              </Button>
            </Card>
          );
          })}
        </div>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Pagamento seguro via Asaas. Cancele quando quiser.
        </p>
        </>
        )}
      </DialogContent>
    </Dialog>
  );
}
