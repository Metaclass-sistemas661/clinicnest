import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  DollarSign,
  Package,
  Scissors,
  BarChart3,
  Shield,
  Zap,
  Star,
  Check,
  ArrowRight,
  Sparkles,
  Clock,
  TrendingUp,
  Heart,
  MapPin,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  StatsSection,
  HowItWorksSection,
  BeforeAfterSection,
  FAQSection,
  GuaranteeSection,
  DevicesSection,
  UrgentCTASection,
} from "@/components/landing";
import { LandingLayout } from "@/components/landing/LandingLayout";

// Floating Card Component
function FloatingCard({ 
  children, 
  className, 
  delay = 0 
}: { 
  children: React.ReactNode; 
  className?: string; 
  delay?: number;
}) {
  return (
    <div 
      className={cn(
        "absolute bg-card/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-border",
        "animate-[float_6s_ease-in-out_infinite]",
        className
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* ========== PURPLE + PINK GRADIENT BACKGROUND ========== */}
      <div className="absolute inset-0">
        {/* Base gradient - purple to pink */}
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #667eea 0%, #764ba2 25%, #f093fb 50%, #f5576c 75%, #f093fb 100%)"
          }}
        />
        
        {/* Overlay for depth */}
        <div 
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(102, 126, 234, 0.8) 0%, rgba(118, 75, 162, 0.6) 50%, rgba(240, 147, 251, 0.4) 100%)"
          }}
        />
        
        {/* Animated blobs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-violet-500/50 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-fuchsia-500/50 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-pink-400/40 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />
        
        {/* Grid overlay */}
        <div 
          className="absolute inset-0 opacity-10"
          style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "50px 50px"
          }}
        />

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Floating Cards - Desktop only */}
      <div className="hidden lg:block">
        <FloatingCard className="top-32 left-[8%] rotate-[-8deg]" delay={0}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-violet-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Hoje</p>
              <p className="font-semibold text-gray-900">12 agendamentos</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="top-48 right-[6%] rotate-[6deg]" delay={1}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-green-100 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Faturamento</p>
              <p className="font-semibold text-green-600">+42% este mês</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="bottom-48 left-[10%] rotate-[5deg]" delay={2}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-blue-100 flex items-center justify-center">
              <Users className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Clientes</p>
              <p className="font-semibold text-gray-900">+28 novos</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="bottom-36 right-[12%] rotate-[-4deg]" delay={1.5}>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
              ))}
            </div>
            <span className="font-semibold text-gray-900">4.9/5</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">+500 avaliações</p>
        </FloatingCard>
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-md border border-white/30 mb-8 animate-fade-in">
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-sm font-medium text-white">
              Sistema #1 para Salões de Beleza
            </span>
            <Zap className="h-4 w-4 text-yellow-300" />
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up text-white drop-shadow-lg">
            Transforme seu salão com{" "}
            <span className="text-yellow-300">gestão inteligente</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-white/90 max-w-2xl mb-10 animate-slide-up drop-shadow" style={{ animationDelay: "0.1s" }}>
            Agende, gerencie clientes, controle finanças e aumente seu faturamento. 
            Tudo em uma plataforma simples e poderosa.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Link to="/cadastro">
              <Button size="lg" className="bg-white text-violet-700 hover:bg-white/90 text-lg px-8 py-6 h-auto shadow-xl group font-semibold">
                Começar Grátis por 5 dias
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto bg-white/10 border-white/40 text-white hover:bg-white/20 backdrop-blur-sm">
                Ver Recursos
              </Button>
            </a>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 mt-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <Shield className="h-5 w-5 text-green-300" />
              <span className="text-sm font-medium text-white">100% Seguro</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <Clock className="h-5 w-5 text-blue-300" />
              <span className="text-sm font-medium text-white">Setup em 5 min</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <Heart className="h-5 w-5 text-pink-300" />
              <span className="text-sm font-medium text-white">+500 salões</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full bg-white/20 border border-white/40 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}

// Features Section
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

function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-32 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-fuchsia-100 border border-fuchsia-200 mb-6">
            <Sparkles className="h-4 w-4 text-fuchsia-600" />
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
          {features.map((feature, index) => {
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
                <div className={cn(
                  "inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-6 transition-all duration-300 group-hover:scale-110 flex-shrink-0",
                  colors.bg
                )}>
                  <Icon className={cn("h-7 w-7", colors.text)} />
                </div>
                <div className="flex-1 flex flex-col">
                  <h3 className="font-display text-xl font-semibold mb-3">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground flex-1">
                    {feature.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Testimonials Section
const testimonials = [
  {
    name: "Carla Santos",
    role: "Proprietária do Studio Carla",
    location: "São Paulo, SP",
    content: "O VynloBella transformou a forma como gerencio meu salão. Reduzi 80% do tempo com agendamentos e meus clientes adoram a praticidade!",
    avatar: "CS"
  },
  {
    name: "Roberto Lima",
    role: "Barbearia Vintage",
    location: "Rio de Janeiro, RJ",
    content: "Antes eu perdia dinheiro sem saber onde. Agora tenho controle total das finanças e aumentei meu lucro em 40% em apenas 3 meses.",
    avatar: "RL"
  },
  {
    name: "Amanda Oliveira",
    role: "Espaço Beauty Amanda",
    location: "Belo Horizonte, MG",
    content: "A melhor decisão que tomei foi adotar o VynloBella. Minha equipe ficou mais organizada e meus clientes mais satisfeitos.",
    avatar: "AO"
  }
];

function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 sm:py-32 bg-gradient-to-b from-violet-50 to-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 mb-6">
            <Star className="h-4 w-4 text-violet-600" />
            <span className="text-sm font-medium text-violet-600">Depoimentos</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Quem usa,{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">recomenda</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Veja o que nossos clientes têm a dizer sobre a transformação dos seus negócios.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial) => (
            <div
              key={testimonial.name}
              className="relative p-6 sm:p-8 rounded-2xl bg-white border shadow-lg hover:shadow-xl transition-all duration-300 h-full flex flex-col"
            >
              {/* Quote */}
              <div className="absolute -top-4 -left-2 text-6xl text-violet-200 font-serif">
                "
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4 flex-shrink-0">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              <p className="text-foreground mb-6 relative z-10 flex-1">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-4 flex-shrink-0 mt-auto">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <div className="flex items-center gap-1 mt-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">{testimonial.location}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// Pricing Section
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

function PricingSection() {
  return (
    <section id="pricing" className="py-20 sm:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 border border-green-200 mb-6">
            <TrendingUp className="h-4 w-4 text-green-600" />
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
                    <div className="h-5 w-5 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-3 w-3 text-green-600" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA */}
              <Link to="/cadastro" className="mt-auto">
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
                  <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
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

// Main Landing Page - COMPLETE STRUCTURE
export default function LandingPage() {
  return (
    <LandingLayout>
      <HeroSection />
      <StatsSection />
      <HowItWorksSection />
      <FeaturesSection />
      <BeforeAfterSection />
      <TestimonialsSection />
      <FAQSection />
      <PricingSection />
      <GuaranteeSection />
      <DevicesSection />
      <UrgentCTASection />
    </LandingLayout>
  );
}
