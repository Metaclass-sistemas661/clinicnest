import {
  X,
  Check,
  FileText,
  Calendar,
  Users,
  DollarSign,
  AlertTriangle,
  TrendingUp,
  Clock,
  HeartHandshake,
  Smile,
  Shield,
  Zap,
  Globe,
} from "lucide-react";
import { ScrollReveal } from "./ScrollReveal";

const beforeItems = [
  { icon: FileText, text: "Prontuários em papel ou planilhas desorganizadas" },
  { icon: AlertTriangle, text: "Glosas frequentes por erros no faturamento TISS" },
  { icon: DollarSign, text: "Finanças sem controle, comissões calculadas manualmente" },
  { icon: Clock, text: "Horas perdidas com confirmação de consultas por telefone" },
  { icon: Users, text: "Equipe sem permissões definidas, todos veem tudo" },
  { icon: Smile, text: "Odontograma em papel ou sistema separado" },
];

const afterItems = [
  { icon: Calendar, text: "Agenda inteligente com confirmação automática via WhatsApp" },
  { icon: TrendingUp, text: "Faturamento TISS automatizado, glosas reduzidas em 45%" },
  { icon: DollarSign, text: "Financeiro completo com comissões e repasses automáticos" },
  { icon: Globe, text: "Portal do paciente: agendamento 24/7, documentos online" },
  { icon: Shield, text: "RBAC com 11 perfis: cada um vê só o que precisa" },
  { icon: Smile, text: "Odontograma + Periograma + Planos de tratamento integrados" },
];

export function BeforeAfterSection() {
  return (
    <section className="py-20 sm:py-32 bg-gradient-to-b from-teal-50/50 to-background relative">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        <ScrollReveal>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
              <TrendingUp className="h-4 w-4 text-teal-600" />
              <span className="text-sm font-medium text-teal-600">Transformação Real</span>
            </div>
            <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-6">
              A diferença de usar{" "}
              <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
                ClinicNest
              </span>
            </h2>
            <p className="text-lg text-muted-foreground">
              Veja como o dia a dia da sua clínica muda completamente com o único sistema híbrido do Brasil.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-2 gap-6 lg:gap-8 max-w-5xl mx-auto">
          <ScrollReveal animation="left">
          <div className="relative p-6 sm:p-8 rounded-2xl bg-white border-2 border-red-200 shadow-lg h-full flex flex-col">
            <div className="absolute -top-4 left-6">
              <span className="px-4 py-2 rounded-full bg-red-100 text-red-600 font-semibold text-sm border border-red-200">
                Sem ClinicNest
              </span>
            </div>

            <div className="pt-4 space-y-4 flex-1">
              {beforeItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-center gap-4 p-3 rounded-xl bg-red-50/50">
                    <div className="h-10 w-10 rounded-lg bg-red-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-red-500" />
                    </div>
                    <span className="text-foreground flex-1 text-sm">{item.text}</span>
                    <X className="h-5 w-5 text-red-400 flex-shrink-0" />
                  </div>
                );
              })}
            </div>

            <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center border-2 border-white shadow-md">
              <X className="h-6 w-6 text-red-500" />
            </div>
          </div>
          </ScrollReveal>

          <ScrollReveal animation="right">

          <div className="relative p-6 sm:p-8 rounded-2xl bg-white border-2 border-teal-200 shadow-lg h-full flex flex-col">
            <div className="absolute -top-4 left-6">
              <span className="px-4 py-2 rounded-full bg-teal-100 text-teal-600 font-semibold text-sm border border-teal-200">
                Com ClinicNest
              </span>
            </div>

            <div className="pt-4 space-y-4 flex-1">
              {afterItems.map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.text} className="flex items-center gap-4 p-3 rounded-xl bg-teal-50/50">
                    <div className="h-10 w-10 rounded-lg bg-teal-100 flex items-center justify-center flex-shrink-0">
                      <Icon className="h-5 w-5 text-teal-600" aria-hidden="true" />
                    </div>
                    <span className="text-foreground flex-1 text-sm">{item.text}</span>
                    <Check className="h-5 w-5 text-teal-500 flex-shrink-0" aria-hidden="true" />
                  </div>
                );
              })}
            </div>

            <div className="absolute -bottom-3 -right-3 h-12 w-12 rounded-full bg-teal-100 flex items-center justify-center border-2 border-white shadow-md">
              <Check className="h-6 w-6 text-teal-600" />
            </div>
          </div>
          </ScrollReveal>
        </div>

        <ScrollReveal animation="scale">
          <div className="mt-12 text-center">
            <div className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-gradient-to-r from-teal-100 to-cyan-100 border border-teal-200">
              <Zap className="h-5 w-5 text-teal-600" />
              <span className="font-semibold text-teal-700">
                Resultado médio: +40% de eficiência operacional
              </span>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
