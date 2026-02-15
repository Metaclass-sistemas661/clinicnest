import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { TrendingUp, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type TierKey = "basic" | "pro" | "premium";
type IntervalKey = "monthly" | "quarterly" | "annual";

const PRICING: Record<TierKey, Record<IntervalKey, { label: string; savings?: string; total?: string }>> = {
  basic: {
    monthly: { label: "79,90" },
    quarterly: { label: "219,90", savings: "Economize ~8%", total: "R$219,90 cobrados a cada 3 meses" },
    annual: { label: "719,00", savings: "Economize ~25%", total: "R$719,00 cobrados anualmente" },
  },
  pro: {
    monthly: { label: "119,90" },
    quarterly: { label: "329,90", savings: "Economize ~8%", total: "R$329,90 cobrados a cada 3 meses" },
    annual: { label: "1.079,00", savings: "Economize ~25%", total: "R$1.079,00 cobrados anualmente" },
  },
  premium: {
    monthly: { label: "169,90" },
    quarterly: { label: "469,90", savings: "Economize ~8%", total: "R$469,90 cobrados a cada 3 meses" },
    annual: { label: "1.499,00", savings: "Economize ~25%", total: "R$1.499,00 cobrados anualmente" },
  },
};

const tiers: Array<{
  key: TierKey;
  name: string;
  description: string;
  popular?: boolean;
  features: string[];
}> = [
  {
    key: "basic",
    name: "Básico",
    description: "Essencial para começar",
    features: [
      "Equipe: 2 usuários (inclui 1 admin)",
      "Clientes: até 300",
      "Histórico: 6 meses",
      "Controle financeiro",
    ],
  },
  {
    key: "pro",
    name: "Pro",
    description: "Para crescer com controle",
    popular: true,
    features: [
      "Equipe: 5 usuários (inclui 1 admin)",
      "Clientes: até 2.000",
      "Histórico: 24 meses",
      "Relatórios avançados",
      "Exportação",
    ],
  },
  {
    key: "premium",
    name: "Premium",
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

export function PricingSection() {
  const [selectedInterval, setSelectedInterval] = useState<Record<TierKey, IntervalKey>>({
    basic: "monthly",
    pro: "annual",
    premium: "annual",
  });

  return (
    <section id="pricing" className="py-20 sm:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 border border-green-200 mb-6">
            <TrendingUp className="h-4 w-4 text-green-600" aria-hidden="true" />
            <span className="text-sm font-medium text-green-600">Planos Flexíveis</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Escolha o plano{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">ideal para você</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Escolha o plano ideal. Quanto maior o período, maior a economia!
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {tiers.map((tier) => {
            const interval = selectedInterval[tier.key];
            const price = PRICING[tier.key][interval];

            return (
            <div
              key={tier.key}
              className={cn(
                "relative p-6 sm:p-8 rounded-3xl bg-white border-2 shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full flex flex-col",
                tier.popular 
                  ? "border-violet-400 scale-105 md:scale-110 z-10" 
                  : "border-gray-200"
              )}
            >
              {/* Popular Badge */}
              {tier.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-sm font-medium shadow-lg whitespace-nowrap">
                    🏆 Mais Popular
                  </div>
                  {price.savings && (
                    <div className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-md whitespace-nowrap">
                      {price.savings}
                    </div>
                  )}
                </div>
              )}

              {/* Savings Badge - Only for non-popular plans */}
              {price.savings && !tier.popular && (
                <div className="absolute -top-3 -right-3">
                  <div className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-md">
                    {price.savings}
                  </div>
                </div>
              )}

              <div className={cn("text-center mb-6", tier.popular && "pt-2")}>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Plano {tier.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {tier.description}
                </p>

                <div className="flex justify-center mb-4">
                  <ToggleGroup
                    type="single"
                    value={interval}
                    onValueChange={(v) => {
                      if (!v) return;
                      if (v !== "monthly" && v !== "quarterly" && v !== "annual") return;
                      setSelectedInterval((prev) => ({ ...prev, [tier.key]: v }));
                    }}
                  >
                    <ToggleGroupItem value="monthly">Mensal</ToggleGroupItem>
                    <ToggleGroupItem value="quarterly">Trimestral</ToggleGroupItem>
                    <ToggleGroupItem value="annual">Anual</ToggleGroupItem>
                  </ToggleGroup>
                </div>

                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className={cn(
                    "font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent",
                    tier.popular ? "text-5xl" : "text-4xl"
                  )}>
                    {price.label}
                  </span>
                  <span className="text-muted-foreground">
                    {interval === "monthly" ? "/mês" : interval === "quarterly" ? "/trimestre" : "/ano"}
                  </span>
                </div>
                {price.total && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {price.total}
                  </p>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3 mb-6 flex-1">
                {tier.features.map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link to="/cadastro" aria-label={`Começar teste grátis com plano ${tier.name}`}>
                <Button 
                  size="lg" 
                  className={cn(
                    "w-full text-base py-5 h-auto group",
                    tier.popular 
                      ? "bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-lg" 
                      : "bg-gray-900 hover:bg-gray-800"
                  )}
                >
                  Começar Grátis
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
                </Button>
              </Link>

              <p className="text-center text-xs text-muted-foreground mt-3">
                5 dias grátis • Sem cartão
              </p>
            </div>
          );
          })}
        </div>

        {/* Trust Note */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          Todos os planos incluem 5 dias grátis. Cancele quando quiser, sem burocracia.
        </p>
      </div>
    </section>
  );
}
