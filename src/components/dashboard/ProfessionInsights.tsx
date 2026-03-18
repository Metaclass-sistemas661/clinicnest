import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Brain, Heart, Ear, Apple, Activity, ClipboardList, TrendingUp,
} from "lucide-react";
import type { ProfessionalType } from "@/types/database";

/**
 * Profession-specific tips, quick-links and contextual metrics
 * shown inside DashboardClinico for fisio/nutri/psico/fono.
 */

interface QuickLink {
  label: string;
  description: string;
  href: string;
}

interface ProfessionConfig {
  icon: React.ElementType;
  accent: string;
  title: string;
  sessionLabel: string;
  quickLinks: QuickLink[];
  tips: string[];
}

const configs: Partial<Record<ProfessionalType, ProfessionConfig>> = {
  fisioterapeuta: {
    icon: Activity,
    accent: "text-info bg-info/10 border-info/20",
    title: "Fisioterapia",
    sessionLabel: "Sessões realizadas",
    quickLinks: [
      { label: "Evoluções", description: "Registrar evolução cinética", href: "/evolucoes" },
      { label: "Prontuários", description: "Avaliação funcional", href: "/prontuarios" },
    ],
    tips: [
      "Use o campo 'Exame Físico' para ADM, força muscular e testes funcionais",
      "Registre escala EVA no campo 'Escala de dor' dos sinais vitais",
      "Documente progressão de exercícios no Plano Terapêutico",
    ],
  },
  nutricionista: {
    icon: Apple,
    accent: "text-success bg-success/10 border-success/20",
    title: "Nutrição",
    sessionLabel: "Consultas realizadas",
    quickLinks: [
      { label: "Evoluções", description: "Evolução nutricional", href: "/evolucoes" },
      { label: "Prontuários", description: "Recordatório alimentar", href: "/prontuarios" },
    ],
    tips: [
      "Registre peso e altura nos sinais vitais para cálculo automático de IMC",
      "Use 'Observações' para recordatório alimentar 24h",
      "Documente metas nutricionais no Plano Terapêutico",
    ],
  },
  psicologo: {
    icon: Brain,
    accent: "text-primary bg-primary/10 border-primary/20",
    title: "Psicologia",
    sessionLabel: "Sessões realizadas",
    quickLinks: [
      { label: "Evoluções", description: "Nota de sessão", href: "/evolucoes" },
      { label: "Laudos", description: "Laudos psicológicos", href: "/laudos" },
      { label: "PROMs", description: "Escalas e questionários", href: "/prontuarios" },
    ],
    tips: [
      "O exame físico é ocultado automaticamente no seu prontuário",
      "Use PROMs (PHQ-9, GAD-7) para medir progresso objetivo",
      "Registre impressões clínicas em 'Anamnese' e plano em 'Conduta'",
    ],
  },
  fonoaudiologo: {
    icon: Ear,
    accent: "text-warning bg-warning/10 border-warning/20",
    title: "Fonoaudiologia",
    sessionLabel: "Sessões realizadas",
    quickLinks: [
      { label: "Evoluções", description: "Evolução fonoaudiológica", href: "/evolucoes" },
      { label: "Prontuários", description: "Avaliação auditiva/linguagem", href: "/prontuarios" },
    ],
    tips: [
      "Documente achados audiométricos no Exame Físico",
      "Registre exercícios e orientações no Plano Terapêutico",
      "Use 'Diagnóstico' para classificação CID da condição fonoaudiológica",
    ],
  },
};

interface Props {
  professionalType: ProfessionalType;
  monthCompleted: number;
}

export const ProfessionInsights = memo(function ProfessionInsights({ professionalType, monthCompleted }: Props) {
  const config = configs[professionalType];
  if (!config) return null;

  const Icon = config.icon;

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Quick Links */}
      <Card className={`border ${config.accent.split(" ").find(c => c.startsWith("border-"))}`}>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${config.accent}`}>
              <Icon className="h-4 w-4" />
            </div>
            {config.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          {config.quickLinks.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 hover:bg-muted/40 transition-colors"
            >
              <ClipboardList className="h-4 w-4 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium">{link.label}</p>
                <p className="text-xs text-muted-foreground">{link.description}</p>
              </div>
            </a>
          ))}
        </CardContent>
      </Card>

      {/* Tips + Metric */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
            Dicas &amp; Métricas
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg bg-muted/40 p-3">
            <p className="text-2xl font-bold tabular-nums">{monthCompleted}</p>
            <p className="text-sm text-muted-foreground">{config.sessionLabel} este mês</p>
          </div>
          <div className="space-y-1.5">
            {config.tips.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                <Badge variant="outline" className="shrink-0 h-4 w-4 p-0 flex items-center justify-center text-[9px]">
                  {i + 1}
                </Badge>
                <span>{tip}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
});
