import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { NestAvatar } from "@/components/patient/NestAvatar";
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
  Smile,
  Video,
  Building2,
  Lock,
  Zap,
  Globe,
  Brain,
  Mic,
  MessageSquare,
  Bot,
} from "lucide-react";
import { cn } from "@/lib/utils";

const VARIANTS = [
  {
    id: "hybrid",
    bg: "linear-gradient(135deg, #0f4c4c 0%, #0d6e6e 40%, #0e7490 70%, #0c4a6e 100%)",
    badgeIcon: HeartPulse,
    badge: "Único Sistema Híbrido do Brasil",
    headlinePlain: "Médico + Odontológico",
    headlineHighlight: "em uma só plataforma",
    headlineHighlightClass: "bg-gradient-to-r from-teal-300 via-cyan-200 to-white/90 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "O único sistema do mercado que atende clínicas médicas, odontológicas e multiprofissionais com módulos completos para cada especialidade.",
    bullets: [
      "Prontuário SOAP + Odontograma + Periograma integrados",
      "Faturamento TISS médico e odontológico (GTO)",
      "11 perfis profissionais com permissões granulares",
    ],
    trustChips: [
      { icon: Shield, label: "LGPD Compliant" },
      { icon: Smile, label: "Módulo Odonto" },
      { icon: Stethoscope, label: "Módulo Médico" },
      { icon: Award, label: "Segurança Avançada" },
    ],
    image: "https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=800&q=80&fit=crop&crop=top",
    imageAlt: "Médica utilizando o ClinicNest",
  },
  {
    id: "tiss",
    bg: "linear-gradient(135deg, #0c3558 0%, #0c5078 40%, #0e7490 68%, #0f5a8f 100%)",
    badgeIcon: DollarSign,
    badge: "Faturamento TISS Completo",
    headlinePlain: "Convênios sem dor de cabeça,",
    headlineHighlight: "glosas sob controle",
    headlineHighlightClass: "bg-gradient-to-r from-blue-300 via-cyan-200 to-teal-200 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "Gere guias TISS (Consulta, SP/SADT, Honorários, GTO), processe retornos XML automaticamente e gerencie recursos de glosa com workflow completo.",
    bullets: [
      "4 tipos de guias TISS + lote automático",
      "Parser de retorno XML com identificação de glosas",
      "Dashboard de faturamento por convênio",
    ],
    trustChips: [
      { icon: Shield, label: "ANS 3.05" },
      { icon: FileText, label: "4 Tipos de Guia" },
      { icon: TrendingUp, label: "Reduz Glosas" },
      { icon: Building2, label: "Multi-convênio" },
    ],
    image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=800&q=80&fit=crop",
    imageAlt: "Profissional de saúde analisando dados financeiros",
  },
  {
    id: "portal",
    bg: "linear-gradient(135deg, #064e3b 0%, #047857 38%, #059669 62%, #0f766e 100%)",
    badgeIcon: Globe,
    badge: "Portal do Paciente Completo",
    headlinePlain: "Seus pacientes agendam sozinhos,",
    headlineHighlight: "24 horas por dia",
    headlineHighlightClass: "bg-gradient-to-r from-emerald-300 via-teal-200 to-cyan-200 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "Portal completo onde o paciente agenda consultas, visualiza documentos, acompanha financeiro e conversa com a clínica. Reduza ligações em até 70%.",
    bullets: [
      "Agendamento self-service com slots em tempo real",
      "Visualização de receitas, atestados e exames",
      "Chat integrado e acompanhamento financeiro",
    ],
    trustChips: [
      { icon: Calendar, label: "Agenda Online" },
      { icon: FileText, label: "Documentos" },
      { icon: DollarSign, label: "Financeiro" },
      { icon: Video, label: "Teleconsulta" },
    ],
    image: "https://images.unsplash.com/photo-1551076805-e1869033e561?w=800&q=80&fit=crop",
    imageAlt: "Paciente usando aplicativo de saúde no celular",
  },
  {
    id: "rbac",
    bg: "linear-gradient(135deg, #4c1d95 0%, #5b21b6 38%, #6d28d9 62%, #7c3aed 100%)",
    badgeIcon: Lock,
    badge: "RBAC Enterprise",
    headlinePlain: "11 perfis profissionais,",
    headlineHighlight: "cada um vê o que precisa",
    headlineHighlightClass: "bg-gradient-to-r from-violet-300 via-purple-200 to-pink-200 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "Médico, dentista, enfermeiro, secretária, faturista... cada profissional tem acesso apenas ao que precisa. Dashboards diferenciados e auditoria completa.",
    bullets: [
      "Permissões granulares por recurso e ação",
      "Dashboards específicos por tipo profissional",
      "Auditoria de acessos clínicos (LGPD)",
    ],
    trustChips: [
      { icon: Shield, label: "LGPD" },
      { icon: Users, label: "11 Perfis" },
      { icon: Lock, label: "RLS Banco" },
      { icon: Activity, label: "Auditoria" },
    ],
    image: "https://images.unsplash.com/photo-1582750433449-648ed127bb54?w=800&q=80&fit=crop",
    imageAlt: "Equipe médica multiprofissional em reunião",
  },
  {
    id: "ai",
    bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 38%, #0f3460 62%, #533483 100%)",
    badgeIcon: Brain,
    badge: "IA Clínica Integrada",
    headlinePlain: "Inteligência Artificial que",
    headlineHighlight: "entende medicina",
    headlineHighlightClass: "bg-gradient-to-r from-purple-300 via-pink-200 to-orange-200 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "Agente IA com 8 ferramentas clínicas, transcrição médica por voz, triagem inteligente, sugestão de CID, predição de faltas e análise de sentimento. Tudo nativo na plataforma.",
    bullets: [
      "Agente IA com acesso a prontuários, agenda e financeiro",
      "Transcrição médica por voz (Amazon Transcribe Medical)",
      "Triagem por chatbot, sugestão de CID e predição de no-show",
    ],
    trustChips: [
      { icon: Brain, label: "Claude AI" },
      { icon: Mic, label: "Transcrição" },
      { icon: MessageSquare, label: "Chat IA" },
      { icon: Bot, label: "8 Ferramentas" },
    ],
    image: "https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=800&q=80&fit=crop",
    imageAlt: "Inteligência artificial aplicada à saúde",
  },
  {
    id: "compliance",
    bg: "linear-gradient(135deg, #1e3a5f 0%, #1e4976 38%, #1d5a8a 62%, #1a6b9e 100%)",
    badgeIcon: Award,
    badge: "Compliance Total",
    headlinePlain: "Preparado para certificações,",
    headlineHighlight: "pronto para crescer",
    headlineHighlightClass: "bg-gradient-to-r from-sky-300 via-blue-200 to-indigo-200 bg-clip-text text-transparent",
    headlineSuffix: "",
    sub: "Assinatura digital com certificados A1, A3 e em Nuvem (BirdID), interoperabilidade HL7 FHIR, SNGPC, RNDS e retenção CFM 20 anos.",
    bullets: [
      "Assinatura digital A1, A3 e Nuvem (ICP-Brasil/BirdID)",
      "Interoperabilidade HL7 FHIR R4 + RNDS",
      "SNGPC para controlados, retenção CFM 20 anos",
    ],
    trustChips: [
      { icon: Shield, label: "A1/A3/Nuvem" },
      { icon: Zap, label: "FHIR R4" },
      { icon: Award, label: "RNDS" },
      { icon: FileText, label: "CFM 20 anos" },
    ],
    image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=800&q=80&fit=crop",
    imageAlt: "Médico assinando documento digital em tablet",
  },
];

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

function HeroVisual({ variant }: { variant: typeof VARIANTS[0] }) {
  return (
    <div className="relative w-full max-w-[480px] mx-auto">
      <div className="relative h-[520px] w-full rounded-3xl overflow-hidden shadow-[0_32px_80px_rgba(0,0,0,0.35)]">
        <img
          src={variant.image}
          alt={variant.imageAlt}
          className="w-full h-full object-cover object-top"
          loading="eager"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-black/10" />
        <div className="absolute inset-0 bg-gradient-to-r from-black/15 via-transparent to-black/10" />

        <div className="absolute bottom-0 left-0 right-0 px-5 py-4 bg-gradient-to-t from-black/60 to-transparent">
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-300" />
            <span className="text-white/90 text-xs font-medium">ClinicNest em uso</span>
            <div className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse ml-1" />
          </div>
        </div>
      </div>

      {variant.id === "hybrid" && (
        <>
          <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-teal-100 flex items-center justify-center flex-shrink-0">
                <Stethoscope className="h-4 w-4 text-teal-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Módulo Médico</p>
                <p className="font-bold text-gray-900 text-sm leading-none">100% Completo</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-pink-100 flex items-center justify-center flex-shrink-0">
                <Smile className="h-4 w-4 text-pink-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Módulo Odonto</p>
                <p className="font-bold text-gray-900 text-sm leading-none">100% Completo</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="top-1/2 -right-10 -translate-y-1/2 px-3.5 py-2.5" delay={3.2}>
            <div className="flex items-center gap-2">
              <Shield className="h-4 w-4 text-teal-600" />
              <span className="text-xs font-semibold text-gray-800">Único Híbrido</span>
            </div>
          </FloatingCard>
        </>
      )}

      {variant.id === "tiss" && (
        <>
          <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                <FileText className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Guias TISS</p>
                <p className="font-bold text-gray-900 text-sm leading-none">4 Tipos</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-green-100 flex items-center justify-center flex-shrink-0">
                <TrendingUp className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Redução Glosas</p>
                <p className="font-bold text-green-600 text-sm leading-none">-45%</p>
              </div>
            </div>
          </FloatingCard>
        </>
      )}

      {variant.id === "portal" && (
        <>
          <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                <Calendar className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Agendamentos Online</p>
                <p className="font-bold text-gray-900 text-sm leading-none">24/7</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-cyan-100 flex items-center justify-center flex-shrink-0">
                <Video className="h-4 w-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Teleconsulta</p>
                <p className="font-bold text-gray-900 text-sm leading-none">Integrada</p>
              </div>
            </div>
          </FloatingCard>
        </>
      )}

      {variant.id === "rbac" && (
        <>
          <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Perfis</p>
                <p className="font-bold text-gray-900 text-sm leading-none">11 Tipos</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Lock className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Segurança</p>
                <p className="font-bold text-gray-900 text-sm leading-none">RLS + RBAC</p>
              </div>
            </div>
          </FloatingCard>
        </>
      )}

      {variant.id === "ai" && (
        <>
          <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-purple-100 flex items-center justify-center flex-shrink-0">
                <Brain className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Agente IA</p>
                <p className="font-bold text-gray-900 text-sm leading-none">8 Ferramentas</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
                <Mic className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Transcrição</p>
                <p className="font-bold text-gray-900 text-sm leading-none">Voz → Texto</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="top-1/2 -right-10 -translate-y-1/2 px-3.5 py-2.5" delay={3.2}>
            <div className="flex items-center gap-2">
              <Bot className="h-4 w-4 text-purple-600" />
              <span className="text-xs font-semibold text-gray-800">Claude AI</span>
            </div>
          </FloatingCard>
        </>
      )}

      {variant.id === "compliance" && (
        <>
          <FloatingCard className="-top-5 -left-8 p-3.5 min-w-[168px]" delay={0}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-sky-100 flex items-center justify-center flex-shrink-0">
                <Shield className="h-4 w-4 text-sky-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Certificados</p>
                <p className="font-bold text-gray-900 text-sm leading-none">A1/A3/Nuvem</p>
              </div>
            </div>
          </FloatingCard>

          <FloatingCard className="-top-5 -right-8 p-3.5" delay={1.8}>
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                <Zap className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">FHIR</p>
                <p className="font-bold text-gray-900 text-sm leading-none">FHIR R4</p>
              </div>
            </div>
          </FloatingCard>
        </>
      )}

      <FloatingCard className="-bottom-5 -left-8 p-3.5 min-w-[160px]" delay={2.5}>
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <p className="text-[10px] text-gray-400 font-medium leading-none mb-0.5">Economia média</p>
            <p className="font-bold text-emerald-600 text-base leading-none">+40%</p>
          </div>
        </div>
      </FloatingCard>

      <FloatingCard className="-bottom-5 -right-8 p-3.5" delay={4}>
        <div className="flex items-center gap-1.5 mb-1">
          {[...Array(5)].map((_, i) => (
            <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
          ))}
          <span className="font-bold text-gray-900 text-sm ml-0.5">4.9</span>
        </div>
        <p className="text-[10px] text-gray-400">+500 clínicas ativas</p>
      </FloatingCard>
    </div>
  );
}

export function HeroSection() {
  const [activeVariant, setActiveVariant] = useState(0);
  const v = VARIANTS[activeVariant];
  const BadgeIcon = v.badgeIcon;

  useEffect(() => {
    const interval = setInterval(() => {
      setActiveVariant((prev) => (prev + 1) % VARIANTS.length);
    }, 8000);
    return () => clearInterval(interval);
  }, []);

  return (
    <section className="relative min-h-screen flex items-center overflow-hidden">
      <div className="absolute inset-0">
        {VARIANTS.map((variant, i) => (
          <div
            key={variant.id}
            className="absolute inset-0 transition-opacity duration-[1200ms] ease-in-out"
            style={{
              background: variant.bg,
              opacity: activeVariant === i ? 1 : 0,
            }}
          />
        ))}

        <div className="absolute top-[-10%] left-[-5%] w-[700px] h-[700px] bg-white/[0.04] rounded-full blur-[160px] animate-pulse" />
        <div
          className="absolute bottom-[-10%] right-[-5%] w-[600px] h-[600px] bg-white/[0.04] rounded-full blur-[140px] animate-pulse"
          style={{ animationDelay: "2s" }}
        />

        <div
          className="absolute inset-0 opacity-[0.035]"
          style={{
            backgroundImage:
              "linear-gradient(white 1px, transparent 1px), linear-gradient(90deg, white 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />

        <div className="absolute bottom-0 left-0 right-0 h-48 bg-gradient-to-t from-background to-transparent" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative z-10 py-20 lg:py-28">
        <div className="grid lg:grid-cols-2 gap-14 xl:gap-24 items-center">
          <div className="flex flex-col items-start text-left">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/12 backdrop-blur-md border border-white/20 mb-7 transition-all duration-700">
              <div className="h-2 w-2 rounded-full bg-teal-400 animate-pulse" />
              <span className="text-sm font-medium text-white">{v.badge}</span>
              <BadgeIcon className="h-4 w-4 text-teal-300" />
            </div>

            <h1 className="font-display text-4xl sm:text-5xl md:text-[3.5rem] font-bold tracking-tight leading-[1.08] mb-6 text-white drop-shadow-lg">
              {v.headlinePlain}{" "}
              <span className={v.headlineHighlightClass}>
                {v.headlineHighlight}
              </span>
              {v.headlineSuffix && (
                <>{" "}{v.headlineSuffix}</>
              )}
            </h1>

            <p className="text-lg sm:text-xl text-white/78 max-w-[520px] leading-relaxed mb-8 transition-all duration-700">
              {v.sub}
            </p>

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
              <Link to="/demonstracao">
                <Button
                  size="lg"
                  variant="outline"
                  className="text-base px-8 py-6 h-auto bg-white/10 border-white/30 text-white hover:bg-white/18 backdrop-blur-sm font-semibold"
                >
                  Agendar demonstração
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>

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

            {/* Nest AI Introduction */}
            <div className="flex items-center gap-3.5 rounded-2xl bg-white/10 border border-white/15 backdrop-blur-md px-4 py-3 mb-8 max-w-md transition-all hover:bg-white/15">
              <NestAvatar size={52} className="flex-shrink-0 drop-shadow-lg" />
              <div>
                <p className="text-sm font-semibold text-white leading-snug">
                  Oi, eu sou a <span className="text-teal-300">Nest</span>! 🤖
                </p>
                <p className="text-xs text-white/70 leading-relaxed mt-0.5">
                  A inteligência artificial do ClinicNest. Ajudo pacientes e profissionais com respostas rápidas e inteligentes.
                </p>
              </div>
            </div>

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
                <p className="text-white/50 text-xs">+500 clínicas confiam no ClinicNest</p>
              </div>
            </div>
          </div>

          <div
            className="hidden lg:flex items-center justify-center animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            <HeroVisual variant={v} />
          </div>
        </div>
      </div>

      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center gap-2 z-20">
        {VARIANTS.map((variant, i) => (
          <button
            key={variant.id}
            onClick={() => setActiveVariant(i)}
            aria-label={`Banner ${i + 1}: ${variant.badge}`}
            className={cn(
              "h-2 rounded-full transition-all duration-500",
              activeVariant === i
                ? "w-8 bg-white/90"
                : "w-2 bg-white/30 hover:bg-white/50"
            )}
          />
        ))}
      </div>

      <div className="absolute bottom-8 right-8 hidden lg:flex items-center gap-2 text-white/40 text-xs">
        <span>Role para explorar</span>
        <div className="w-px h-8 bg-white/20 ml-2" />
      </div>
    </section>
  );
}
