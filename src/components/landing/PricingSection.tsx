import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { TrendingUp, Check, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const pricingPlans = [
  {
    name: "Mensal",
    price: "79,90",
    period: "/mês",
    description: "Ideal para quem quer testar",
    popular: false,
    savings: null,
  },
  {
    name: "Trimestral",
    price: "69,90",
    period: "/mês",
    description: "Mais popular entre nossos clientes",
    popular: true,
    savings: "Economize R$30",
    totalPrice: "R$209,70 cobrados a cada 3 meses",
  },
  {
    name: "Anual",
    price: "49,90",
    period: "/mês",
    description: "Melhor custo-benefício",
    popular: false,
    savings: "Economize R$360",
    totalPrice: "R$598,80 cobrados anualmente",
  },
];

export function PricingSection() {
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
            Todos os planos incluem recursos ilimitados. Quanto maior o período, maior a economia!
          </p>
        </div>

        {/* Pricing Cards */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-5xl mx-auto">
          {pricingPlans.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative p-6 sm:p-8 rounded-3xl bg-white border-2 shadow-lg transition-all duration-300 hover:shadow-2xl hover:-translate-y-2 h-full flex flex-col",
                plan.popular 
                  ? "border-violet-400 scale-105 md:scale-110 z-10" 
                  : "border-gray-200"
              )}
            >
              {/* Popular Badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 flex items-center gap-2">
                  <div className="px-4 py-1.5 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-sm font-medium shadow-lg whitespace-nowrap">
                    🏆 Mais Popular
                  </div>
                  {plan.savings && (
                    <div className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-md whitespace-nowrap">
                      {plan.savings}
                    </div>
                  )}
                </div>
              )}

              {/* Savings Badge - Only for non-popular plans */}
              {plan.savings && !plan.popular && (
                <div className="absolute -top-3 -right-3">
                  <div className="px-3 py-1 rounded-full bg-green-500 text-white text-xs font-semibold shadow-md">
                    {plan.savings}
                  </div>
                </div>
              )}

              <div className={cn("text-center mb-6", plan.popular && "pt-2")}>
                <h3 className="font-display text-xl font-semibold mb-2">
                  Plano {plan.name}
                </h3>
                <p className="text-sm text-muted-foreground mb-4">
                  {plan.description}
                </p>
                <div className="flex items-baseline justify-center gap-1">
                  <span className="text-sm text-muted-foreground">R$</span>
                  <span className={cn(
                    "font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent",
                    plan.popular ? "text-5xl" : "text-4xl"
                  )}>
                    {plan.price}
                  </span>
                  <span className="text-muted-foreground">{plan.period}</span>
                </div>
                {plan.totalPrice && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {plan.totalPrice}
                  </p>
                )}
              </div>

              {/* Features List */}
              <div className="space-y-3 mb-6 flex-1">
                {[
                  "Agendamentos ilimitados",
                  "Clientes ilimitados",
                  "Gestão financeira completa",
                  "Controle de estoque",
                  "Relatórios avançados",
                  "Equipe ilimitada",
                  "Suporte prioritário",
                  "Atualizações gratuitas"
                ].map((feature) => (
                  <div key={feature} className="flex items-center gap-2">
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0" aria-hidden="true">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link to="/cadastro" aria-label={`Começar teste grátis com plano ${plan.name}`}>
                <Button 
                  size="lg" 
                  className={cn(
                    "w-full text-base py-5 h-auto group",
                    plan.popular 
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
          ))}
        </div>

        {/* Trust Note */}
        <p className="text-center text-sm text-muted-foreground mt-10">
          Todos os planos incluem 5 dias grátis. Cancele quando quiser, sem burocracia.
        </p>
      </div>
    </section>
  );
}
