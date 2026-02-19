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
  HeartPulse,
  FileText,
  Stethoscope,
  Activity,
  CheckCircle,
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
        "absolute bg-white/95 backdrop-blur-xl rounded-2xl p-4 shadow-2xl border border-white/60",
        "animate-[float_6s_ease-in-out_infinite]",
        className
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

// Mock dashboard card on the right side
function DashboardMockup() {
  return (
    <div className="relative w-full max-w-lg mx-auto">
      {/* Main card */}
      <div className="relative bg-white/10 backdrop-blur-2xl rounded-3xl border border-white/20 p-6 shadow-2xl">
        {/* Header bar */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-white/60 text-xs font-medium uppercase tracking-wider">Painel da Clínica</p>
            <p className="text-white font-semibold">Hoje, {new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'short' })}</p>
          </div>
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-teal-400/20 border border-teal-400/30">
            <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
            <span className="text-teal-300 text-xs font-medium">Online</span>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: "Consultas hoje", value: "18", icon: Calendar, color: "teal" },
            { label: "Pacientes", value: "247", icon: Users, color: "cyan" },
            { label: "Prontuários", value: "1.2k", icon: FileText, color: "blue" },
          ].map((stat) => (
            <div key={stat.label} className="bg-white/10 rounded-2xl p-3 border border-white/10">
              <stat.icon className={cn(
                "h-4 w-4 mb-2",
                stat.color === "teal" ? "text-teal-300" :
                stat.color === "cyan" ? "text-cyan-300" : "text-blue-300"
              )} />
              <p className="text-white font-bold text-lg leading-none">{stat.value}</p>
              <p className="text-white/50 text-[10px] mt-1 leading-tight">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Appointment list */}
        <div className="space-y-2">
          <p className="text-white/60 text-xs font-medium uppercase tracking-wider mb-3">Próximas consultas</p>
          {[
            { time: "09:00", name: "Dr. Carlos Silva", type: "Cardiologia", status: "confirmed" },
            { time: "09:30", name: "Dra. Ana Martins", type: "Clínica Geral", status: "confirmed" },
            { time: "10:15", name: "Dr. Paulo Costa", type: "Ortopedia", status: "pending" },
          ].map((appt) => (
            <div key={appt.time} className="flex items-center gap-3 bg-white/5 rounded-xl p-3 border border-white/10">
              <div className="text-center min-w-[40px]">
                <p className="text-teal-300 font-semibold text-xs">{appt.time}</p>
              </div>
              <div className="h-7 w-7 rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                {appt.name.split(' ').map(n => n[0]).slice(0, 2).join('')}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-xs font-medium truncate">{appt.name}</p>
                <p className="text-white/50 text-[10px] truncate">{appt.type}</p>
              </div>
              <div className={cn(
                "h-2 w-2 rounded-full flex-shrink-0",
                appt.status === "confirmed" ? "bg-teal-400" : "bg-yellow-400"
              )} />
            </div>
          ))}
        </div>

        {/* Activity line */}
        <div className="mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-300" />
            <div className="flex-1 flex items-end gap-0.5 h-8">
              {[3,5,4,7,6,8,5,9,7,8,6,9].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-gradient-to-t from-teal-500/60 to-cyan-400/80"
                  style={{ height: `${(h / 9) * 100}%` }}
                />
              ))}
            </div>
          </div>
          <p className="text-white/40 text-[10px] mt-1">Consultas — últimas 12h</p>
        </div>
      </div>

      {/* Floating badge: faturamento */}
      <div className="absolute -bottom-4 -left-4 bg-white rounded-2xl p-3 shadow-xl border border-gray-100 min-w-[140px]">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-teal-100 flex items-center justify-center">
            <TrendingUp className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Receita do mês</p>
            <p className="font-bold text-gray-900 text-sm">+38%</p>
          </div>
        </div>
      </div>

      {/* Floating badge: prontuário */}
      <div className="absolute -top-4 -right-4 bg-white rounded-2xl p-3 shadow-xl border border-gray-100">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-blue-100 flex items-center justify-center">
            <CheckCircle className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-500">Prontuários</p>
            <p className="font-bold text-gray-900 text-sm">100% digital</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* ========== MEDICAL TEAL GRADIENT BACKGROUND ========== */}
      <div className="absolute inset-0">
        {/* Base gradient - deep teal to blue */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(135deg, #0f4c4c 0%, #0d6e6e 30%, #0e7490 60%, #0c4a6e 100%)"
          }}
        />

        {/* Overlay for depth */}
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(180deg, rgba(15, 76, 76, 0.85) 0%, rgba(14, 116, 144, 0.5) 60%, rgba(12, 74, 110, 0.7) 100%)"
          }}
        />

        {/* Animated blobs */}
        <div className="absolute top-0 left-0 w-[600px] h-[600px] bg-teal-500/30 rounded-full blur-[150px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-cyan-500/30 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-blue-400/20 rounded-full blur-[100px] animate-pulse" style={{ animationDelay: "2s" }} />

        {/* Grid overlay */}
        <div
          className="absolute inset-0 opacity-[0.06]"
          style={{
            backgroundImage: "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "50px 50px"
          }}
        />

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* Content */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20">
        <div className="grid lg:grid-cols-2 gap-16 items-center">

          {/* Left: Text + CTA */}
          <div className="flex flex-col items-start text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/15 backdrop-blur-md border border-white/25 mb-8 animate-fade-in">
              <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" aria-hidden="true" />
              <span className="text-sm font-medium text-white">
                Sistema #1 para Clínicas Médicas
              </span>
              <Stethoscope className="h-4 w-4 text-teal-300" aria-hidden="true" />
            </div>

            {/* Headline */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight mb-6 animate-slide-up text-white drop-shadow-lg">
              Gerencie sua clínica com{" "}
              <span className="bg-gradient-to-r from-teal-300 to-cyan-200 bg-clip-text text-transparent">
                inteligência e praticidade
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-lg sm:text-xl text-white/85 max-w-xl mb-10 animate-slide-up drop-shadow" style={{ animationDelay: "0.1s" }}>
              Prontuários digitais, agenda inteligente, financeiro e equipe.
              Tudo que sua clínica precisa em uma plataforma completa e segura.
            </p>

            {/* Feature highlights */}
            <div className="flex flex-col gap-2 mb-10 animate-slide-up" style={{ animationDelay: "0.15s" }}>
              {[
                "Prontuário eletrônico com histórico completo",
                "Agenda médica com lembretes automáticos",
                "Gestão de convênios e financeiro integrado",
              ].map((item) => (
                <div key={item} className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-teal-300 flex-shrink-0" />
                  <span className="text-white/80 text-sm">{item}</span>
                </div>
              ))}
            </div>

            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 animate-slide-up" style={{ animationDelay: "0.2s" }}>
              <Link to="/cadastro">
                <Button size="lg" className="bg-white text-teal-700 hover:bg-white/90 text-lg px-8 py-6 h-auto shadow-xl group font-semibold">
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
            <div className="flex flex-wrap items-center gap-3 mt-10 animate-fade-in" style={{ animationDelay: "0.3s" }}>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25">
                <Shield className="h-4 w-4 text-teal-300" aria-hidden="true" />
                <span className="text-xs font-medium text-white">100% Seguro & LGPD</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25">
                <Clock className="h-4 w-4 text-cyan-300" aria-hidden="true" />
                <span className="text-xs font-medium text-white">Setup em 5 min</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 backdrop-blur-sm border border-white/25">
                <HeartPulse className="h-4 w-4 text-teal-300" aria-hidden="true" />
                <span className="text-xs font-medium text-white">+500 clínicas</span>
              </div>
            </div>

            {/* Social proof */}
            <div className="flex items-center gap-3 mt-8 animate-fade-in" style={{ animationDelay: "0.4s" }}>
              <div className="flex -space-x-2">
                {["DR", "AM", "PC", "JS", "RL"].map((initials, i) => (
                  <div
                    key={i}
                    className="h-8 w-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 border-2 border-white/30 flex items-center justify-center text-white text-[10px] font-bold"
                    aria-hidden="true"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" aria-hidden="true" />
                  ))}
                  <span className="text-white font-semibold text-sm ml-1">4.9</span>
                </div>
                <p className="text-white/60 text-xs">+500 médicos e gestores</p>
              </div>
            </div>
          </div>

          {/* Right: Dashboard Mockup */}
          <div className="hidden lg:flex items-center justify-center animate-fade-in" style={{ animationDelay: "0.3s" }}>
            <DashboardMockup />
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
