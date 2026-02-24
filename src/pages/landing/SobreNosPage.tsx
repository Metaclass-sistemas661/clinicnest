import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LandingLayout } from "@/components/landing/LandingLayout";
import {
  Stethoscope,
  Target,
  Eye,
  Heart,
  Users,
  Award,
  Rocket,
  Shield,
  Zap,
  Globe,
  ArrowRight,
  CheckCircle2,
  Building2,
  Calendar,
  TrendingUp,
} from "lucide-react";

const stats = [
  { value: "500+", label: "Clínicas Ativas", icon: Building2 },
  { value: "2.000+", label: "Profissionais", icon: Users },
  { value: "1M+", label: "Consultas/Mês", icon: Calendar },
  { value: "99.9%", label: "Uptime", icon: TrendingUp },
];

const values = [
  {
    icon: Heart,
    title: "Cuidado com o Cliente",
    description: "Tratamos cada clínica como se fosse nossa. Suporte humanizado e dedicado.",
  },
  {
    icon: Zap,
    title: "Inovação Constante",
    description: "Atualizações semanais com novos recursos baseados no feedback dos usuários.",
  },
  {
    icon: Shield,
    title: "Segurança em Primeiro Lugar",
    description: "Dados criptografados, backup automático e compliance total com LGPD.",
  },
  {
    icon: Target,
    title: "Foco em Resultados",
    description: "Cada funcionalidade é pensada para aumentar a eficiência e o faturamento.",
  },
];

const timeline = [
  {
    year: "2022",
    title: "O Início",
    description: "Nascemos da frustração de profissionais de saúde com sistemas complexos e caros.",
  },
  {
    year: "2023",
    title: "Crescimento",
    description: "Lançamento do módulo odontológico e expansão para clínicas multiprofissionais.",
  },
  {
    year: "2024",
    title: "Consolidação",
    description: "Integração TISS completa, teleconsulta e portal do paciente.",
  },
  {
    year: "2025",
    title: "Expansão",
    description: "Novos módulos de IA, automações avançadas e expansão internacional.",
  },
];

const team = [
  {
    name: "Dr. André Silva",
    role: "CEO & Co-fundador",
    bio: "Médico com 15 anos de experiência em gestão de clínicas. Viu na tecnologia a solução para os problemas do dia a dia.",
    avatar: "AS",
  },
  {
    name: "Marina Costa",
    role: "CTO & Co-fundadora",
    bio: "Engenheira de software com passagem por grandes healthtechs. Especialista em sistemas de alta disponibilidade.",
    avatar: "MC",
  },
  {
    name: "Dr. Ricardo Mendes",
    role: "Head de Produto",
    bio: "Dentista e empreendedor. Responsável por garantir que cada recurso faça sentido na prática clínica.",
    avatar: "RM",
  },
  {
    name: "Juliana Ferreira",
    role: "Head de Customer Success",
    bio: "10 anos de experiência em atendimento ao cliente. Garante que cada clínica tenha sucesso com o ClinicNest.",
    avatar: "JF",
  },
];

const certifications = [
  "LGPD Compliance",
  "ISO 27001 (em processo)",
  "TISS ANS 3.05",
  "CFM/CRO Compliance",
  "SNGPC Integrado",
  "Backup Automático",
];

export default function SobreNosPage() {
  return (
    <LandingLayout>
      {/* Hero Section */}
      <section className="relative overflow-hidden bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950 py-20 sm:py-28">
        <div className="absolute inset-0 bg-[url('/grid.svg')] bg-center opacity-10" />
        <div className="container relative mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <Badge className="mb-4 bg-teal-500/20 text-teal-300 border-teal-400/30">
              Sobre o ClinicNest
            </Badge>
            <h1 className="text-4xl font-bold tracking-tight text-white sm:text-5xl lg:text-6xl">
              Transformando a{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-teal-300 to-cyan-300">
                gestão de clínicas
              </span>{" "}
              no Brasil
            </h1>
            <p className="mt-6 text-lg text-white/70 sm:text-xl">
              Nascemos da necessidade real de profissionais de saúde que buscavam 
              um sistema completo, intuitivo e acessível. Hoje, somos a escolha de 
              centenas de clínicas em todo o Brasil.
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-white border-b">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
            {stats.map((stat, idx) => {
              const Icon = stat.icon;
              return (
                <div key={idx} className="text-center">
                  <div className="flex justify-center mb-2">
                    <Icon className="h-6 w-6 text-teal-600" />
                  </div>
                  <div className="text-3xl font-bold text-teal-700 sm:text-4xl">
                    {stat.value}
                  </div>
                  <div className="text-sm text-muted-foreground">{stat.label}</div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Mission, Vision, Values */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid gap-12 lg:grid-cols-2 lg:gap-16 items-center">
            <div>
              <Badge className="mb-4">Nossa Essência</Badge>
              <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
                Missão, Visão e Valores
              </h2>
              
              <div className="mt-8 space-y-8">
                <div className="flex gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-teal-100 border border-teal-200">
                    <Target className="h-6 w-6 text-teal-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Missão</h3>
                    <p className="mt-1 text-muted-foreground">
                      Simplificar a gestão de clínicas de saúde, permitindo que profissionais 
                      foquem no que realmente importa: cuidar de pessoas.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-cyan-100 border border-cyan-200">
                    <Eye className="h-6 w-6 text-cyan-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Visão</h3>
                    <p className="mt-1 text-muted-foreground">
                      Ser a plataforma de gestão de saúde mais completa e amada do Brasil, 
                      presente em cada clínica que busca excelência.
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <div className="flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-xl bg-purple-100 border border-purple-200">
                    <Heart className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold">Propósito</h3>
                    <p className="mt-1 text-muted-foreground">
                      Acreditamos que tecnologia de qualidade deve ser acessível a todos. 
                      Por isso, oferecemos um sistema completo a preços justos.
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {values.map((value, idx) => {
                const Icon = value.icon;
                return (
                  <Card key={idx} className="border-2 hover:border-teal-200 transition-colors">
                    <CardContent className="pt-6">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100">
                        <Icon className="h-5 w-5 text-teal-600" />
                      </div>
                      <h3 className="mt-4 font-semibold">{value.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground">
                        {value.description}
                      </p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Timeline */}
      <section className="py-20 sm:py-28 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge className="mb-4">Nossa Jornada</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Uma história de inovação
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Do sonho à realidade: como construímos o sistema que está transformando clínicas.
            </p>
          </div>

          <div className="relative">
            <div className="absolute left-1/2 top-0 bottom-0 w-0.5 bg-teal-200 hidden md:block" />
            <div className="space-y-12">
              {timeline.map((item, idx) => (
                <div
                  key={idx}
                  className={`relative flex flex-col md:flex-row gap-8 ${
                    idx % 2 === 0 ? "md:flex-row" : "md:flex-row-reverse"
                  }`}
                >
                  <div className="flex-1 md:text-right">
                    {idx % 2 === 0 && (
                      <Card className="inline-block text-left">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-teal-600">{item.year}</div>
                          <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  <div className="hidden md:flex items-center justify-center">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-teal-500 text-white font-bold z-10">
                      {item.year.slice(-2)}
                    </div>
                  </div>
                  <div className="flex-1">
                    {idx % 2 !== 0 && (
                      <Card className="inline-block">
                        <CardContent className="pt-6">
                          <div className="text-2xl font-bold text-teal-600">{item.year}</div>
                          <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                          <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                  {/* Mobile version */}
                  <div className="md:hidden">
                    <Card>
                      <CardContent className="pt-6">
                        <div className="text-2xl font-bold text-teal-600">{item.year}</div>
                        <h3 className="mt-2 text-lg font-semibold">{item.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground">{item.description}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Team Section */}
      <section className="py-20 sm:py-28 bg-background">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-16">
            <Badge className="mb-4">Nosso Time</Badge>
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">
              Pessoas apaixonadas por saúde e tecnologia
            </h2>
            <p className="mt-4 text-lg text-muted-foreground">
              Uma equipe multidisciplinar unida pelo propósito de transformar a gestão de clínicas.
            </p>
          </div>

          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {team.map((member, idx) => (
              <Card key={idx} className="text-center hover:shadow-lg transition-shadow">
                <CardContent className="pt-8 pb-6">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 text-white text-2xl font-bold">
                    {member.avatar}
                  </div>
                  <h3 className="mt-4 text-lg font-semibold">{member.name}</h3>
                  <p className="text-sm text-teal-600 font-medium">{member.role}</p>
                  <p className="mt-3 text-sm text-muted-foreground">{member.bio}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* Certifications */}
      <section className="py-16 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center mb-10">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">
              Certificações e Compliance
            </h2>
            <p className="mt-2 text-muted-foreground">
              Segurança e conformidade são prioridades absolutas.
            </p>
          </div>

          <div className="flex flex-wrap justify-center gap-4">
            {certifications.map((cert, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="px-4 py-2 text-sm bg-white border border-teal-200"
              >
                <CheckCircle2 className="h-4 w-4 mr-2 text-teal-600" />
                {cert}
              </Badge>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-br from-teal-950 via-teal-900 to-cyan-950">
        <div className="container mx-auto px-4 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-3xl text-center">
            <div className="flex justify-center mb-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/20 border border-teal-400/30">
                <Rocket className="h-8 w-8 text-teal-300" />
              </div>
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Faça parte dessa história
            </h2>
            <p className="mt-4 text-lg text-white/70">
              Junte-se a centenas de clínicas que já transformaram sua gestão com o ClinicNest.
            </p>
            <div className="mt-8 flex flex-col sm:flex-row gap-4 justify-center">
              <Link to="/cadastro">
                <Button size="lg" className="w-full sm:w-auto bg-gradient-to-r from-teal-500 to-cyan-400 hover:from-teal-600 hover:to-cyan-500 text-white font-semibold shadow-lg shadow-teal-500/30">
                  Começar Grátis
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
    </LandingLayout>
  );
}
