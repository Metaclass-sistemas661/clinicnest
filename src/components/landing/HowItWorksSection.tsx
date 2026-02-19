import { UserPlus, Settings, CalendarCheck, TrendingUp, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const steps = [
  {
    icon: UserPlus,
    step: "01",
    title: "Crie sua Conta",
    description: "Cadastro rápido em menos de 2 minutos. Sem complicação.",
    color: "teal",
  },
  {
    icon: Settings,
    step: "02",
    title: "Configure sua Clínica",
    description: "Adicione especialidades, convênios e sua equipe de profissionais.",
    color: "cyan",
  },
  {
    icon: CalendarCheck,
    step: "03",
    title: "Organize os Agendamentos",
    description: "Gerencie sua agenda médica com confirmações e status em tempo real.",
    color: "blue",
  },
  {
    icon: TrendingUp,
    step: "04",
    title: "Acompanhe o Crescimento",
    description: "Use financeiro, metas e indicadores para evoluir com consistência.",
    color: "green",
  },
];

export function HowItWorksSection() {
  const colorClasses: Record<string, { bg: string; text: string; border: string }> = {
    teal: { bg: "bg-teal-100", text: "text-teal-600", border: "border-teal-300" },
    cyan: { bg: "bg-cyan-100", text: "text-cyan-600", border: "border-cyan-300" },
    blue: { bg: "bg-blue-100", text: "text-blue-600", border: "border-blue-300" },
    green: { bg: "bg-green-100", text: "text-green-600", border: "border-green-300" },
  };

  return (
    <section className="py-20 sm:py-32 bg-background relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-teal-300 to-transparent" />

      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
            <ArrowRight className="h-4 w-4 text-teal-600" />
            <span className="text-sm font-medium text-teal-600">Primeiros Passos</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Comece em{" "}
            <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
              4 passos simples
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Do cadastro ao primeiro agendamento em menos de 10 minutos.
          </p>
        </div>

        {/* Steps */}
        <div className="relative">
          {/* Connection Line - Desktop */}
          <div className="hidden lg:block absolute top-1/2 left-0 right-0 h-0.5 bg-gradient-to-r from-teal-200 via-cyan-200 to-green-200 -translate-y-1/2" />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const colors = colorClasses[step.color];

              return (
                <div
                  key={step.step}
                  className="relative group"
                >
                  <div className="relative p-6 sm:p-8 rounded-2xl bg-white border shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-2 h-full flex flex-col">
                    {/* Step Number Badge */}
                    <div className={cn(
                      "absolute -top-3 -right-3 h-10 w-10 rounded-full flex items-center justify-center font-bold text-sm border-2 bg-white shadow-md",
                      colors.text,
                      colors.border
                    )}>
                      {step.step}
                    </div>

                    {/* Icon */}
                    <div className={cn(
                      "inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-6 transition-all duration-300 group-hover:scale-110 flex-shrink-0",
                      colors.bg
                    )}>
                      <Icon className={cn("h-8 w-8", colors.text)} aria-hidden="true" />
                    </div>

                    {/* Content */}
                    <div className="flex-1 flex flex-col">
                      <h3 className="font-display text-xl font-semibold mb-3">
                        {step.title}
                      </h3>
                      <p className="text-muted-foreground flex-1">
                        {step.description}
                      </p>
                    </div>
                  </div>

                  {/* Arrow - Desktop only, not after last item */}
                  {index < steps.length - 1 && (
                    <div className="hidden lg:flex absolute top-1/2 -right-4 -translate-y-1/2 z-10">
                      <div className="h-8 w-8 rounded-full bg-white border shadow flex items-center justify-center">
                        <ArrowRight className="h-4 w-4 text-teal-500" />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
