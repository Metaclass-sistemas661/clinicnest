import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  TrendingUp,
  Check,
  ArrowRight,
  X,
  Users,
  Calendar,
  FileText,
  DollarSign,
  Package,
  Target,
  Award,
  BarChart3,
  Download,
  Headphones,
  Zap,
  Shield,
  Clock,
  Building2,
  Stethoscope,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useState } from "react";

type BillingKey = "monthly" | "annual";

const PRICING = {
  solo: {
    monthly: { price: "149,90", perMonth: null, total: null },
    annual:  { price: "1.349,00", perMonth: "R$112,42/mês", total: "R$1.349,00 cobrados anualmente", savings: "Economize R$450,80/ano" },
  },
  clinic: {
    monthly: { price: "249,90", perMonth: null, total: null },
    annual:  { price: "2.249,00", perMonth: "R$187,42/mês", total: "R$2.249,00 cobrados anualmente", savings: "Economize R$749,80/ano" },
  },
  premium: {
    monthly: { price: "399,90", perMonth: null, total: null },
    annual:  { price: "3.599,00", perMonth: "R$299,92/mês", total: "R$3.599,00 cobrados anualmente", savings: "Economize R$1.199,80/ano" },
  },
};

type FeatureItem =
  | { type: "include"; icon: React.ElementType; label: string }
  | { type: "exclude"; label: string };

const TIERS: Array<{
  key: keyof typeof PRICING;
  name: string;
  tagline: string;
  target: string;
  icon: React.ElementType;
  popular?: boolean;
  dark?: boolean;
  features: FeatureItem[];
  ctaLabel: string;
}> = [
  {
    key: "solo",
    name: "Solo",
    tagline: "Para profissionais autônomos",
    target: "Médico, psicólogo, fisioterapeuta individual",
    icon: Stethoscope,
    features: [
      { type: "include", icon: Users,      label: "1 profissional + 1 admin" },
      { type: "include", icon: Calendar,   label: "Até 500 pacientes" },
      { type: "include", icon: Calendar,   label: "Agenda médica completa" },
      { type: "include", icon: FileText,   label: "Prontuário eletrônico" },
      { type: "include", icon: DollarSign, label: "Financeiro básico" },
      { type: "include", icon: Package,    label: "Gestão de insumos" },
      { type: "include", icon: Clock,      label: "Histórico de 12 meses" },
      { type: "include", icon: Headphones, label: "Suporte por e-mail" },
      { type: "exclude",                   label: "Convênios e faturamento" },
      { type: "exclude",                   label: "Comissões e metas" },
      { type: "exclude",                   label: "Múltiplos profissionais" },
    ],
    ctaLabel: "Começar grátis",
  },
  {
    key: "clinic",
    name: "Clínica",
    tagline: "Para clínicas em crescimento",
    target: "Clínicas com equipe e múltiplos profissionais",
    icon: Building2,
    popular: true,
    dark: true,
    features: [
      { type: "include", icon: Users,      label: "Até 5 profissionais + admin" },
      { type: "include", icon: Calendar,   label: "Até 3.000 pacientes" },
      { type: "include", icon: Calendar,   label: "Agenda médica completa" },
      { type: "include", icon: FileText,   label: "Prontuário eletrônico completo" },
      { type: "include", icon: Award,      label: "Convênios e faturamento" },
      { type: "include", icon: DollarSign, label: "Financeiro avançado" },
      { type: "include", icon: Target,     label: "Comissões, metas e performance" },
      { type: "include", icon: BarChart3,  label: "Relatórios e exportação" },
      { type: "include", icon: Package,    label: "Gestão de insumos" },
      { type: "include", icon: Clock,      label: "Histórico ilimitado" },
      { type: "include", icon: Headphones, label: "Suporte via chat (Seg–Sáb)" },
    ],
    ctaLabel: "Começar grátis",
  },
  {
    key: "premium",
    name: "Premium",
    tagline: "Para policlínicas e centros médicos",
    target: "Múltiplas especialidades, alta demanda",
    icon: Shield,
    features: [
      { type: "include", icon: Users,      label: "Profissionais ilimitados" },
      { type: "include", icon: Calendar,   label: "Pacientes ilimitados" },
      { type: "include", icon: Calendar,   label: "Agenda médica completa" },
      { type: "include", icon: FileText,   label: "Prontuário + modelos personalizados" },
      { type: "include", icon: Award,      label: "Convênios e faturamento TISS" },
      { type: "include", icon: DollarSign, label: "Financeiro e DRE avançado" },
      { type: "include", icon: Target,     label: "Comissões, metas e performance" },
      { type: "include", icon: Download,   label: "Exportação completa (PDF/Excel)" },
      { type: "include", icon: Zap,        label: "API de integração" },
      { type: "include", icon: Clock,      label: "Histórico ilimitado" },
      { type: "include", icon: Headphones, label: "Suporte prioritário via WhatsApp" },
    ],
    ctaLabel: "Falar com consultor",
  },
];

export function PricingSection() {
  const [billing, setBilling] = useState<BillingKey>("annual");

  const annualSavingsPct = 25;

  return (
    <section id="pricing" className="py-20 sm:py-32 bg-gradient-to-b from-background to-teal-50/30 relative overflow-hidden">
      {/* subtle bg blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -right-32 w-96 h-96 bg-teal-100/40 rounded-full blur-3xl" />
        <div className="absolute -bottom-32 -left-32 w-96 h-96 bg-cyan-100/30 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-4 sm:px-6 lg:px-8 relative">

        {/* ── Header ── */}
        <div className="text-center max-w-3xl mx-auto mb-12">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-teal-100 border border-teal-200 mb-6">
            <TrendingUp className="h-4 w-4 text-teal-600" aria-hidden="true" />
            <span className="text-sm font-medium text-teal-600">Planos e Preços</span>
          </div>
          <h2 className="font-display text-3xl sm:text-4xl md:text-5xl font-bold mb-4">
            Transparência que{" "}
            <span className="bg-gradient-to-r from-teal-600 to-cyan-500 bg-clip-text text-transparent">
              você merece
            </span>
          </h2>
          <p className="text-lg text-muted-foreground">
            Sem surpresas, sem letras miúdas. Escolha o plano certo para o tamanho da sua clínica.
          </p>
        </div>

        {/* ── Billing Toggle ── */}
        <div className="flex items-center justify-center gap-4 mb-12">
          <button
            onClick={() => setBilling("monthly")}
            className={cn(
              "px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border",
              billing === "monthly"
                ? "bg-white border-teal-300 text-teal-700 shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Mensal
          </button>

          <button
            onClick={() => setBilling("annual")}
            className={cn(
              "relative px-5 py-2.5 rounded-full text-sm font-medium transition-all duration-200 border",
              billing === "annual"
                ? "bg-white border-teal-300 text-teal-700 shadow-sm"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            Anual
            <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-500 text-white">
              -{annualSavingsPct}%
            </span>
          </button>
        </div>

        {billing === "annual" && (
          <p className="text-center text-sm text-teal-700 font-medium mb-10 -mt-6">
            Pague anualmente e ganhe <strong>3 meses grátis</strong> em qualquer plano.
          </p>
        )}

        {/* ── Cards ── */}
        <div className="grid md:grid-cols-3 gap-6 lg:gap-8 max-w-6xl mx-auto items-start">
          {TIERS.map((tier) => {
            const price = PRICING[tier.key][billing];
            const Icon = tier.icon;

            return (
              <div
                key={tier.key}
                className={cn(
                  "relative rounded-3xl border-2 transition-all duration-300 hover:shadow-2xl flex flex-col",
                  tier.popular
                    ? "border-teal-500 shadow-2xl shadow-teal-500/20 md:-translate-y-4 bg-gradient-to-b from-teal-800 to-teal-900 text-white"
                    : "border-gray-200 bg-white shadow-lg hover:-translate-y-1"
                )}
              >
                {/* Popular ribbon */}
                {tier.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2">
                    <div className="px-5 py-1.5 rounded-full bg-gradient-to-r from-teal-400 to-cyan-400 text-teal-950 text-xs font-bold shadow-lg whitespace-nowrap tracking-wide uppercase">
                      Mais Popular
                    </div>
                  </div>
                )}

                <div className={cn("p-6 sm:p-8", tier.popular && "pt-10")}>

                  {/* Plan header */}
                  <div className="flex items-start justify-between mb-5">
                    <div>
                      <div className={cn(
                        "inline-flex items-center justify-center h-11 w-11 rounded-2xl mb-3",
                        tier.popular ? "bg-white/15" : "bg-teal-50"
                      )}>
                        <Icon className={cn("h-6 w-6", tier.popular ? "text-teal-300" : "text-teal-600")} />
                      </div>
                      <h3 className={cn("font-display text-2xl font-bold", tier.popular ? "text-white" : "text-gray-900")}>
                        {tier.name}
                      </h3>
                      <p className={cn("text-sm mt-0.5", tier.popular ? "text-teal-200" : "text-muted-foreground")}>
                        {tier.tagline}
                      </p>
                    </div>
                  </div>

                  {/* Target audience pill */}
                  <div className={cn(
                    "text-xs px-3 py-1.5 rounded-lg mb-6 leading-snug",
                    tier.popular ? "bg-white/10 text-teal-100" : "bg-teal-50 text-teal-700"
                  )}>
                    {tier.target}
                  </div>

                  {/* Price */}
                  <div className="mb-2">
                    <div className="flex items-baseline gap-1">
                      <span className={cn("text-sm font-medium", tier.popular ? "text-teal-300" : "text-muted-foreground")}>
                        R$
                      </span>
                      <span className={cn(
                        "font-display font-extrabold tracking-tight",
                        tier.popular ? "text-white text-5xl" : "text-gray-900 text-4xl"
                      )}>
                        {price.price}
                      </span>
                      <span className={cn("text-sm", tier.popular ? "text-teal-300" : "text-muted-foreground")}>
                        {billing === "monthly" ? "/mês" : "/ano"}
                      </span>
                    </div>

                    {price.perMonth && (
                      <p className={cn("text-xs mt-1", tier.popular ? "text-teal-300" : "text-muted-foreground")}>
                        equivale a {price.perMonth}
                      </p>
                    )}
                    {price.total && (
                      <p className={cn("text-xs", tier.popular ? "text-teal-300" : "text-muted-foreground")}>
                        {price.total}
                      </p>
                    )}
                  </div>

                  {/* Savings badge */}
                  {billing === "annual" && (
                    <div className={cn(
                      "inline-flex items-center gap-1 text-xs font-semibold px-3 py-1 rounded-full mb-6",
                      tier.popular
                        ? "bg-cyan-400/20 text-cyan-200 border border-cyan-400/30"
                        : "bg-green-50 text-green-700 border border-green-200"
                    )}>
                      <Check className="h-3 w-3" />
                      {PRICING[tier.key].annual.savings}
                    </div>
                  )}

                  {/* Divider */}
                  <div className={cn("h-px mb-6", tier.popular ? "bg-white/15" : "bg-gray-100")} />

                  {/* Features */}
                  <ul className="space-y-3 mb-8 flex-1">
                    {tier.features.map((feat, i) => (
                      <li key={i} className="flex items-start gap-3">
                        {feat.type === "include" ? (
                          <>
                            <div className={cn(
                              "flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mt-0.5",
                              tier.popular ? "bg-teal-400/25" : "bg-teal-100"
                            )}>
                              <Check className={cn("h-3 w-3", tier.popular ? "text-teal-300" : "text-teal-600")} />
                            </div>
                            <span className={cn("text-sm leading-relaxed", tier.popular ? "text-teal-50" : "text-gray-700")}>
                              {feat.label}
                            </span>
                          </>
                        ) : (
                          <>
                            <div className="flex-shrink-0 h-5 w-5 rounded-full flex items-center justify-center mt-0.5 bg-gray-100">
                              <X className="h-3 w-3 text-gray-400" />
                            </div>
                            <span className={cn("text-sm leading-relaxed", tier.popular ? "text-teal-300/60" : "text-gray-400")}>
                              {feat.label}
                            </span>
                          </>
                        )}
                      </li>
                    ))}
                  </ul>

                  {/* CTA */}
                  <Link to="/cadastro" className="block">
                    <Button
                      size="lg"
                      className={cn(
                        "w-full h-12 rounded-2xl font-semibold text-base group transition-all duration-300",
                        tier.popular
                          ? "bg-white text-teal-800 hover:bg-teal-50 shadow-lg hover:shadow-xl hover:scale-[1.02]"
                          : tier.key === "premium"
                          ? "bg-teal-900 hover:bg-teal-800 text-white shadow-md hover:shadow-lg"
                          : "bg-gradient-to-r from-teal-600 to-cyan-500 hover:from-teal-700 hover:to-cyan-600 text-white shadow-md hover:shadow-lg hover:shadow-teal-500/25"
                      )}
                    >
                      {tier.ctaLabel}
                      <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-1 transition-transform" />
                    </Button>
                  </Link>

                  <p className={cn("text-center text-xs mt-3", tier.popular ? "text-teal-300" : "text-muted-foreground")}>
                    5 dias grátis · Sem cartão de crédito
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Guarantee Strip ── */}
        <div className="mt-16 max-w-4xl mx-auto">
          <div className="rounded-2xl border border-teal-100 bg-white/80 backdrop-blur-sm px-6 py-6 sm:px-10 sm:py-8">
            <div className="grid sm:grid-cols-4 gap-6 text-center">
              {[
                {
                  icon: Clock,
                  title: "5 dias grátis",
                  desc: "Acesso total sem compromisso",
                },
                {
                  icon: Shield,
                  title: "Cancele quando quiser",
                  desc: "Sem multa, sem burocracia",
                },
                {
                  icon: Headphones,
                  title: "Suporte humanizado",
                  desc: "Segunda a sábado, atendimento real",
                },
                {
                  icon: Check,
                  title: "LGPD + SSL",
                  desc: "Dados protegidos por lei",
                },
              ].map((item) => {
                const Icon = item.icon;
                return (
                  <div key={item.title} className="flex flex-col items-center gap-2">
                    <div className="h-10 w-10 rounded-xl bg-teal-50 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-teal-600" />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{item.title}</p>
                    <p className="text-xs text-muted-foreground leading-snug">{item.desc}</p>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* ── FAQ Strip ── */}
        <div className="mt-10 text-center space-y-2">
          <p className="text-sm text-muted-foreground">
            Precisa de um plano personalizado para redes de clínicas ou hospitais?{" "}
            <a href="mailto:contato@metaclass.com.br" className="font-semibold text-teal-600 hover:text-teal-700 underline underline-offset-2 transition-colors">
              Fale com nossa equipe comercial
            </a>
          </p>
          <p className="text-xs text-muted-foreground/60">
            Todos os preços em reais (BRL). Planos sujeitos a alteração com aviso prévio de 30 dias.
          </p>
        </div>
      </div>
    </section>
  );
}
