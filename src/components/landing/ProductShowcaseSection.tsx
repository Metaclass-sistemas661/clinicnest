import { useState, useRef, useEffect } from "react";
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
    title: "Dashboard",
    description: "Visão completa do seu negócio",
    icon: BarChart3,
    color: "violet",
  },
  {
    id: "agenda",
    title: "Agenda",
    description: "Gerencie agendamentos",
    icon: Calendar,
    color: "blue",
  },
  {
    id: "clientes",
    title: "Clientes",
    description: "Histórico e fidelização",
    icon: Users,
    color: "fuchsia",
  },
  {
    id: "financeiro",
    title: "Financeiro",
    description: "Controle financeiro completo",
    icon: DollarSign,
    color: "green",
  },
  {
    id: "estoque",
    title: "Estoque",
    description: "Gestão de produtos",
    icon: Package,
    color: "orange",
  },
];

export function ProductShowcaseSection() {
  const [activeFeature, setActiveFeature] = useState("dashboard");
  const previewRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200" },
    blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200" },
    fuchsia: { bg: "bg-fuchsia-100", text: "text-fuchsia-600", border: "border-fuchsia-200" },
    green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-200" },
    orange: { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200" },
  };

  const activeFeatureData = features.find(f => f.id === activeFeature);

  // Mapeamento de IDs para URLs
  const getFeatureUrl = (featureId: string) => {
    const urlMap: Record<string, string> = {
      dashboard: "app.vynlobella.com/dashboard",
      agenda: "app.vynlobella.com/agenda",
      clientes: "app.vynlobella.com/clientes",
      financeiro: "app.vynlobella.com/financeiro",
      estoque: "app.vynlobella.com/estoque",
    };
    return urlMap[featureId] || "app.vynlobella.com";
  };

  // Função para detectar se está no mobile
  const isMobile = () => {
    return window.innerWidth < 768; // md breakpoint
  };

  // Handler para mudança de feature com scroll automático no mobile
  const handleFeatureChange = (featureId: string) => {
    setActiveFeature(featureId);
    
    // Scroll automático apenas no mobile
    if (isMobile() && previewRef.current) {
      setTimeout(() => {
        previewRef.current?.scrollIntoView({ 
          behavior: 'smooth', 
          block: 'start',
          inline: 'nearest'
        });
      }, 100);
    }
  };

  return (
    <section id="showcase" className="py-20 sm:py-32 bg-gradient-to-b from-background via-violet-50/30 to-background relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 mb-6">
            <BarChart3 className="h-4 w-4 text-violet-600" aria-hidden="true" />
            <span className="text-sm font-medium text-violet-600">Explore o Sistema</span>
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

        {/* Menu Fixo - Sticky no Mobile */}
        <div 
          ref={menuRef}
          className="mb-8 md:mb-8 sticky top-28 sm:top-32 z-30 bg-background/95 backdrop-blur-sm py-2 md:py-0 md:static md:bg-transparent md:backdrop-blur-none"
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide">
            {features.map((feature) => {
              const Icon = feature.icon;
              const colors = colorClasses[feature.color];
              const isActive = activeFeature === feature.id;

              return (
                <button
                  key={feature.id}
                  onClick={() => handleFeatureChange(feature.id)}
                  className={cn(
                    "flex items-center gap-2 sm:gap-3 px-3 sm:px-5 py-2 sm:py-3 rounded-xl border-2 transition-all duration-300 flex-shrink-0",
                    "hover:shadow-lg hover:-translate-y-1",
                    isActive
                      ? `${colors.border} bg-white shadow-lg`
                      : "border-border bg-card hover:border-violet-200"
                  )}
                >
                  <div
                    className={cn(
                      "h-8 w-8 sm:h-10 sm:w-10 rounded-lg flex items-center justify-center flex-shrink-0 transition-all",
                      isActive ? colors.bg : "bg-muted"
                    )}
                  >
                    <Icon
                      className={cn(
                        "h-4 w-4 sm:h-5 sm:w-5 transition-colors",
                        isActive ? colors.text : "text-muted-foreground"
                      )}
                    />
                  </div>
                  <div className="text-left">
                    <h3 className={cn(
                      "font-semibold text-xs sm:text-sm md:text-base",
                      isActive ? colors.text : "text-foreground"
                    )}>
                      {feature.title}
                    </h3>
                    <p className="text-xs text-muted-foreground hidden sm:block">{feature.description}</p>
                  </div>
                  {isActive && (
                    <Badge className={cn(colors.bg, colors.text, "text-xs hidden sm:inline-flex")}>Ativo</Badge>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Informações Encapsuladas - Lado a Lado */}
        {activeFeatureData && (
          <div className="grid sm:grid-cols-3 gap-4 mb-8">
            <Card className="border-2 border-violet-100 bg-violet-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colorClasses[activeFeatureData.color].bg)}>
                    <Check className={cn("h-5 w-5", colorClasses[activeFeatureData.color].text)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Interface Intuitiva</p>
                    <p className="text-xs text-muted-foreground">Design moderno e fácil</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-violet-100 bg-violet-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colorClasses[activeFeatureData.color].bg)}>
                    <Check className={cn("h-5 w-5", colorClasses[activeFeatureData.color].text)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Dados em Tempo Real</p>
                    <p className="text-xs text-muted-foreground">Atualização instantânea</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-2 border-violet-100 bg-violet-50/50">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={cn("h-10 w-10 rounded-lg flex items-center justify-center", colorClasses[activeFeatureData.color].bg)}>
                    <Check className={cn("h-5 w-5", colorClasses[activeFeatureData.color].text)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">Relatórios Detalhados</p>
                    <p className="text-xs text-muted-foreground">Análises completas</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Preview Area - Largura Total Abaixo */}
        <div ref={previewRef} className="relative max-w-6xl mx-auto scroll-mt-32 md:scroll-mt-0">
          <div className="relative">
            {/* Browser Frame */}
            <div className="rounded-t-lg bg-gray-800 p-2 flex items-center gap-2 border-b border-gray-700">
              <div className="flex gap-1.5">
                <div className="h-3 w-3 rounded-full bg-red-500" />
                <div className="h-3 w-3 rounded-full bg-yellow-500" />
                <div className="h-3 w-3 rounded-full bg-green-500" />
              </div>
              <div className="flex-1 bg-gray-700 rounded px-3 py-1 text-xs text-gray-300 text-center">
                {getFeatureUrl(activeFeature)}
              </div>
            </div>

            {/* Dynamic Preview - Largura Total */}
            <div className="border-x border-b border-gray-700 rounded-b-lg overflow-x-auto" style={{ backgroundColor: "hsl(250 25% 7%)", minHeight: "650px" }}>
              {activeFeature === "dashboard" && <DashboardPreview />}
              {activeFeature === "agenda" && <AgendaPreview />}
              {activeFeature === "clientes" && <ClientesPreview />}
              {activeFeature === "financeiro" && <FinanceiroPreview />}
              {activeFeature === "estoque" && <EstoquePreview />}
            </div>

            {/* Floating Badge */}
            <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-10">
              <span className="text-sm font-semibold">100% Funcional</span>
              <Check className="h-4 w-4" />
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
