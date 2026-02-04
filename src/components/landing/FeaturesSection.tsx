import {
  Calendar,
  Users,
  DollarSign,
  Scissors,
  Package,
  BarChart3,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const features = [
  {
    icon: Calendar,
    title: "Agenda Inteligente",
    description: "Gerencie todos os agendamentos em um calendário visual e intuitivo. Receba lembretes automáticos.",
    color: "violet"
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Histórico completo, preferências e dados de contato organizados para fidelizar seus clientes.",
    color: "blue"
  },
  {
    icon: DollarSign,
    title: "Controle Financeiro",
    description: "Acompanhe receitas, despesas e lucros em tempo real. Relatórios detalhados para tomar decisões.",
    color: "green"
  },
  {
    icon: Scissors,
    title: "Catálogo de Serviços",
    description: "Configure seus serviços com preços, duração e profissionais responsáveis.",
    color: "fuchsia"
  },
  {
    icon: Package,
    title: "Controle de Estoque",
    description: "Monitore produtos, receba alertas de reposição e evite perdas no seu estoque.",
    color: "orange"
  },
  {
    icon: BarChart3,
    title: "Relatórios Avançados",
    description: "Dashboards com métricas de performance, faturamento e produtividade da equipe.",
    color: "violet"
  }
];

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-32 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-100 border border-fuchsia-200 mb-6">
            <Sparkles className="h-4 w-4 text-fuchsia-600" aria-hidden="true" />
            <span className="text-sm font-medium text-fuchsia-600">Recursos Completos</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Tudo que você precisa para{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">crescer</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Uma plataforma completa que simplifica a gestão do seu salão e aumenta sua produtividade.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature) => {
            const Icon = feature.icon;
            const colorClasses: Record<string, { bg: string; text: string }> = {
              violet: { bg: "bg-violet-100", text: "text-violet-600" },
              blue: { bg: "bg-blue-100", text: "text-blue-600" },
              green: { bg: "bg-green-100", text: "text-green-600" },
              fuchsia: { bg: "bg-fuchsia-100", text: "text-fuchsia-600" },
              orange: { bg: "bg-orange-100", text: "text-orange-600" },
            };
            const colors = colorClasses[feature.color] || colorClasses.violet;
            
            return (
              <div
                key={feature.title}
                className="group relative p-6 sm:p-8 rounded-2xl border bg-card hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-violet-200 h-full flex flex-col"
              >
                {/* Animated Icon */}
                <div className="relative mb-6">
                  <div className={cn(
                    "inline-flex h-14 w-14 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110 flex-shrink-0 relative z-10",
                    colors.bg
                  )}>
                    <Icon className={cn("h-7 w-7", colors.text)} aria-hidden="true" />
                  </div>
                  {/* Glow effect on hover */}
                  <div className={cn(
                    "absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 blur-xl",
                    colors.bg
                  )} />
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="font-display text-xl font-semibold mb-3 group-hover:text-violet-600 transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground flex-1">
                    {feature.description}
                  </p>
                  {/* Decorative element */}
                  <div className="mt-4 pt-4 border-t border-border/50">
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1.5 w-1.5 rounded-full bg-violet-500 animate-pulse" />
                      <span>Incluído em todos os planos</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
