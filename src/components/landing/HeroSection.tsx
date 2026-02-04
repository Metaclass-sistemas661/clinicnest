import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  TrendingUp,
  Star,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  Heart,
} from "lucide-react";
import { cn } from "@/lib/utils";

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

export function HeroSection() {
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
      <div className="hidden lg:block" aria-hidden="true">
        <FloatingCard className="top-32 left-[8%] rotate-[-8deg]" delay={0}>
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-xl bg-violet-100 flex items-center justify-center">
              <Calendar className="h-6 w-6 text-violet-600" aria-hidden="true" />
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
              <TrendingUp className="h-6 w-6 text-green-600" aria-hidden="true" />
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
              <Users className="h-6 w-6 text-blue-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Clientes</p>
              <p className="font-semibold text-gray-900">+28 novos</p>
            </div>
          </div>
        </FloatingCard>

        <FloatingCard className="bottom-36 right-[12%] rotate-[-4deg]" delay={1.5}>
          <div className="flex items-center gap-3">
            <div className="flex gap-0.5" aria-label="5 estrelas">
              {[...Array(5)].map((_, i) => (
                <Star key={i} className="h-5 w-5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
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
            <div className="h-2 w-2 rounded-full bg-green-400 animate-pulse" aria-hidden="true" />
            <span className="text-sm font-medium text-white">
              Sistema #1 para Salões de Beleza
            </span>
            <Zap className="h-4 w-4 text-yellow-300" aria-hidden="true" />
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
                <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
              </Button>
            </Link>
            <a href="#features" aria-label="Ver recursos do sistema" onClick={(e) => {
              e.preventDefault();
              document.getElementById('features')?.scrollIntoView({ behavior: 'smooth' });
            }}>
              <Button size="lg" variant="outline" className="text-lg px-8 py-6 h-auto bg-white/10 border-white/40 text-white hover:bg-white/20 backdrop-blur-sm">
                Ver Recursos
              </Button>
            </a>
          </div>

          {/* Trust Badges */}
          <div className="flex flex-wrap justify-center items-center gap-4 sm:gap-6 mt-12 animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <Shield className="h-5 w-5 text-green-300" aria-hidden="true" />
              <span className="text-sm font-medium text-white">100% Seguro</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <Clock className="h-5 w-5 text-blue-300" aria-hidden="true" />
              <span className="text-sm font-medium text-white">Setup em 5 min</span>
            </div>
            <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/20 backdrop-blur-sm border border-white/30">
              <Heart className="h-5 w-5 text-pink-300" aria-hidden="true" />
              <span className="text-sm font-medium text-white">+500 salões</span>
            </div>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce" aria-hidden="true">
        <div className="w-6 h-10 rounded-full bg-white/20 border border-white/40 flex items-start justify-center p-2">
          <div className="w-1 h-2 bg-white rounded-full animate-pulse" />
        </div>
      </div>
    </section>
  );
}
