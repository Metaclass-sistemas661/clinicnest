import { Shield, Zap, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const certifications = [
  {
    icon: Shield,
    title: "Segurança Avançada",
    description: "Dados protegidos com criptografia",
    color: "green",
  },
  {
    icon: Zap,
    title: "Setup em Minutos",
    description: "Clínica configurada e operacional rapidamente",
    color: "teal",
  },
  {
    icon: CheckCircle2,
    title: "LGPD",
    description: "Em conformidade com a LGPD",
    color: "blue",
  },
  {
    icon: TrendingUp,
    title: "+500 Clínicas Ativas",
    description: "Crescendo todos os dias",
    color: "cyan",
  },
];

const logos = [
  "Clínica São Lucas",
  "Consultório Lima",
  "Centro Médico Vida",
  "Clínica Integrada",
  "Instituto da Saúde",
  "Consultório Digital",
];

export function SocialProofSection() {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-background to-teal-50/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Certifications */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {certifications.map((cert) => {
            const Icon = cert.icon;
            const colorClasses: Record<string, string> = {
              green: "bg-green-100 text-green-600",
              teal: "bg-teal-100 text-teal-600",
              blue: "bg-blue-100 text-blue-600",
              cyan: "bg-cyan-100 text-cyan-600",
            };

            return (
              <Card key={cert.title} className="text-center border-2 hover:border-teal-200 transition-all">
                <CardContent className="p-6">
                  <div className={`inline-flex h-16 w-16 items-center justify-center rounded-2xl mb-4 ${colorClasses[cert.color]}`}>
                    <Icon className="h-8 w-8" />
                  </div>
                  <h3 className="font-semibold mb-2">{cert.title}</h3>
                  <p className="text-sm text-muted-foreground">{cert.description}</p>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Client Logos */}
        <div className="text-center mb-8">
          <p className="text-sm text-muted-foreground mb-6">
            Confiado por centenas de clínicas em todo o Brasil
          </p>
          <div className="flex flex-wrap justify-center items-center gap-6 sm:gap-8 lg:gap-12">
            {logos.map((logo, idx) => (
              <div
                key={idx}
                className="px-6 py-3 rounded-lg bg-white border shadow-sm hover:shadow-md transition-shadow"
              >
                <span className="text-sm font-semibold text-muted-foreground">{logo}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Trust Stats */}
        <div className="flex flex-row items-start justify-center gap-1 sm:gap-4 md:gap-6 max-w-3xl mx-auto px-2">
          <div className="flex-1 text-center min-w-0">
            <div className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent mb-1 sm:mb-2">
              98%
            </div>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Taxa de Satisfação</p>
          </div>
          <div className="flex-1 text-center min-w-0">
            <div className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent mb-1 sm:mb-2">
              4.9/5
            </div>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Avaliação Média</p>
          </div>
          <div className="flex-1 text-center min-w-0">
            <div className="text-lg sm:text-2xl md:text-3xl font-bold bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent mb-1 sm:mb-2">
              Seg-Sáb
            </div>
            <p className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Suporte Humanizado</p>
          </div>
        </div>
      </div>
    </section>
  );
}
