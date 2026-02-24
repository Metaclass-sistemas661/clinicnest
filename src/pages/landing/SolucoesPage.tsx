import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/landing/LandingLayout";
import {
  Stethoscope,
  Smile,
  Brain,
  Activity,
  Heart,
  Sparkles,
  Users,
  Building2,
  CheckCircle2,
  ArrowRight,
  Zap,
  Shield,
  Clock,
  TrendingUp,
} from "lucide-react";

const specialties = [
  {
    id: "clinicas-medicas",
    icon: Stethoscope,
    title: "Clínicas Médicas",
    subtitle: "Consultórios e policlínicas",
    description: "Sistema completo para clínicas médicas de todas as especialidades. Prontuário eletrônico SOAP, prescrição digital, TISS integrado e muito mais.",
    color: "teal",
    features: [
      "Prontuário eletrônico com modelo SOAP",
      "Prescrição digital com Memed integrado",
      "Faturamento TISS automático",
      "Laudos e atestados digitais",
      "Teleconsulta integrada",
      "Agenda inteligente multi-profissional",
    ],
    benefits: [
      { icon: Clock, text: "Reduza 70% do tempo em documentação" },
      { icon: TrendingUp, text: "Aumente 40% a produtividade" },
      { icon: Shield, text: "100% compliance LGPD e CFM" },
    ],
    cta: "Ideal para: Clínicas gerais, cardiologia, dermatologia, ginecologia, pediatria e mais",
  },
  {
    id: "clinicas-odontologicas",
    icon: Smile,
    title: "Clínicas Odontológicas",
    subtitle: "Consultórios e redes de franquias",
    description: "Módulo odontológico completo com odontograma interativo, periograma, planos de tratamento e integração TISS Odonto.",
    color: "cyan",
    features: [
      "Odontograma digital interativo",
      "Periograma completo",
      "Planos de tratamento com orçamento",
      "TISS Odonto integrado",
      "Galeria de imagens por dente",
      "Controle de procedimentos por arcada",
    ],
    benefits: [
      { icon: Zap, text: "Odontograma em 2 cliques" },
      { icon: TrendingUp, text: "Aumente conversão de orçamentos" },
      { icon: Shield, text: "Documentação legal completa" },
    ],
    cta: "Ideal para: Dentistas, ortodontistas, implantodontistas, periodontistas e redes",
  },
  {
    id: "psicologia-psiquiatria",
    icon: Brain,
    title: "Psicologia e Psiquiatria",
    subtitle: "Consultórios e clínicas de saúde mental",
    description: "Prontuário adaptado para saúde mental com evolução por sessão, controle de medicamentos controlados e SNGPC integrado.",
    color: "purple",
    features: [
      "Prontuário adaptado para saúde mental",
      "Evolução por sessão",
      "Controle de medicamentos controlados",
      "Integração SNGPC automática",
      "Teleconsulta com sala de espera virtual",
      "Agendamento recorrente para terapias",
    ],
    benefits: [
      { icon: Shield, text: "Sigilo total dos prontuários" },
      { icon: Clock, text: "Lembretes automáticos de sessão" },
      { icon: Zap, text: "SNGPC sem complicação" },
    ],
    cta: "Ideal para: Psicólogos, psiquiatras, psicanalistas e clínicas de saúde mental",
  },
  {
    id: "fisioterapia",
    icon: Activity,
    title: "Fisioterapia e Reabilitação",
    subtitle: "Clínicas de fisioterapia e pilates",
    description: "Gestão de sessões, evolução funcional, controle de pacotes e integração com convênios para fisioterapia.",
    color: "orange",
    features: [
      "Controle de sessões e pacotes",
      "Evolução funcional por sessão",
      "Avaliação fisioterapêutica completa",
      "Gestão de salas e equipamentos",
      "Faturamento por sessão ou pacote",
      "Relatórios de evolução para convênios",
    ],
    benefits: [
      { icon: Clock, text: "Controle total de sessões" },
      { icon: TrendingUp, text: "Maximize ocupação das salas" },
      { icon: Zap, text: "Faturamento automático" },
    ],
    cta: "Ideal para: Fisioterapeutas, RPG, pilates, hidroterapia e reabilitação",
  },
  {
    id: "estetica",
    icon: Sparkles,
    title: "Estética e Bem-estar",
    subtitle: "Clínicas de estética e harmonização",
    description: "Gestão completa para clínicas de estética com controle de procedimentos, fotos antes/depois e gestão de insumos.",
    color: "pink",
    features: [
      "Galeria de fotos antes/depois",
      "Controle de procedimentos estéticos",
      "Gestão de insumos e produtos",
      "Termos de consentimento digitais",
      "Pacotes de tratamento",
      "Programa de fidelidade integrado",
    ],
    benefits: [
      { icon: TrendingUp, text: "Aumente ticket médio com pacotes" },
      { icon: Heart, text: "Fidelize com cashback" },
      { icon: Shield, text: "Termos assinados digitalmente" },
    ],
    cta: "Ideal para: Harmonização facial, laser, depilação, skincare e spa",
  },
  {
    id: "multiprofissional",
    icon: Users,
    title: "Clínicas Multiprofissionais",
    subtitle: "Centros médicos e policlínicas",
    description: "O único sistema híbrido do Brasil: médico + odontológico + multiprofissional em uma só plataforma.",
    color: "indigo",
    features: [
      "Múltiplas especialidades em um sistema",
      "Prontuário unificado por paciente",
      "Agenda compartilhada entre profissionais",
      "Faturamento centralizado",
      "Relatórios consolidados",
      "Gestão de múltiplas unidades",
    ],
    benefits: [
      { icon: Building2, text: "Uma plataforma para toda a clínica" },
      { icon: Zap, text: "Integração total entre áreas" },
      { icon: TrendingUp, text: "Visão 360° do negócio" },
    ],
    cta: "Ideal para: Centros médicos, policlínicas, clínicas integradas e franquias",
  },
];

const colorClasses: Record<string, { bg: string; border: string; text: string; badge: string; icon: string }> = {
  teal: {
    bg: "bg-teal-50",
    border: "border-teal-200",
    text: "text-teal-700",
    badge: "bg-teal-100 text-teal-700",
    icon: "text-teal-600",
  },
  cyan: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700",
    badge: "bg-cyan-100 text-cyan-700",
    icon: "text-cyan-600",
  },
  purple: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    badge: "bg-purple-100 text-purple-700",
    icon: "text-purple-600",
  },
  orange: {
    bg: "bg-orange-50",
    border: "border-orange-200",
    text: "text-orange-700",
    badge: "bg-orange-100 text-orange-700",
    icon: "text-orange-600",
  },
  pink: {
    bg: "bg-pink-50",
    border: "border-pink-200",
    text: "text-pink-700",
    badge: "bg-pink-100 text-pink-700",
    icon: "text-pink-600",
  },
  indigo: {
    bg: "bg-indigo-50",
    border: "border-indigo-200",
    text: "text-indigo-700",
    badge: "bg-indigo-100 text-indigo-700",
    icon: "text-indigo-600",
  },
};

export default function SolucoesPage() {
  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-400/30">
              Soluções por Especialidade
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Para cada especialidade,{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">
                uma solução sob medida
              </span>
            </h1>
            <p className="mt-6 text-lg text-white/70 sm:text-xl">
              O ClinicNest se adapta às necessidades específicas da sua área de atuação. 
              Descubra como podemos transformar a gestão da sua clínica.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cadastro">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-600 hover:to-cyan-500 text-white font-semibold shadow-lg shadow-teal-500/30">
                  Começar Grátis por 14 Dias
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Link to="/agendar-demonstracao">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10">
                  Agendar Demonstração
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Specialties Grid */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Escolha sua especialidade
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Cada área da saúde tem suas particularidades. Por isso, desenvolvemos módulos específicos para cada uma.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {specialties.map((specialty) => {
              const colors = colorClasses[specialty.color];
              const Icon = specialty.icon;

              return (
                <Card
                  key={specialty.id}
                  id={specialty.id}
                  className={`group relative overflow-hidden transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${colors.border}`}
                >
                  <CardHeader className={`${colors.bg} pb-4`}>
                    <div className="flex items-start justify-between">
                      <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${colors.bg} border ${colors.border}`}>
                        <Icon className={`h-6 w-6 ${colors.icon}`} />
                      </div>
                      <Badge variant="secondary" className={colors.badge}>
                        {specialty.subtitle}
                      </Badge>
                    </div>
                    <CardTitle className="mt-4 text-xl">{specialty.title}</CardTitle>
                    <CardDescription className="text-sm">
                      {specialty.description}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-6">
                    <div className="space-y-4">
                      <div>
                        <h4 className="text-sm font-semibold mb-3">Recursos principais:</h4>
                        <ul className="space-y-2">
                          {specialty.features.slice(0, 4).map((feature, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-sm text-muted-foreground">
                              <CheckCircle2 className={`h-4 w-4 mt-0.5 flex-shrink-0 ${colors.icon}`} />
                              {feature}
                            </li>
                          ))}
                        </ul>
                      </div>

                      <div className="pt-4 border-t">
                        <div className="space-y-2">
                          {specialty.benefits.map((benefit, idx) => {
                            const BenefitIcon = benefit.icon;
                            return (
                              <div key={idx} className="flex items-center gap-2 text-sm">
                                <BenefitIcon className={`h-4 w-4 ${colors.icon}`} />
                                <span className="font-medium">{benefit.text}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      <p className="text-xs text-muted-foreground italic pt-2">
                        {specialty.cta}
                      </p>

                      <Link to="/cadastro" className="block pt-2">
                        <Button className={`w-full group-hover:shadow-md transition-shadow`}>
                          Testar Grátis
                          <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                        </Button>
                      </Link>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Não encontrou sua especialidade?
            </h2>
            <p className="mt-4 text-lg text-white/70">
              O ClinicNest é flexível e pode ser adaptado para qualquer área da saúde. 
              Entre em contato e vamos entender suas necessidades.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/agendar-demonstracao">
                <Button size="lg" className="w-full sm:w-auto bg-white text-teal-900 hover:bg-white/90 font-semibold">
                  Falar com Especialista
                </Button>
              </Link>
              <Link to="/contato">
                <Button size="lg" variant="outline" className="w-full sm:w-auto border-white/20 text-white hover:bg-white/10">
                  Enviar Mensagem
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>
    </LandingLayout>
  );
}
