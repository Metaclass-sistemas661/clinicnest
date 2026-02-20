import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Users,
  TrendingUp,
  Star,
  ArrowRight,
  Shield,
  Clock,
  HeartPulse,
  FileText,
  Stethoscope,
  CheckCircle,
  ChevronRight,
  Activity,
  Award,
  DollarSign,
  CreditCard,
  ClipboardList,
  BarChart3,
} from "lucide-react";
import { cn } from "@/lib/utils";

// ─── 3 Hero variants — each has unique content ───────────────────────────────
const VARIANTS = [
  {
    // Variant 1: Prontuário + Agenda — Deep Medical Teal
    bg: "linear-gradient(135deg, #0f4c4c 0%, #0d6e6e 40%, #0e7490 70%, #0c4a6e 100%)",
    badgeIcon: Stethoscope,
    badge: "Prontuário & Agenda Digital",
    headlinePlain: "Do prontuário à agenda,",
    headlineHighlight: "tudo integrado",
    headlineHighlightClass: "bg-gradient-to-r from-teal-300 via-cyan-200 to-white/90 bg-clip-text text-transparent",
    headlineSuffix: "na sua clínica",
    sub: "Registre consultas, anamneses e histórico clínico. Agende com lembretes automáticos e nunca perca um atendimento.",
    bullets: [
      "Prontuário eletrônico com histórico completo",
      "Agenda com confirmação automática via WhatsApp",
      "Receituários e laudos digitais integrados",
    ],
    trustChips: [
      { icon: Shield, label: "LGPD Compliant" },
      { icon: Clock, label: "Setup em 5 min" },
      { icon: HeartPulse, label: "+500 clínicas" },
      { icon: Stethoscope, label: "Prontuário digital" },
    ],
  },
  {
    // Variant 2: Convênios + Financeiro — Midnight Navy-Teal
    bg: "linear-gradient(135deg, #0c3558 0%, #0c5078 40%, #0e7490 68%, #0f5a8f 100%)",
    badgeIcon: DollarSign,
    badge: "Financeiro & Convênios",
    headlinePlain: "Convênios e financeiro",
    headlineHighlight: "sem complicação",
    headlineHighlightClass: "bg-gradient-to-r from-blue-300 via-cyan-200 to-teal-200 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "Gerencie planos de saúde, fature procedimentos e acompanhe a saúde financeira da sua clínica em tempo real.",
    bullets: [
      "Gestão completa de convênios e planos de saúde",
      "Fluxo de caixa e DRE automáticos",
      "Contas a pagar e receber integradas",
    ],
    trustChips: [
      { icon: Shield, label: "Dados seguros" },
      { icon: CreditCard, label: "Multi-convênio" },
      { icon: TrendingUp, label: "ROI comprovado" },
      { icon: BarChart3, label: "Relatórios avançados" },
    ],
  },
  {
    // Variant 3: Equipe + Multi-especialidade — Emerald Forest
    bg: "linear-gradient(135deg, #064e3b 0%, #047857 38%, #059669 62%, #0f766e 100%)",
    badgeIcon: Users,
    badge: "Equipe & Multi-especialidade",
    headlinePlain: "Sua equipe em sintonia,",
    headlineHighlight: "cada especialidade",
    headlineHighlightClass: "bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-200 bg-clip-text text-transparent",
    headlineSuffix: "sob controle",
    sub: "Gerencie médicos, enfermeiros e recepcionistas com permissões por função. Escale sem perder o controle.",
    bullets: [
      "Multi-especialidade e múltiplos usuários",
      "Permissões e funções por profissional",
      "Relatórios de desempenho por especialidade",
    ],
    trustChips: [
      { icon: Shield, label: "Acesso seguro" },
      { icon: Users, label: "Equipe ilimitada" },
      { icon: HeartPulse, label: "Multi-especialidade" },
      { icon: ClipboardList, label: "Escalonável" },
    ],
  },
];

// ─── Floating info card ──────────────────────────────────────────────────────
function FloatingCard({
  children,
  className,
  delay = 0,
}: {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <div
      className={cn(
        "absolute bg-white rounded-2xl shadow-2xl border border-gray-100/80 backdrop-blur-sm",
        "animate-[float_7s_ease-in-out_infinite]",
        className
      )}
      style={{ animationDelay: `${delay}s` }}
    >
      {children}
    </div>
  );
}

// ─── Doctor photo + floating cards ──────────────────────────────────────────
function DoctorVisual() {
  return (
    <div className="relative w-full max-w-[480px] mx-auto">
      {/* Photo */}
      <div className="relative h-[560px] w-full rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
        <img
          src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80&fit=crop&crop=top"
          alt="Médica utilizando o ClinicNest"
          className="w-full h-full object-cover object-top"
          loading="eager"
        />
        {/* Edge overlays for depth */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/10" />

        {/* Status strip */}
        <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-300" />
            <span className="text-white/90 text-xs font-medium">ClinicNest em uso</span>
            <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse ml-1" />
          </div>
        </div>
      </div>

      {/* ── Floating card: Consultas hoje ── */}
      <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
            <Calendar className="h-4 w-4 text-teal-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Consultas hoje</p>
            <p className="font-bold text-gray-900 text-base leading-none">18 agendadas</p>
          </div>
        </div>
      </FloatingCard>

      {/* ── Floating card: Prontuário digital ── */}
      <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
            <FileText className="h-4 w-4 text-blue-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Prontuários</p>
            <p className="font-bold text-gray-900 text-sm leading-none">100% digital</p>
          </div>
        </div>
      </FloatingCard>

      {/* ── Floating chip: LGPD — right middle ── */}
      <FloatingCard className="top-1/2 -right-10 -translate-y-1/2 px-3.5 py-2.5" delay={3.2}>
        <div className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-teal-600" />
          <span className="text-xs font-semibold text-gray-800">LGPD Seguro</span>
        </div>
      </FloatingCard>

      {/* ── Floating card: Receita ── */}
      <FloatingCard className="-bottom-5 -left-8 p-3.5 min-w-[160px]" delay={2.5}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Receita do mês</p>
            <p className="font-bold text-emerald-600 text-base leading-none">+38%</p>
          </div>
        </div>
      </FloatingCard>

      {/* ── Floating card: Rating ── */}
      <FloatingCard className="-bottom-5 -right-8 p-3.5" delay={4}>
        <div className="flex items-center gap-1.5 mb-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          ))}
          <span className="font-bold text-gray-900 text-sm ml-0.5">4.9</span>
        </div>
        <p className="text-[10px] text-gray-400">+500 clínicas ativas</p>
      </FloatingCard>

      {/* ── Floating chip: Convênios — left middle ── */}
      <FloatingCard className="top-2/5 -left-10 px-3.5 py-2.5" delay={1.2}>
        <div className="flex items-center gap-2">
          <Award className="h-4 w-4 text-cyan-600" />
          <span className="text-xs font-semibold text-gray-800">Convênios OK</span>
        </div>
      </FloatingCard>
    </div>
  );
}

// ─── Main Hero ───────────────────────────────────────────────────────────────
export function HeroSection() {
  const [activeVariant, setActiveVariant] = useState(0);
  const v = VARIANTS[activeVariant];
  const BadgeIcon = v.badgeIcon;

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVariant((prev) => (prev + 1) % VARIANTS.length);
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">

      {/* ── Animated background layers ── */}
      <div className="absolute inset-0">
        {VARIANTS.map((variant, i) => (
          <div
            key={i}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
            style={{
              background: variant.bg,
              opacity: activeVariant === i ? 1 : 0,
            }}
          />
        ))}

        {/* Ambient blobs */}
        <div className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] bg-white/[0.04] rounded-full blur-[160px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-white/[0.04] rounded-full blur-[140px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />

        {/* Subtle grid */}
        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />
      </div>

      {/* ── Content ── */}
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-14 xl:gap-24 items-center">

          {/* ──── LEFT: Text + CTA ──── */}
          <div className="flex flex-col items-start text-left">

            {/* Live badge — changes per variant */}
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/12 backdrop-blur-md border border-white/20 mb-7 transition-all duration-700">
              <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-sm font-medium text-white">{v.badge}</span>
              <BadgeIcon className="h-4 w-4 text-teal-300" />
            </div>

            {/* Headline — changes per variant */}
            <h1 className="font-display text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight leading-[1.08] mb-6 text-white drop-shadow-lg">
              {v.headlinePlain}{" "}
              <span className={v.headlineHighlightClass}>
                {v.headlineHighlight}
              </span>
              {v.headlineSuffix && (
                <>{" "}{v.headlineSuffix}</>
              )}
            </h1>

            {/* Subheadline — changes per variant */}
            <p className="text-lg sm:text-xl text-white/78 max-w-[520px] leading-relaxed mb-8 transition-all duration-700">
              {v.sub}
            </p>

            {/* Feature checkmarks — changes per variant */}
            <div className="flex flex-col gap-2.5 mb-10">
              {v.bullets.map((item) => (
                <div key={item} className="flex items-center gap-2.5">
                  <div className="h-5 w-5 rounded-full bg-teal-400/20 border border-teal-400/40 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="h-3 w-3 text-teal-300" />
                  </div>
                  <span className="text-white/82 text-sm">{item}</span>
                </div>
              ))}
            </div>

            {/* CTA */}
            <div className="flex flex-col sm:flex-row gap-4 mb-10">
              <Link to="/cadastro">
                <Button
                  size="lg"
                  className="bg-white text-teal-700 hover:bg-teal-50 text-base px-8 py-6 h-auto shadow-2xl shadow-black/30 font-bold group border-0"
                >
                  Começar 5 dias grátis
                  <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
              <a
                href="#features"
                onClick={(e) => {
                  e.preventDefault();
                  document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
                }}
              >
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 py-6 h-auto bg-white/10 border-white/30 text-white hover:bg-white/18 backdrop-blur-sm font-semibold"
                >
                  Ver recursos
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </a>
            </div>

            {/* Trust chips — changes per variant */}
            <div className="flex flex-wrap gap-2 mb-8">
              {v.trustChips.map(({ icon: Icon, label }) => (
                <div
                  key={label}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-sm"
                >
                  <Icon className="h-3.5 w-3.5 text-teal-300" />
                  <span className="text-xs font-medium text-white/90">{label}</span>
                </div>
              ))}
            </div>

            {/* Social proof avatars */}
            <div className="flex items-center gap-3">
              <div className="flex -space-x-2">
                {["DR", "AM", "PC", "JS", "RL"].map((initials, i) => (
                  <div
                    key={i}
                    className="h-9 w-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-400 border-2 border-white/40 flex items-center justify-center text-white text-[10px] font-bold"
                  >
                    {initials}
                  </div>
                ))}
              </div>
              <div>
                <div className="flex items-center gap-1">
                  {[...Array(5)].map((_, i) => (
                    <Star key={i} className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                  ))}
                  <span className="text-white font-semibold text-sm ml-1">4.9</span>
                </div>
                <p className="text-white/50 text-xs">+500 médicos e gestores ativos</p>
              </div>
            </div>
          </div>

          {/* ──── RIGHT: Doctor photo ──── */}
          <div
            className="hidden lg:flex items-center justify-center animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <DoctorVisual />
          </div>
        </div>
      </div>

      {/* ── Variant selector dots ── */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {VARIANTS.map((_, i) => (
          <button
            key={i}
            onClick={() => setActiveVariant(i)}
            aria-label={`Tema ${i + 1}`}
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              activeVariant === i
                ? "w-8 bg-white/90"
                : "w-2 bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </div>

      {/* ── Scroll indicator ── */}
      <div className="absolute bottom-8 right-8 hidden lg:flex items-center gap-2 text-white/40 text-xs">
        <span>Role para explorar</span>
        <div className="w-px h-8 bg-white/20 ml-2" />
      </div>
    </section>
  );
}
