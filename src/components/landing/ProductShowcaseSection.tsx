import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  DollarSign,
  Package,
  BarChart3,
  ArrowRight,
  Check,
} from "lucide-react";
import { DashboardPreview } from "./DashboardPreview";
import { AgendaPreview } from "./AgendaPreview";
import { ClientesPreview } from "./ClientesPreview";
import { FinanceiroPreview } from "./FinanceiroPreview";
import { EstoquePreview } from "./EstoquePreview";
import { cn } from "@/lib/utils";

const features = [
  {
    id: "dashboard",
    title: "Dashboard Inteligente",
    description: "Visão completa do seu negócio em tempo real",
    icon: BarChart3,
    color: "violet",
  },
  {
    id: "agenda",
    title: "Agenda Digital",
    description: "Gerencie todos os agendamentos em um só lugar",
    icon: Calendar,
    color: "blue",
  },
  {
    id: "clientes",
    title: "Gestão de Clientes",
    description: "Histórico completo e fidelização",
    icon: Users,
    color: "fuchsia",
  },
  {
    id: "financeiro",
    title: "Controle Financeiro",
    description: "Receitas, despesas e lucros em tempo real",
    icon: DollarSign,
    color: "green",
  },
  {
    id: "estoque",
    title: "Controle de Estoque",
    description: "Alertas automáticos e gestão completa",
    icon: Package,
    color: "orange",
  },
];

export function ProductShowcaseSection() {
  const [activeFeature, setActiveFeature] = useState("dashboard");

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200" },
    blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200" },
    fuchsia: { bg: "bg-fuchsia-100", text: "text-fuchsia-600", border: "border-fuchsia-200" },
    green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-200" },
    orange: { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200" },
  };

  return (
    <section id="showcase" className="py-20 sm:py-32 bg-gradient-to-b from-background via-violet-50/30 to-background relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 mb-6">
            <BarChart3 className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-medium text-violet-600">Veja Como Funciona</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Conheça o{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
              VynloBella
            </span>{" "}
            por dentro
          </h2>
          <p className="text-lg text-muted-foreground">
            Explore as funcionalidades e veja como nosso sistema pode transformar a gestão do seu salão.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">
          {/* Feature Selector */}
          <div className="space-y-4">
            {features.map((feature) => {
              const Icon = feature.icon;
              const colors = colorClasses[feature.color];
              const isActive = activeFeature === feature.id;

              return (
                <button
                  key={feature.id}
                  onClick={() => setActiveFeature(feature.id)}
                  className={cn(
                    "w-full text-left p-6 rounded-2xl border-2 transition-all duration-300",
                    "hover:shadow-lg hover:-translate-y-1",
                    isActive
                      ? `${colors.border} bg-white shadow-lg`
                      : "border-border bg-card hover:border-violet-200"
                  )}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={cn(
                        "h-12 w-12 rounded-xl flex items-center justify-center flex-shrink-0 transition-all",
                        isActive ? colors.bg : "bg-muted"
                      )}
                    >
                      <Icon
                        className={cn(
                          "h-6 w-6 transition-colors",
                          isActive ? colors.text : "text-muted-foreground"
                        )}
                      />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-semibold text-lg">{feature.title}</h3>
                        {isActive && (
                          <Badge className={colors.bg + " " + colors.text}>Ativo</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                      {isActive && (
                        <div className="mt-4 space-y-2">
                          {[
                            "Interface intuitiva e moderna",
                            "Dados em tempo real",
                            "Relatórios detalhados",
                          ].map((item, idx) => (
                            <div key={idx} className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-green-600" />
                              <span className="text-muted-foreground">{item}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Preview Area */}
          <div className="relative">
            <div className="sticky top-24">
              <div className="relative">
                {/* Browser Frame */}
                <div className="rounded-t-lg bg-gray-800 p-2 flex items-center gap-2 border-b border-gray-700">
                  <div className="flex gap-1.5">
                    <div className="h-3 w-3 rounded-full bg-red-500" />
                    <div className="h-3 w-3 rounded-full bg-yellow-500" />
                    <div className="h-3 w-3 rounded-full bg-green-500" />
                  </div>
                  <div className="flex-1 bg-gray-700 rounded px-3 py-1 text-xs text-gray-300 text-center">
                    app.vynlobella.com
                  </div>
                </div>

                {/* Dynamic Preview based on activeFeature */}
                <div className="border-x border-b border-gray-700 rounded-b-lg overflow-hidden min-h-[600px]" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
                  {activeFeature === "dashboard" && <DashboardPreview />}
                  {activeFeature === "agenda" && <AgendaPreview />}
                  {activeFeature === "clientes" && <ClientesPreview />}
                  {activeFeature === "financeiro" && <FinanceiroPreview />}
                  {activeFeature === "estoque" && <EstoquePreview />}
                </div>

                {/* Floating Badge */}
                <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2">
                  <span className="text-sm font-semibold">100% Funcional</span>
                  <Check className="h-4 w-4" />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-6">
            Pronto para ver tudo isso funcionando no seu salão?
          </p>
          <a href="/cadastro">
            <Button size="lg" className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 text-lg px-8 py-6 h-auto">
              Começar Teste Grátis de 5 Dias
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
