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
  Menu,
  X
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

// Navbar Component
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 glass border-b border-white/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl sm:text-2xl font-bold text-gradient">
              ProBeleza
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors">
              Recursos
            </a>
            <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors">
              Depoimentos
            </a>
            <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors">
              Preços
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button className="gradient-primary shadow-glow">
                Começar Grátis
              </Button>
            </Link>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden p-2"
            onClick={() => setIsOpen(!isOpen)}
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {isOpen && (
          <div className="md:hidden py-4 border-t border-white/20">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Recursos
              </a>
              <a href="#testimonials" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Depoimentos
              </a>
              <a href="#pricing" className="text-muted-foreground hover:text-foreground transition-colors py-2">
                Preços
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-white/20">
                <Link to="/login">
                  <Button variant="ghost" className="w-full">Entrar</Button>
                </Link>
                <Link to="/cadastro">
                  <Button className="w-full gradient-primary">Começar Grátis</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

// Floating 3D Card Component
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
        "absolute glass rounded-2xl p-4 shadow-xl border border-white/30",
        "animate-[float_6s_ease-in-out_infinite]",
        className
      )}
      style={{ 
        animationDelay: `${delay}s`,
      }}
    >
      {children}
    </div>
  );
}

// Hero Section
function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden pt-20">
      {/* Vibrant Gradient Background */}
      <div className="absolute inset-0 -z-10">
        {/* Base gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-accent/20" />
        
        {/* Animated gradient orbs - more vibrant */}
        <div className="absolute top-0 left-0 w-full h-full overflow-hidden">
          <div className="absolute -top-1/4 -left-1/4 w-[700px] h-[700px] bg-primary/40 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute -bottom-1/4 -right-1/4 w-[600px] h-[600px] bg-accent/50 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "1s" }} />
          <div className="absolute top-1/3 right-1/4 w-[400px] h-[400px] bg-primary/30 rounded-full blur-[80px] animate-pulse" style={{ animationDelay: "2s" }} />
          <div className="absolute bottom-1/3 left-1/3 w-[300px] h-[300px] bg-accent/40 rounded-full blur-[60px] animate-pulse" style={{ animationDelay: "1.5s" }} />
        </div>

        {/* Gradient mesh overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-background/50" />
        
        {/* Grid pattern overlay */}
        <div 
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage: `linear-gradient(hsl(var(--primary)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--primary)) 1px, transparent 1px)`,
            backgroundSize: '50px 50px'
          }}
        />

        {/* Radial gradient spotlight */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[radial-gradient(ellipse_at_center,_hsl(var(--primary)/0.15)_0%,_transparent_70%)]" />
      </div>

      {/* Floating 3D Elements - Hidden on mobile */}
      <div className="hidden lg:block">
        {/* Calendar Card */}
        <FloatingCard className="top-32 left-[8%] rotate-[-8deg]" delay={0}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Hoje</p>
              <p className="font-semibold">12 agendamentos</p>
            </div>
          </div>
        </FloatingCard>

        {/* Revenue Card */}
        <FloatingCard className="top-48 right-[6%] rotate-[6deg]" delay={1}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-success/20 flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-success" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Faturamento</p>
              <p className="font-semibold text-success">+42% este mês</p>
            </div>
          </div>
        </FloatingCard>

        {/* Clients Card */}
        <FloatingCard className="bottom-48 left-[10%] rotate-[5deg]" delay={2}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-info/20 flex items-center justify-center">
              <Users className="h-6 w-6 text-info" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Clientes</p>
              <p className="font-semibold">+28 novos</p>
            </div>
          </div>
        </FloatingCard>

        {/* Rating Card */}
        <FloatingCard className="bottom-36 right-[12%] rotate-[-4deg]" delay={1.5}>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-warning text-warning" />
              ))}
            </div>
            <span className="font-semibold">4.9/5</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">+500 avaliações</p>
        </FloatingCard>

        {/* Services Card */}
        <FloatingCard className="top-[60%] left-[5%] rotate-[-3deg]" delay={2.5}>
          <div className="flex items-center gap-2">
            <Scissors className="h-5 w-5 text-accent" />
            <span className="text-sm font-medium">Corte finalizado</span>
            <Check className="h-4 w-4 text-success" />
          </div>
        </FloatingCard>

        {/* Money Card */}
        <FloatingCard className="top-[35%] right-[4%] rotate-[8deg]" delay={0.5}>
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-success" />
            <span className="text-sm font-medium">R$ 2.450</span>
            <span className="text-xs text-muted-foreground">hoje</span>
          </div>
        </FloatingCard>
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="flex flex-col items-center text-center max-w-5xl mx-auto">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-primary/30 mb-8 animate-fade-in shadow-lg">
            <div className="h-2 w-2 rounded-full bg-success animate-pulse" />
            <span className="text-sm font-medium">
              Sistema #1 para Salões de Beleza
            </span>
            <Zap className="h-4 w-4 text-primary" />
          </div>

          {/* Headline */}
          <h1 className="font-display text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 animate-slide-up">
            Transforme seu salão com{" "}
            <span className="relative">
              <span className="text-gradient">gestão inteligente</span>
              <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
                <path 
                  d="M2 10C50 4 100 2 150 6C200 10 250 8 298 4" 
                  stroke="url(#underline-gradient)" 
                  strokeWidth="4" 
                  strokeLinecap="round"
                  className="animate-[draw_1s_ease-out_forwards]"
                  style={{ strokeDasharray: 300, strokeDashoffset: 300 }}
                />
                <defs>
                  <linearGradient id="underline-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="hsl(262, 83%, 58%)" />
                    <stop offset="100%" stopColor="hsl(24, 95%, 53%)" />
                  </linearGradient>
                </defs>
              </svg>
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mb-10 animate-slide-up" style={{ animationDelay: "0.1s" }}>
            Agende, gerencie clientes, controle finanças e aumente seu faturamento. 
            Tudo em uma plataforma simples e poderosa.
          </p>

          {/* CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
            <Link to="/cadastro">
              <Button size="lg" className="gradient-primary shadow-glow text-lg px-8 py-6 h-auto group relative overflow-hidden">
                <span className="relative z-10 flex items-center">
                  Começar Grátis por 14 dias
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </span>
                <div className="absolute inset-0 bg-gradient-to-r from-accent to-primary opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </Button>
            </Link>
            <a href="#features">
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto glass border-white/30 hover:bg-white/20">
                Ver Recursos
              </Button>
            </a>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-8 mt-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/20">
              <Shield className="h-5 w-5 text-success" />
              <span className="text-sm font-medium">100% Seguro</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/20">
              <Clock className="h-5 w-5 text-info" />
              <span className="text-sm font-medium">Setup em 5 min</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/20">
              <Heart className="h-5 w-5 text-destructive" />
              <span className="text-sm font-medium">+500 salões</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
        <div className="w-6 h-10 rounded-full glass border border-white/30 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-primary rounded-full animate-pulse" />
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
    color: "primary"
  },
  {
    icon: Users,
    title: "Gestão de Clientes",
    description: "Histórico completo, preferências e dados de contato organizados para fidelizar seus clientes.",
    color: "info"
  },
  {
    icon: DollarSign,
    title: "Controle Financeiro",
    description: "Acompanhe receitas, despesas e lucros em tempo real. Relatórios detalhados para tomar decisões.",
    color: "success"
  },
  {
    icon: Scissors,
    title: "Catálogo de Serviços",
    description: "Configure seus serviços com preços, duração e profissionais responsáveis.",
    color: "accent"
  },
  {
    icon: Package,
    title: "Controle de Estoque",
    description: "Monitore produtos, receba alertas de reposição e evite perdas no seu estoque.",
    color: "warning"
  },
  {
    icon: BarChart3,
    title: "Relatórios Avançados",
    description: "Dashboards com métricas de performance, faturamento e produtividade da equipe.",
    color: "primary"
  }
];

function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-32 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm font-medium text-accent">Recursos Completos</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Tudo que você precisa para{" "}
            <span className="text-gradient">crescer</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Uma plataforma completa que simplifica a gestão do seu salão e aumenta sua produtividade.
          </p>
        </div>

        {/* Features Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
          {features.map((feature, index) => {
            const Icon = feature.icon;
            return (
              <div
                key={feature.title}
                className={cn(
                  "group relative p-6 sm:p-8 rounded-2xl border bg-card/50 backdrop-blur-sm",
                  "hover:shadow-xl hover:-translate-y-2 transition-all duration-300",
                  "hover:border-primary/30"
                )}
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className={cn(
                  "inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-6",
                  "transition-all duration-300 group-hover:scale-110",
                  feature.color === "primary" && "bg-primary/10 text-primary",
                  feature.color === "accent" && "bg-accent/10 text-accent",
                  feature.color === "success" && "bg-success/10 text-success",
                  feature.color === "info" && "bg-info/10 text-info",
                  feature.color === "warning" && "bg-warning/10 text-warning",
                )}>
                  <Icon className="h-7 w-7" />
                </div>
                <h3 className="font-display text-xl font-semibold mb-3">
                  {feature.title}
                </h3>
                <p className="text-muted-foreground">
                  {feature.description}
                </p>
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
    content: "O ProBeleza transformou a forma como gerencio meu salão. Reduzi 80% do tempo com agendamentos e meus clientes adoram a praticidade!",
    avatar: "CS"
  },
  {
    name: "Roberto Lima",
    role: "Barbearia Vintage",
    content: "Antes eu perdia dinheiro sem saber onde. Agora tenho controle total das finanças e aumentei meu lucro em 40% em apenas 3 meses.",
    avatar: "RL"
  },
  {
    name: "Amanda Oliveira",
    role: "Espaço Beauty Amanda",
    content: "A melhor decisão que tomei foi adotar o ProBeleza. Minha equipe ficou mais organizada e meus clientes mais satisfeitos.",
    avatar: "AO"
  }
];

function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 sm:py-32 bg-muted/30 relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <Star className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium text-primary">Depoimentos</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Quem usa,{" "}
            <span className="text-gradient">recomenda</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Veja o que nossos clientes têm a dizer sobre a transformação dos seus negócios.
          </p>
        </div>

        {/* Testimonials Grid */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8">
          {testimonials.map((testimonial, index) => (
            <div
              key={testimonial.name}
              className="relative p-6 sm:p-8 rounded-2xl bg-card border hover:shadow-xl transition-all duration-300"
            >
              {/* Quote Icon */}
              <div className="absolute -top-4 -left-2 text-6xl text-primary/20 font-serif">
                "
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-warning text-warning" />
                ))}
              </div>

              <p className="text-foreground mb-6 relative z-10">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full gradient-primary flex items-center justify-center text-white font-semibold">
                  {testimonial.avatar}
                </div>
                <div>
                  <p className="font-semibold">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
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
function PricingSection() {
  return (
    <section id="pricing" className="py-20 sm:py-32 relative overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/10 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-success/10 border border-success/20 mb-6">
            <TrendingUp className="h-4 w-4 text-success" />
            <span className="text-sm font-medium text-success">Preço Único</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Um preço,{" "}
            <span className="text-gradient">recursos ilimitados</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Sem surpresas. Sem taxas escondidas. Tudo incluso em um plano simples.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto">
          <div className="relative p-8 sm:p-10 rounded-3xl bg-card border-2 border-primary/20 shadow-xl">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="px-6 py-2 rounded-full gradient-primary text-white text-sm font-medium shadow-glow">
                Mais Popular
              </div>
            </div>

            <div className="text-center mb-8 pt-4">
              <h3 className="font-display text-2xl font-semibold mb-4">
                Plano Profissional
              </h3>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl sm:text-6xl font-bold text-gradient">
                  R$97
                </span>
                <span className="text-muted-foreground">/mês</span>
              </div>
              <p className="text-sm text-muted-foreground mt-2">
                ou R$970/ano (2 meses grátis)
              </p>
            </div>

            {/* Features List */}
            <div className="space-y-4 mb-8">
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
                <div key={feature} className="flex items-center gap-3">
                  <div className="h-6 w-6 rounded-full bg-success/10 flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-success" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link to="/cadastro">
              <Button size="lg" className="w-full gradient-primary shadow-glow text-lg py-6 h-auto group">
                Começar Grátis por 14 dias
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>

            <p className="text-center text-sm text-muted-foreground mt-4">
              Sem cartão de crédito. Cancele quando quiser.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

// CTA Section
function CTASection() {
  return (
    <section className="py-20 sm:py-32 relative overflow-hidden">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="relative rounded-3xl overflow-hidden">
          {/* Background Gradient */}
          <div className="absolute inset-0 gradient-vibrant opacity-90" />
          
          {/* Pattern Overlay */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: `radial-gradient(circle at 2px 2px, white 1px, transparent 0)`,
              backgroundSize: '32px 32px'
            }} />
          </div>

          <div className="relative z-10 py-16 sm:py-24 px-6 sm:px-12 text-center">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6">
              Pronto para transformar seu salão?
            </h2>
            <p className="text-lg sm:text-xl text-white/80 max-w-2xl mx-auto mb-10">
              Junte-se a centenas de profissionais que já estão crescendo com o ProBeleza. 
              Comece seu teste gratuito hoje.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cadastro">
                <Button size="lg" className="bg-white text-primary hover:bg-white/90 text-lg px-8 py-6 h-auto group">
                  Começar Agora — É Grátis
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// Footer
function Footer() {
  return (
    <footer className="py-12 border-t bg-muted/30">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl gradient-primary">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl font-bold">ProBeleza</span>
          </div>

          <div className="flex flex-wrap justify-center gap-6 text-sm text-muted-foreground">
            <a href="#" className="hover:text-foreground transition-colors">Termos de Uso</a>
            <a href="#" className="hover:text-foreground transition-colors">Política de Privacidade</a>
            <a href="#" className="hover:text-foreground transition-colors">Contato</a>
          </div>

          <p className="text-sm text-muted-foreground">
            © 2025 ProBeleza. Todos os direitos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
}

// Main Landing Page Component
export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <HeroSection />
      <FeaturesSection />
      <TestimonialsSection />
      <PricingSection />
      <CTASection />
      <Footer />
    </div>
  );
}
