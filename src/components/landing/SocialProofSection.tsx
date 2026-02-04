import { Shield, Award, CheckCircle2, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";

const certifications = [
  {
    icon: Shield,
    title: "Segurança Certificada",
    description: "Dados protegidos com criptografia SSL",
    color: "green",
  },
  {
    icon: Award,
    title: "Melhor Plataforma 2024",
    description: "Reconhecido pela Associação Brasileira de Salões",
    color: "violet",
  },
  {
    icon: CheckCircle2,
    title: "LGPD Compliant",
    description: "Totalmente em conformidade com a LGPD",
    color: "blue",
  },
  {
    icon: TrendingUp,
    title: "+500 Salões Ativos",
    description: "Crescendo todos os dias",
    color: "fuchsia",
  },
];

const logos = [
  "Studio Carla",
  "Barbearia Vintage",
  "Espaço Beauty",
  "Salão Elegance",
  "Beauty Center",
  "Hair Studio",
];

export function SocialProofSection() {
  return (
    <section className="py-16 sm:py-24 bg-gradient-to-b from-background to-violet-50/50">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8">
        {/* Certifications */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {certifications.map((cert) => {
            const Icon = cert.icon;
            const colorClasses: Record<string, string> = {
              green: "bg-green-100 text-green-600",
              violet: "bg-violet-100 text-violet-600",
              blue: "bg-blue-100 text-blue-600",
              fuchsia: "bg-fuchsia-100 text-fuchsia-600",
            };

            return (
              <Card key={cert.title} className="text-center border-2 hover:border-violet-200 transition-all">
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
            Confiado por centenas de salões em todo o Brasil
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
        <div className="grid sm:grid-cols-3 gap-6 max-w-3xl mx-auto">
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent mb-2">
              98%
            </div>
            <p className="text-sm text-muted-foreground">Taxa de Satisfação</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent mb-2">
              4.9/5
            </div>
            <p className="text-sm text-muted-foreground">Avaliação Média</p>
          </div>
          <div className="text-center">
            <div className="text-3xl font-bold bg-gradient-to-r from-violet-600 to-fuchsia-500 bg-clip-text text-transparent mb-2">
              24/7
            </div>
            <p className="text-sm text-muted-foreground">Suporte Disponível</p>
          </div>
        </div>
      </div>
    </section>
  );
}
