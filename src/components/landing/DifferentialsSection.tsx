import {
  HeartPulse,
  Smile,
  Users,
  Shield,
  Zap,
  Globe,
  CheckCircle,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const differentials = [
  {
    icon: HeartPulse,
    title: "Único Sistema Híbrido",
    subtitle: "Médico + Odontológico",
    description: "O único sistema do Brasil que atende clínicas médicas, odontológicas e multiprofissionais com módulos completos para cada especialidade. Sem gambiarras, sem integrações externas.",
    highlights: [
      "Prontuário SOAP + Odontograma + Periograma",
      "TISS médico e GTO odontológico",
      "Evoluções para 7 tipos de profissionais",
      "Planos de tratamento odontológico",
    ],
    color: "teal",
    badge: "Exclusivo",
  },
  {
    icon: Users,
    title: "11 Perfis Profissionais",
    subtitle: "RBAC Enterprise",
    description: "Cada profissional vê apenas o que precisa. Médico, dentista, enfermeiro, fisioterapeuta, nutricionista, psicólogo, fonoaudiólogo, secretária, faturista, gestor e admin.",
    highlights: [
      "Permissões granulares por recurso",
      "Dashboards diferenciados por perfil",
      "Auditoria de acessos clínicos",
      "RLS no banco de dados",
    ],
    color: "violet",
    badge: "Enterprise",
  },
  {
    icon: Shield,
    title: "Segurança e LGPD",
    subtitle: "Proteção de Dados",
    description: "Sistema desenvolvido com foco em segurança e conformidade com a LGPD. Seus dados e de seus pacientes protegidos com as melhores práticas do mercado.",
    highlights: [
      "Suporte a assinatura digital",
      "Retenção CFM 20 anos automática",
      "SNGPC para medicamentos controlados",
      "Gestão de consentimentos LGPD",
    ],
    color: "blue",
    badge: "Seguro",
  },
  {
    icon: Zap,
    title: "Integrações",
    subtitle: "API REST + FHIR",
    description: "Conecte-se com outros sistemas através de nossa API documentada. Suporte a padrões de interoperabilidade para troca de dados.",
    highlights: [
      "API REST documentada",
      "Export/Import FHIR R4",
      "Webhooks para eventos",
      "Exportação em múltiplos formatos",
    ],
    color: "cyan",
    badge: "Integrado",
  },
  {
    icon: Globe,
    title: "Portal do Paciente",
    subtitle: "Autonomia Total",
    description: "Seus pacientes agendam sozinhos, acessam documentos, pagam online e conversam com a clínica. Reduza ligações em até 70%.",
    highlights: [
      "Agendamento self-service 24/7",
      "Teleconsulta integrada",
      "Documentos e exames digitais",
      "Pagamento online",
    ],
    color: "emerald",
    badge: "Self-service",
  },
  {
    icon: Smile,
    title: "Módulo Odonto Completo",
    subtitle: "Não é um add-on",
    description: "Odontograma interativo, periograma com 6 sítios, planos de tratamento com orçamento, TISS GTO. Desenvolvido por dentistas, para dentistas.",
    highlights: [
      "Odontograma FDI com 10 condições",
      "Periograma com índices automáticos",
      "Orçamento por dente/procedimento",
      "Galeria de imagens por dente",
    ],
    color: "pink",
    badge: "Completo",
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string; badgeBg: string }> = {
  teal: { bg: "bg-teal-100", text: "text-teal-600", border: "border-teal-200", gradient: "from-teal-500 to-cyan-500", badgeBg: "bg-teal-500" },
  violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200", gradient: "from-violet-500 to-purple-500", badgeBg: "bg-violet-500" },
  blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200", gradient: "from-blue-500 to-indigo-500", badgeBg: "bg-blue-500" },
  cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-200", gradient: "from-cyan-500 to-teal-500", badgeBg: "bg-cyan-500" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-200", gradient: "from-emerald-500 to-green-500", badgeBg: "bg-emerald-500" },
  pink: { bg: "bg-pink-100", text: "text-pink-600", border: "border-pink-200", gradient: "from-pink-500 to-rose-500", badgeBg: "bg-pink-500" },
};

export function DifferentialsSection() {
  return (
    <section id="diferenciais" className="py-20 sm:py-32 bg-muted/30 relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />
      <div className="absolute bottom-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-teal-500/20 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-teal-100 to-cyan-100 border border-teal-200 mb-6">
            <HeartPulse className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <span className="text-sm font-medium text-teal-600">Por que escolher o ClinicNest?</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Diferenciais que{" "}
            <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
              ninguém mais oferece
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Não somos apenas mais um sistema de gestão. Somos a plataforma mais completa e inovadora do mercado brasileiro de saúde.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {differentials.map((diff, index) => {
            const Icon = diff.icon;
            const colors = colorClasses[diff.color];
            return (
              <div
                key={diff.title}
                className="group relative p-8 rounded-3xl border bg-card hover:shadow-2xl transition-all duration-500 hover:-translate-y-2 flex flex-col"
              >
                <div className={cn(
                  "absolute top-4 right-4 px-3 py-1 rounded-full text-xs font-bold text-white",
                  colors.badgeBg
                )}>
                  {diff.badge}
                </div>

                <div className="relative mb-6">
                  <div className={cn(
                    "inline-flex h-16 w-16 items-center justify-center rounded-2xl transition-all duration-300 group-hover:scale-110",
                    colors.bg
                  )}>
                    <Icon className={cn("h-8 w-8", colors.text)} aria-hidden="true" />
                  </div>
                </div>

                <div className="mb-4">
                  <h3 className="font-display text-xl font-bold mb-1 group-hover:text-teal-600 transition-colors">
                    {diff.title}
                  </h3>
                  <p className={cn("text-sm font-medium", colors.text)}>
                    {diff.subtitle}
                  </p>
                </div>

                <p className="text-muted-foreground mb-6 flex-1">
                  {diff.description}
                </p>

                <div className="space-y-2">
                  {diff.highlights.map((highlight) => (
                    <div key={highlight} className="flex items-start gap-2">
                      <CheckCircle className={cn("h-4 w-4 mt-0.5 flex-shrink-0", colors.text)} />
                      <span className="text-sm text-muted-foreground">{highlight}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-16 text-center">
          <Link to="/cadastro">
            <Button
              size="lg"
              className="bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white px-8 py-6 h-auto text-lg font-bold group"
            >
              Experimente 5 dias grátis
              <ArrowRight className="ml-2 h-5 w-5 group-hover:translate-x-1 transition-transform" />
            </Button>
          </Link>
          <p className="text-sm text-muted-foreground mt-4">
            Sem cartão de crédito. Sem compromisso. Cancele quando quiser.
          </p>
        </div>
      </div>
    </section>
  );
}
