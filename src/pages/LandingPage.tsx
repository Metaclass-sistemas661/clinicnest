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
    <nav className="fixed top-0 left-0 right-0 z-50 bg-white/80 backdrop-blur-xl border-b border-white/20">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex h-16 sm:h-20 items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <span className="font-display text-xl sm:text-2xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
              ProBeleza
            </span>
          </div>

          {/* Desktop Menu */}
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors">
              Recursos
            </a>
            <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors">
              Depoimentos
            </a>
            <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors">
              Preços
            </a>
          </div>

          <div className="hidden md:flex items-center gap-4">
            <Link to="/login">
              <Button variant="ghost">Entrar</Button>
            </Link>
            <Link to="/cadastro">
              <Button className="bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 shadow-lg shadow-violet-500/30">
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
          <div className="md:hidden py-4 border-t border-gray-200">
            <div className="flex flex-col gap-4">
              <a href="#features" className="text-gray-600 hover:text-gray-900 transition-colors py-2">
                Recursos
              </a>
              <a href="#testimonials" className="text-gray-600 hover:text-gray-900 transition-colors py-2">
                Depoimentos
              </a>
              <a href="#pricing" className="text-gray-600 hover:text-gray-900 transition-colors py-2">
                Preços
              </a>
              <div className="flex flex-col gap-2 pt-4 border-t border-gray-200">
                <Link to="/login">
                  <Button variant="ghost" className="w-full">Entrar</Button>
                </Link>
                <Link to="/cadastro">
                  <Button className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500">Começar Grátis</Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
}

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
        "absolute bg-white/90 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/50",
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
                Começar Grátis por 14 dias
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
                className="group relative p-6 sm:p-8 rounded-2xl border bg-card hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-violet-200"
              >
                <div className={cn(
                  "inline-flex h-14 w-14 items-center justify-center rounded-2xl mb-6 transition-all duration-300 group-hover:scale-110",
                  colors.bg
                )}>
                  <Icon className={cn("h-7 w-7", colors.text)} />
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
              className="relative p-6 sm:p-8 rounded-2xl bg-white border shadow-lg hover:shadow-xl transition-all duration-300"
            >
              {/* Quote */}
              <div className="absolute -top-4 -left-2 text-6xl text-violet-200 font-serif">
                "
              </div>

              {/* Stars */}
              <div className="flex gap-1 mb-4">
                {[...Array(5)].map((_, i) => (
                  <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                ))}
              </div>

              <p className="text-foreground mb-6 relative z-10">
                "{testimonial.content}"
              </p>

              <div className="flex items-center gap-4">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-600 to-fuchsia-500 flex items-center justify-center text-white font-semibold">
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
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 border border-green-200 mb-6">
            <TrendingUp className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Preço Único</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Um preço,{" "}
            <span className="bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">recursos ilimitados</span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Sem surpresas. Sem taxas escondidas. Tudo incluso em um plano simples.
          </p>
        </div>

        {/* Pricing Card */}
        <div className="max-w-lg mx-auto">
          <div className="relative p-8 sm:p-10 rounded-3xl bg-white border-2 border-violet-200 shadow-2xl">
            {/* Popular Badge */}
            <div className="absolute -top-4 left-1/2 -translate-x-1/2">
              <div className="px-6 py-2 rounded-full bg-gradient-to-r from-violet-600 to-fuchsia-500 text-white text-sm font-medium shadow-lg">
                Mais Popular
              </div>
            </div>

            <div className="text-center mb-8 pt-4">
              <h3 className="font-display text-2xl font-semibold mb-4">
                Plano Profissional
              </h3>
              <div className="flex items-baseline justify-center gap-2">
                <span className="text-5xl sm:text-6xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent">
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
                  <div className="h-6 w-6 rounded-full bg-green-100 flex items-center justify-center flex-shrink-0">
                    <Check className="h-4 w-4 text-green-600" />
                  </div>
                  <span>{feature}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <Link to="/cadastro">
              <Button size="lg" className="w-full bg-gradient-to-r from-violet-600 to-fuchsia-500 hover:from-violet-700 hover:to-fuchsia-600 text-lg py-6 h-auto shadow-lg group">
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
          {/* Background */}
          <div 
            className="absolute inset-0"
            style={{
              background: "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)"
            }}
          />
          
          {/* Pattern */}
          <div className="absolute inset-0 opacity-10">
            <div className="absolute inset-0" style={{
              backgroundImage: "radial-gradient(circle at 2px 2px, white 1px, transparent 0)",
              backgroundSize: "32px 32px"
            }} />
          </div>

          <div className="relative z-10 py-16 sm:py-24 px-6 sm:px-12 text-center">
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold text-white mb-6 drop-shadow-lg">
              Pronto para transformar seu salão?
            </h2>
            <p className="text-lg sm:text-xl text-white/90 max-w-2xl mx-auto mb-10">
              Junte-se a centenas de profissionais que já estão crescendo com o ProBeleza. 
              Comece seu teste gratuito hoje.
            </p>
            <Link to="/cadastro">
              <Button size="lg" className="bg-white text-violet-700 hover:bg-white/90 text-lg px-8 py-6 h-auto shadow-xl group font-semibold">
                Começar Agora — É Grátis
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
              </Button>
            </Link>
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
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-violet-600 to-fuchsia-500">
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

// Main Landing Page
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
