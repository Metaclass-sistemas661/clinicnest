import { useState } from "react";
import { HelpCircle, X, ExternalLink, PlayCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Link } from "react-router-dom";

export interface HelpTopic {
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  videoUrl?: string;
  docsLink?: string;
}

interface ContextualHelpProps {
  topic: HelpTopic;
  size?: "sm" | "md";
  className?: string;
}

export function ContextualHelp({ topic, size = "sm", className = "" }: ContextualHelpProps) {
  const [open, setOpen] = useState(false);

  const iconSize = size === "sm" ? "h-4 w-4" : "h-5 w-5";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className={`rounded-full text-muted-foreground hover:text-primary hover:bg-primary/10 ${
            size === "sm" ? "h-6 w-6" : "h-8 w-8"
          } ${className}`}
          aria-label="Ajuda"
        >
          <HelpCircle className={iconSize} />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="bg-gradient-to-r from-primary to-primary/80 p-3 rounded-t-lg">
          <div className="flex items-start justify-between">
            <h4 className="font-semibold text-primary-foreground text-sm">{topic.title}</h4>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-primary-foreground/80 hover:text-primary-foreground hover:bg-white/10"
              onClick={() => setOpen(false)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="p-3 space-y-3">
          <p className="text-sm text-muted-foreground">{topic.description}</p>

          {topic.steps && topic.steps.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-foreground mb-2">Como fazer:</p>
              <ol className="space-y-1.5">
                {topic.steps.map((step, i) => (
                  <li key={i} className="flex gap-2 text-xs">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">
                      {i + 1}
                    </span>
                    <span className="text-muted-foreground pt-0.5">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {topic.tips && topic.tips.length > 0 && (
            <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-2">
              <p className="text-xs font-semibold text-amber-600 dark:text-amber-400 mb-1">Dicas:</p>
              <ul className="space-y-1">
                {topic.tips.map((tip, i) => (
                  <li key={i} className="text-xs text-muted-foreground flex gap-1.5">
                    <span className="text-amber-500">•</span>
                    {tip}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex gap-2 pt-1">
            {topic.videoUrl && (
              <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                <a href={topic.videoUrl} target="_blank" rel="noopener noreferrer">
                  <PlayCircle className="h-3 w-3 mr-1" />
                  Ver vídeo
                </a>
              </Button>
            )}
            {topic.docsLink && (
              <Button variant="outline" size="sm" className="text-xs h-7" asChild>
                <Link to={topic.docsLink}>
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Ver mais
                </Link>
              </Button>
            )}
            <Button variant="outline" size="sm" className="text-xs h-7 ml-auto" asChild>
              <Link to="/ajuda">Central de Ajuda</Link>
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export const HELP_TOPICS: Record<string, HelpTopic> = {
  agenda: {
    title: "Agenda",
    description: "Gerencie consultas, horários e atendimentos da clínica.",
    steps: [
      "Clique em 'Novo Agendamento' para criar",
      "Selecione paciente, serviço e profissional",
      "Escolha data e horário disponível",
      "Confirme e finalize após o atendimento",
    ],
    tips: [
      "Finalize atendimentos para gerar dados financeiros",
      "Use filtros para encontrar agendamentos rapidamente",
    ],
    docsLink: "/ajuda#agenda",
  },
  pacientes: {
    title: "Pacientes",
    description: "Cadastre e gerencie informações dos pacientes.",
    steps: [
      "Clique em 'Novo Paciente'",
      "Preencha nome, telefone e dados básicos",
      "Adicione observações importantes (alergias, etc)",
    ],
    tips: [
      "Use o campo de observações para preferências",
      "O histórico mostra todos os atendimentos",
    ],
    docsLink: "/ajuda#pacientes",
  },
  prontuarios: {
    title: "Prontuários",
    description: "Registros clínicos com estrutura SOAP e assinatura digital.",
    steps: [
      "Selecione o paciente",
      "Preencha anamnese, exame físico e conduta",
      "Adicione CID-10 quando aplicável",
      "Assine digitalmente para validar",
    ],
    tips: [
      "Prontuários assinados não podem ser alterados",
      "Use o histórico para ver evoluções anteriores",
    ],
    docsLink: "/ajuda#prontuarios",
  },
  financeiro: {
    title: "Financeiro",
    description: "Controle receitas, despesas e fluxo de caixa.",
    steps: [
      "Registre transações manualmente ou via agenda",
      "Categorize corretamente para relatórios",
      "Acompanhe o saldo e projeções",
    ],
    tips: [
      "Atendimentos finalizados geram receita automaticamente",
      "Exporte relatórios em PDF quando necessário",
    ],
    docsLink: "/ajuda#financeiro",
  },
  equipe: {
    title: "Equipe",
    description: "Gerencie profissionais, permissões e comissões.",
    steps: [
      "Convide membros por e-mail",
      "Defina função (admin ou profissional)",
      "Configure comissões se aplicável",
    ],
    tips: [
      "Admins têm acesso total ao financeiro",
      "Profissionais veem apenas suas comissões",
    ],
    docsLink: "/ajuda#equipe",
  },
  receituarios: {
    title: "Receituários",
    description: "Prescrições médicas com impressão formatada.",
    steps: [
      "Selecione o paciente",
      "Adicione medicamentos com posologia",
      "Imprima ou envie digitalmente",
    ],
    tips: [
      "Receitas controladas exigem dados adicionais",
      "Use modelos para agilizar prescrições comuns",
    ],
    docsLink: "/ajuda#receituarios",
  },
  tiss: {
    title: "Faturamento TISS",
    description: "Geração de guias para convênios no padrão ANS.",
    steps: [
      "Selecione atendimentos para faturar",
      "Escolha o tipo de guia (consulta, SP/SADT, honorários)",
      "Gere o XML e envie à operadora",
      "Acompanhe retornos e glosas",
    ],
    tips: [
      "Mantenha dados do convênio atualizados",
      "Recursos de glosa têm prazo legal",
    ],
    docsLink: "/ajuda#tiss",
  },
  triagem: {
    title: "Triagem",
    description: "Registro de sinais vitais e classificação de risco.",
    steps: [
      "Selecione o paciente na fila",
      "Registre sinais vitais",
      "Classifique a prioridade",
      "Encaminhe para atendimento",
    ],
    tips: [
      "Médicos recebem notificação quando triagem é concluída",
      "Use a classificação de Manchester quando aplicável",
    ],
    docsLink: "/ajuda#triagem",
  },
};
