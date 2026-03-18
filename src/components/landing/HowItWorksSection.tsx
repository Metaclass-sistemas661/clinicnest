import { UserPlus, Settings, CalendarCheck, TrendingUp, ArrowRight, Users, FileText, Zap } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./ScrollReveal";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crie sua Conta",
    description: "Cadastro em 2 minutos. Escolha seu plano e comece o trial de 7 dias grátis, sem cartão.",
    color: "teal",
  },
  {
    icon: Settings,
    step: "02",
    title: "Configure sua Clínica",
    description: "Adicione profissionais, especialidades, convênios e configure permissões RBAC para cada perfil.",
    color: "cyan",
  },
  {
    icon: Users,
    step: "03",
    title: "Importe seus Pacientes",
    description: "Migre dados de outros sistemas ou cadastre manualmente. Suporte para importação em massa.",
    color: "blue",
  },
  {
    icon: CalendarCheck,
    step: "04",
    title: "Organize a Agenda",
    description: "Configure disponibilidade, ative confirmação automática via WhatsApp e portal do paciente.",
    color: "green",
  },
  {
    icon: FileText,
    step: "05",
    title: "Personalize Prontuários",
    description: "Crie modelos de prontuário, configure odontograma e defina templates de evolução.",
    color: "violet",
  },
  {
    icon: Zap,
    step: "06",
    title: "Ative Integrações",
    description: "Conecte gateway de pagamento, WhatsApp Business e configure faturamento TISS.",
    color: "pink",
  },
];

export function HowItWorksSection() {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    teal: { bg: "bg-teal-100", text: "text-teal-600", border: "border-teal-300" },
    cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-300" },
    blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-300" },
    green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-300" },
    violet: { bg: "bg-violet-100", text: "text-violet-600", border: "border-violet-300" },
    pink: { bg: "bg-pink-100", text: "text-pink-600", border: "border-pink-300" },
  };

  return (
    <section className="py-20 sm:py-32 bg-background relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
              <ArrowRight className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-600">Primeiros Passos</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              Comece em{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                6 passos simples
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Do cadastro ao primeiro atendimento em menos de 30 minutos. Nossa equipe ajuda na migração.
            </p>
          </div>
        </ScrollReveal>

        <div className="relative">
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-200 via-cyan-200 via-blue-200 via-green-200 via-violet-200 to-pink-200 -translate-y-1/2" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const colors = colorClasses[step.color];

              return (
                <ScrollReveal
                  key={step.step}
                  animation="up"
                  stagger={(index % 3) + 1}
                >
                  <div className="relative group">
                  <div className="relative p-6 sm:p-8 rounded-2xl bg-white border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 h-full flex flex-col">
                    <div className={cn(
                      "absolute -top-3 -right-3 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border-2 bg-white shadow-md",
                      colors.text,
                      colors.border
                    )}>
                      {step.step}
                    </div>

                    <div className={cn(
                      "inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-6 transition-all duration-300 group-hover:scale-110 flex-shrink-0",
                      colors.bg
                    )}>
                      <Icon className={cn("h-8 w-8", colors.text)} aria-hidden="true" />
                    </div>

                    <div className="flex-1 flex flex-col">
                      <h3 className="font-display text-xl font-semibold mb-3">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground flex-1">
                        {step.description}
                      </p>
                    </div>
                  </div>
                  </div>
                </ScrollReveal>
              );
            })}
          </div>
        </div>

        <div className="mt-12 text-center">
          <p className="text-muted-foreground">
            Precisa de ajuda? Nossa equipe oferece{" "}
            <span className="font-semibold text-teal-600">onboarding guiado gratuito</span>{" "}
            para todos os planos.
          </p>
        </div>
      </div>
    </section>
  );
}
