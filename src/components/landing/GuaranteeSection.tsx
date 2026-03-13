import { Shield, Clock, Lock, Award, Headphones, FileText, Zap, Database } from "lucide-react";
import { cn } from "@/lib/utils";
import { ScrollReveal } from "./ScrollReveal";

const guarantees = [
  {
    icon: Clock,
    title: "5 Dias Grátis",
    description: "Teste todas as funcionalidades sem compromisso. Sem cartão de crédito.",
    color: "teal"
  },
  {
    icon: Shield,
    title: "Cancele Quando Quiser",
    description: "Sem multas, sem burocracia. Exporte seus dados a qualquer momento.",
    color: "green"
  },
  {
    icon: Headphones,
    title: "Suporte Humanizado",
    description: "Atendimento real de segunda a sábado. Não robôs.",
    color: "blue"
  },
  {
    icon: Lock,
    title: "LGPD Compliant",
    description: "Dados protegidos por lei. Criptografia AES-256 e TLS 1.3.",
    color: "cyan"
  },
  {
    icon: FileText,
    title: "Retenção CFM 20 Anos",
    description: "Prontuários armazenados conforme exigência do Conselho Federal de Medicina.",
    color: "violet"
  },
  {
    icon: Zap,
    title: "99.9% Uptime",
    description: "Infraestrutura redundante com backups automáticos diários.",
    color: "amber"
  },
  {
    icon: Database,
    title: "Seus Dados São Seus",
    description: "Exporte tudo em PDF, Excel ou FHIR. Portabilidade garantida.",
    color: "pink"
  },
  {
    icon: Award,
    title: "Atualizações Constantes",
    description: "Novas funcionalidades e melhorias lançadas regularmente.",
    color: "indigo"
  },
];

export function GuaranteeSection() {
  const colorClasses: Record<string, { bg: string; text: string }> = {
    teal: { bg: "bg-teal-100", text: "text-teal-600" },
    green: { bg: "bg-green-100", text: "text-green-600" },
    blue: { bg: "bg-blue-100", text: "text-blue-600" },
    cyan: { bg: "bg-cyan-100", text: "text-cyan-600" },
    violet: { bg: "bg-violet-100", text: "text-violet-600" },
    amber: { bg: "bg-amber-100", text: "text-amber-600" },
    pink: { bg: "bg-pink-100", text: "text-pink-600" },
    indigo: { bg: "bg-indigo-100", text: "text-indigo-600" },
  };

  return (
    <section className="py-20 sm:py-32 bg-gradient-to-b from-background to-teal-50/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
        <div className="text-center max-w-3xl mx-auto mb-16">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-100 border border-green-200 mb-6">
            <Award className="h-4 w-4 text-green-600" />
            <span className="text-sm font-medium text-green-600">Garantias</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
            Sua{" "}
            <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
              confiança
            </span>{" "}
            é nossa prioridade
          </h2>
          <p className="text-lg text-muted-foreground">
            Compromissos que fazemos com você para garantir segurança, conformidade e satisfação.
          </p>
        </div>
        </ScrollReveal>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8 max-w-7xl mx-auto">
          {guarantees.map((guarantee, index) => {
            const Icon = guarantee.icon;
            const colors = colorClasses[guarantee.color];

            return (
              <ScrollReveal key={guarantee.title} animation="up" stagger={(index % 4) + 1}>
              <div
                className="relative p-6 sm:p-8 rounded-2xl bg-white border shadow-sm hover:shadow-xl transition-all duration-300 text-center group hover:-translate-y-2 h-full flex flex-col"
              >
                <div className="mx-auto mb-6 relative flex-shrink-0">
                  <div className={cn(
                    "h-20 w-20 rounded-full flex items-center justify-center mx-auto transition-all duration-300 group-hover:scale-110",
                    colors.bg
                  )}>
                    <Icon className={cn("h-10 w-10", colors.text)} aria-hidden="true" />
                  </div>
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-teal-500 flex items-center justify-center border-4 border-white">
                    <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                </div>

                <div className="flex-1 flex flex-col">
                  <h3 className="font-display text-xl font-semibold mb-2">
                    {guarantee.title}
                  </h3>
                  <p className="text-muted-foreground text-sm flex-1">
                    {guarantee.description}
                  </p>
                </div>
              </div>
              </ScrollReveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}
