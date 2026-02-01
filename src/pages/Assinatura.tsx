import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/AuthContext";
import { CreditCard, Check, Sparkles } from "lucide-react";

const plans = [
  {
    name: "Básico",
    price: "Grátis",
    description: "Ideal para começar",
    features: [
      "Até 50 agendamentos/mês",
      "1 profissional",
      "Cadastro de clientes",
      "Cadastro de serviços",
    ],
    current: true,
  },
  {
    name: "Profissional",
    price: "R$ 79",
    period: "/mês",
    description: "Para salões em crescimento",
    features: [
      "Agendamentos ilimitados",
      "Até 5 profissionais",
      "Controle financeiro",
      "Controle de estoque",
      "Relatórios básicos",
      "Suporte por email",
    ],
    recommended: true,
  },
  {
    name: "Premium",
    price: "R$ 149",
    period: "/mês",
    description: "Para salões estabelecidos",
    features: [
      "Tudo do Profissional",
      "Profissionais ilimitados",
      "Relatórios avançados",
      "Integração WhatsApp",
      "Multi-unidade",
      "Suporte prioritário",
    ],
  },
];

export default function Assinatura() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <MainLayout title="Assinatura" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <CreditCard className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem gerenciar a assinatura
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Assinatura"
      subtitle="Gerencie seu plano"
    >
      <div className="mb-8">
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="flex items-center justify-between p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-primary">
                <CreditCard className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Plano Atual: Básico (Grátis)</p>
                <p className="text-sm text-muted-foreground">
                  Você está utilizando o plano gratuito
                </p>
              </div>
            </div>
            <Badge className="bg-success/20 text-success border-success/30">Ativo</Badge>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={plan.recommended ? "border-primary shadow-glow" : ""}
          >
            {plan.recommended && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <Badge className="gradient-primary text-primary-foreground">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Recomendado
                </Badge>
              </div>
            )}
            <CardHeader className="pt-8">
              <CardTitle>{plan.name}</CardTitle>
              <CardDescription>{plan.description}</CardDescription>
              <div className="pt-4">
                <span className="text-4xl font-bold">{plan.price}</span>
                {plan.period && (
                  <span className="text-muted-foreground">{plan.period}</span>
                )}
              </div>
            </CardHeader>
            <CardContent>
              <ul className="mb-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-2">
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-success/20 text-success">
                      <Check className="h-3 w-3" />
                    </div>
                    <span className="text-sm">{feature}</span>
                  </li>
                ))}
              </ul>
              {plan.current ? (
                <Button variant="outline" className="w-full" disabled>
                  Plano Atual
                </Button>
              ) : (
                <Button
                  className={
                    plan.recommended
                      ? "w-full gradient-primary text-primary-foreground"
                      : "w-full"
                  }
                  variant={plan.recommended ? "default" : "outline"}
                >
                  Assinar Agora
                </Button>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-8 text-center">
        <p className="text-sm text-muted-foreground">
          Pagamentos processados com segurança via Stripe.
          <br />
          Cancele a qualquer momento sem multas.
        </p>
      </div>
    </MainLayout>
  );
}
