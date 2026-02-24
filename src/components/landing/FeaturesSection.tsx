import {
  Calendar,
  Users,
  DollarSign,
  FileText,
  Package,
  Stethoscope,
  Smile,
  Video,
  Shield,
  Activity,
  Building2,
  Zap,
  Globe,
  Lock,
  BarChart3,
  HeartPulse,
  Sparkles,
  ClipboardList,
  ArrowRightLeft,
  Bell,
} from "lucide-react";
import { cn } from "@/lib/utils";

const featureCategories = [
  {
    title: "Gestão Clínica",
    description: "Tudo para o dia a dia da sua clínica",
    color: "teal",
    features: [
      {
        icon: Calendar,
        title: "Agenda Inteligente",
        description: "Calendário visual com confirmação automática via WhatsApp, check-in de pacientes e painel de chamada para TV.",
      },
      {
        icon: Users,
        title: "Gestão de Pacientes",
        description: "Cadastro completo com histórico, alergias em destaque, timeline de atendimentos e ficha clínica consolidada.",
      },
      {
        icon: Activity,
        title: "Triagem com Prioridades",
        description: "Classificação de risco, sinais vitais, notificação em tempo real para médicos e fila de atendimento.",
      },
      {
        icon: ClipboardList,
        title: "Lista de Espera",
        description: "Gerencie pacientes aguardando vaga com notificação automática quando horário disponível.",
      },
    ],
  },
  {
    title: "Prontuário Eletrônico",
    description: "Documentação clínica completa e segura",
    color: "blue",
    features: [
      {
        icon: FileText,
        title: "Prontuário SOAP",
        description: "Registro estruturado com Subjetivo, Objetivo, Avaliação e Plano. Versionamento, bloqueio 24h e assinatura digital.",
      },
      {
        icon: Stethoscope,
        title: "Evoluções Clínicas",
        description: "7 tipos de evolução (médica, fisio, nutri, psico, fono, enfermagem) com templates pré-configurados.",
      },
      {
        icon: HeartPulse,
        title: "Evolução de Enfermagem",
        description: "NANDA-I, NIC e NOC integrados com 52 diagnósticos, 36 intervenções e 33 resultados esperados.",
      },
      {
        icon: ArrowRightLeft,
        title: "Documentos Integrados",
        description: "Receituários, atestados, laudos e encaminhamentos vinculados ao prontuário com geração de PDF.",
      },
    ],
  },
  {
    title: "Módulo Odontológico",
    description: "Sistema híbrido completo para dentistas",
    color: "pink",
    features: [
      {
        icon: Smile,
        title: "Odontograma Interativo",
        description: "Mapa visual de 32 dentes (FDI) com 10 condições, registro por face e histórico temporal.",
      },
      {
        icon: Activity,
        title: "Periograma Completo",
        description: "6 sítios por dente, profundidade de sondagem, sangramento, índices automáticos e comparativo entre exames.",
      },
      {
        icon: ClipboardList,
        title: "Planos de Tratamento",
        description: "Orçamento detalhado por dente/procedimento, aprovação digital pelo paciente e acompanhamento de execução.",
      },
      {
        icon: FileText,
        title: "TISS Odontológico (GTO)",
        description: "Guia de Tratamento Odontológico ANS 3.05 com campos específicos: dente, face e região.",
      },
    ],
  },
  {
    title: "Faturamento & Convênios",
    description: "TISS completo e gestão de glosas",
    color: "green",
    features: [
      {
        icon: DollarSign,
        title: "Faturamento TISS",
        description: "4 tipos de guia (Consulta, SP/SADT, Honorários, GTO), lote automático e hash MD5 conforme ANS.",
      },
      {
        icon: Building2,
        title: "Gestão de Convênios",
        description: "Cadastro de operadoras, tabelas de preços, regras de autorização e dashboard por convênio.",
      },
      {
        icon: BarChart3,
        title: "Recurso de Glosas",
        description: "Workflow completo: identificação automática via XML, justificativa, envio e acompanhamento de recursos.",
      },
      {
        icon: FileText,
        title: "Retorno XML",
        description: "Parser automático de retorno das operadoras com identificação de aceites, glosas parciais e totais.",
      },
    ],
  },
  {
    title: "Portal do Paciente",
    description: "Autonomia total para seus pacientes",
    color: "emerald",
    features: [
      {
        icon: Globe,
        title: "Agendamento Online",
        description: "Paciente agenda 24/7 com visualização de slots em tempo real, escolha de profissional e confirmação automática.",
      },
      {
        icon: Video,
        title: "Teleconsulta Integrada",
        description: "Videochamada nativa com sala de espera virtual, compartilhamento de tela e gravação opcional.",
      },
      {
        icon: FileText,
        title: "Documentos Digitais",
        description: "Acesso a receitas, atestados, laudos e exames com download em PDF e histórico completo.",
      },
      {
        icon: DollarSign,
        title: "Financeiro do Paciente",
        description: "Visualização de faturas, pagamento online integrado e histórico de pagamentos.",
      },
    ],
  },
  {
    title: "Segurança & Compliance",
    description: "Preparado para certificações",
    color: "violet",
    features: [
      {
        icon: Lock,
        title: "RBAC Enterprise",
        description: "11 perfis profissionais com permissões granulares por recurso e ação. Dashboards diferenciados.",
      },
      {
        icon: Shield,
        title: "Assinatura Digital",
        description: "Suporte a certificado digital A1/A3 para assinatura de prontuários e documentos.",
      },
      {
        icon: Zap,
        title: "Interoperabilidade FHIR",
        description: "Suporte a HL7 FHIR R4 para interoperabilidade. Export/import de Patient, Encounter, Observation.",
      },
      {
        icon: Bell,
        title: "Auditoria Completa",
        description: "Log de acessos clínicos, alertas de acesso incomum, retenção CFM 20 anos e RIPD para LGPD.",
      },
    ],
  },
];

const colorClasses: Record<string, { bg: string; text: string; border: string; gradient: string }> = {
  teal: { bg: "bg-teal-100", text: "text-teal-600", border: "border-teal-200", gradient: "from-teal-500 to-cyan-500" },
  blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-200", gradient: "from-blue-500 to-indigo-500" },
  pink: { bg: "bg-pink-100", text: "text-pink-600", border: "border-pink-200", gradient: "from-pink-500 to-rose-500" },
  green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-200", gradient: "from-green-500 to-emerald-500" },
  emerald: { bg: "bg-emerald-100", text: "text-emerald-600", border: "border-emerald-200", gradient: "from-emerald-500 to-teal-500" },
  violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-200", gradient: "from-violet-500 to-purple-500" },
};

export function FeaturesSection() {
  return (
    <section id="features" className="py-20 sm:py-32 bg-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
            <Sparkles className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <span className="text-sm font-medium text-teal-600">+60 Funcionalidades</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            O sistema mais{" "}
            <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">completo</span>{" "}
            do mercado
          </h2>
          <p className="text-lg text-muted-foreground">
            Único sistema híbrido do Brasil: médico + odontológico + multiprofissional em uma só plataforma.
          </p>
        </div>

        <div className="space-y-16">
          {featureCategories.map((category, categoryIndex) => {
            const colors = colorClasses[category.color];
            return (
              <div key={category.title}>
                <div className="flex items-center gap-4 mb-8">
                  <div className={cn("h-1 flex-1 rounded-full bg-gradient-to-r", colors.gradient, "opacity-20")} />
                  <div className="text-center">
                    <h3 className={cn("font-display text-2xl font-bold", colors.text)}>
                      {category.title}
                    </h3>
                    <p className="text-sm text-muted-foreground">{category.description}</p>
                  </div>
                  <div className={cn("h-1 flex-1 rounded-full bg-gradient-to-r", colors.gradient, "opacity-20")} />
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
                  {category.features.map((feature) => {
                    const Icon = feature.icon;
                    return (
                      <div
                        key={feature.title}
                        className="group relative p-6 rounded-2xl border bg-card hover:shadow-xl hover:-translate-y-2 transition-all duration-300 hover:border-teal-200 h-full flex flex-col"
                      >
                        <div className="relative mb-4">
                          <div className={cn(
                            "inline-flex h-12 w-12 items-center justify-center rounded-xl transition-all duration-300 group-hover:scale-110",
                            colors.bg
                          )}>
                            <Icon className={cn("h-6 w-6", colors.text)} aria-hidden="true" />
                          </div>
                        </div>
                        <h4 className="font-display text-lg font-semibold mb-2 group-hover:text-teal-600 transition-colors">
                          {feature.title}
                        </h4>
                        <p className="text-sm text-muted-foreground flex-1">
                          {feature.description}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-20 p-8 rounded-3xl bg-gradient-to-r from-teal-600 to-cyan-500 text-white text-center">
          <h3 className="font-display text-2xl sm:text-3xl font-bold mb-4">
            E muito mais...
          </h3>
          <p className="text-white/80 max-w-2xl mx-auto mb-6">
            Estoque e compras, comissões e salários, metas e gamificação, campanhas de marketing, 
            cupons e vouchers, fidelidade e cashback, API pública REST, integrações com ERPs e CRMs, 
            relatórios customizáveis, SNGPC para controlados...
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            {[
              "Estoque", "Comissões", "Metas", "Campanhas", "Cupons", "Fidelidade", 
              "API REST", "Webhooks", "SNGPC", "Relatórios", "Multi-sede"
            ].map((item) => (
              <span
                key={item}
                className="px-3 py-1.5 rounded-full bg-white/20 text-sm font-medium"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
