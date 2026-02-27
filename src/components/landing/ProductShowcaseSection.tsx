import { useState, useRef } from "react";
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
  UserCog,
  Target,
  Wallet,
  Bell,
  CreditCard,
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
    description: "Visão completa da clínica",
    icon: BarChart3,
    color: "teal",
  },
  {
    id: "agenda",
    title: "Agenda",
    description: "Gerencie consultas",
    icon: Calendar,
    color: "blue",
  },
  {
    id: "pacientes",
    title: "Pacientes",
    description: "Histórico e prontuários",
    icon: Users,
    color: "cyan",
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
    title: "Insumos",
    description: "Gestão de materiais médicos",
    icon: Package,
    color: "orange",
  },
];

const advancedModules = [
  {
    icon: UserCog,
    title: "Equipe e permissões",
    description: "Controle de papéis e acesso entre administrador e profissionais.",
  },
  {
    icon: Wallet,
    title: "Comissões e salários",
    description: "Gestão de remuneração com histórico por profissional.",
  },
  {
    icon: Target,
    title: "Metas e performance",
    description: "Acompanhamento de metas com progresso e indicadores.",
  },
  {
    icon: Bell,
    title: "Notificações internas",
    description: "Alertas em tempo real para rotina da clínica.",
  },
  {
    icon: CreditCard,
    title: "Assinatura e acesso",
    description: "Gerenciamento de plano com fluxo de trial e renovação.",
  },
];

export function ProductShowcaseSection() {
  const [activeFeature, setActiveFeature] = useState("dashboard");
  const previewRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    teal: { bg: "bg-teal-100", text: "text-teal-600", border: "border-teal-200" },
    blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200" },
    cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-200" },
    green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-200" },
    orange: { bg: "bg-orange-100", text: "text-orange-600", border: "border-orange-200" },
  };

  const activeFeatureData = features.find(f => f.id === activeFeature);

  // Mapeamento de IDs para URLs
  const getFeatureUrl = (featureId: string) => {
    const urlMap: Record<string, string> = {
      dashboard: "clinicnest.metaclass.com.br/dashboard",
      agenda: "clinicnest.metaclass.com.br/agenda",
      pacientes: "clinicnest.metaclass.com.br/pacientes",
      financeiro: "clinicnest.metaclass.com.br/financeiro",
      estoque: "clinicnest.metaclass.com.br/estoque",
    };
    return urlMap[featureId] || "clinicnest.metaclass.com.br";
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
    <section id="showcase" className="py-20 sm:py-32 bg-gradient-to-b from-background via-teal-50/30 to-background relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
            <BarChart3 className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <span className="text-sm font-medium text-teal-600">Explore o Sistema</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Conheça o{" "}
            <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
              ClinicNest
            </span>{" "}
            por dentro
          </h2>
          <p className="text-lg text-muted-foreground">
            Explore os principais módulos e veja como nosso sistema organiza a operação completa da clínica.
          </p>
        </div>

        {/* Menu Fixo - Sticky no Mobile */}
        <div
          ref={menuRef}
          className="mb-8 sticky top-28 sm:top-32 z-30 bg-background/95 backdrop-blur-sm py-2 md:static md:mb-8 md:bg-transparent md:backdrop-blur-none md:py-0"
        >
          <div className="flex flex-wrap justify-center gap-2 sm:gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 scrollbar-hide md:overflow-x-visible">
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
                    "md:hover:shadow-lg",
                    isActive
                      ? `${colors.border} bg-white shadow-lg`
                      : "border-border bg-card md:hover:border-teal-200"
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
            <Card className="border-2 border-teal-100 bg-teal-50/50">
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

            <Card className="border-2 border-teal-100 bg-teal-50/50">
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

            <Card className="border-2 border-teal-100 bg-teal-50/50">
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
            <div className="border-x border-b border-gray-700 rounded-b-lg overflow-x-auto" style={{ backgroundColor: "hsl(200 25% 7%)", minHeight: "650px" }}>
              {activeFeature === "dashboard" && <DashboardPreview />}
              {activeFeature === "agenda" && <AgendaPreview />}
              {activeFeature === "pacientes" && <ClientesPreview />}
              {activeFeature === "financeiro" && <FinanceiroPreview />}
              {activeFeature === "estoque" && <EstoquePreview />}
            </div>

            {/* Floating Badge */}
            <div className="absolute -bottom-4 -right-4 bg-gradient-to-r from-teal-600 to-cyan-500 text-white px-4 py-2 rounded-full shadow-lg flex items-center gap-2 z-10">
              <span className="text-sm font-semibold">100% Funcional</span>
              <Check className="h-4 w-4" />
            </div>
          </div>
        </div>

        <div className="mt-10 rounded-2xl border border-teal-100 bg-white/80 p-6 sm:p-8">
          <h3 className="font-display text-xl font-semibold mb-4">Módulos avançados inclusos</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            {advancedModules.map((module) => {
              const Icon = module.icon;
              return (
                <div key={module.title} className="rounded-xl border border-border bg-card p-4">
                  <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 mb-3">
                    <Icon className="h-5 w-5 text-teal-600" />
                  </div>
                  <p className="text-sm font-semibold mb-1">{module.title}</p>
                  <p className="text-xs text-muted-foreground">{module.description}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA */}
        <div className="text-center mt-16">
          <p className="text-muted-foreground mb-6">
            Pronto para ver tudo isso funcionando na sua clínica?
          </p>
          <a href="/cadastro">
            <Button size="lg" className="bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-lg px-8 py-6 h-auto">
              Começar Teste Grátis de 5 Dias
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
