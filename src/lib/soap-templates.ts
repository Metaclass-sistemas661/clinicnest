import type { ClinicalEvolutionType } from "@/types/database";
import type { LucideIcon } from "lucide-react";
import {
  Stethoscope,
  Dumbbell,
  AudioLines,
  Apple,
  Brain,
  Syringe,
  ClipboardList,
} from "lucide-react";

export interface SoapTemplate {
  key: ClinicalEvolutionType;
  label: string;
  icon: LucideIcon;
  color: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const SOAP_TEMPLATES: SoapTemplate[] = [
  {
    key: "medica",
    label: "Evolução Médica",
    icon: Stethoscope,
    color: "bg-blue-500/10 text-blue-600 border-blue-500/20",
    subjective:
      "Paciente refere... Nega febre, náuseas, vômitos. Sono e apetite preservados.",
    objective:
      "BEG, corado, hidratado, acianótico, anictérico. ACV: RCR 2T BNF s/ sopros. AR: MV+ bilateral s/ RA. Abd: plano, flácido, indolor à palpação, RHA+. MMII: s/ edema.",
    assessment:
      "Hipótese diagnóstica: ... CID: ...\nPaciente em acompanhamento, estável.",
    plan:
      "1. Manter medicações atuais\n2. Solicitar exames laboratoriais de controle\n3. Retorno em 30 dias\n4. Orientações sobre dieta e atividade física",
  },
  {
    key: "fisioterapia",
    label: "Evolução Fisioterapia",
    icon: Dumbbell,
    color: "bg-orange-500/10 text-orange-600 border-orange-500/20",
    subjective:
      "Paciente refere melhora/piora da dor em... EVA: _/10. Relata dificuldade para...",
    objective:
      "ADM: ... Força muscular (MRC): ... Testes especiais: ... Marcha: ... Postura: ...",
    assessment:
      "Paciente em _ª sessão de fisioterapia. Evolução: (favorável/estável/desfavorável).\nObjetivos funcionais: ...",
    plan:
      "1. Cinesioterapia: ...\n2. Eletroterapia: ...\n3. Exercícios domiciliares: ...\n4. Próxima sessão: ...",
  },
  {
    key: "fonoaudiologia",
    label: "Evolução Fonoaudiologia",
    icon: AudioLines,
    color: "bg-violet-500/10 text-violet-600 border-violet-500/20",
    subjective:
      "Paciente/responsável refere... Queixas de voz, fala, linguagem ou deglutição.",
    objective:
      "Avaliação vocal: ... Articulação: ... Fluência: ... Linguagem oral/escrita: ... Motricidade orofacial: ... Deglutição: ...",
    assessment:
      "Diagnóstico fonoaudiológico: ...\nEvolução: (favorável/estável). Paciente em _ª sessão.",
    plan:
      "1. Exercícios vocais/articulatórios: ...\n2. Estimulação de linguagem: ...\n3. Orientação familiar: ...\n4. Próxima sessão: ...",
  },
  {
    key: "nutricao",
    label: "Evolução Nutrição",
    icon: Apple,
    color: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
    subjective:
      "Paciente refere... Adesão ao plano alimentar: ... Apetite: ... Intolerâncias: ... Hábito intestinal: ...",
    objective:
      "Peso: _kg. Altura: _cm. IMC: _. Circunferência abdominal: _cm. Composição corporal: ...\nExames bioquímicos: glicemia _, colesterol _, triglicerídeos _.",
    assessment:
      "Estado nutricional: (eutrófico/sobrepeso/obesidade/desnutrição).\nMeta ponderal: ... Evolução: ...",
    plan:
      "1. Plano alimentar: _kcal/dia\n2. Suplementação: ...\n3. Orientações: ...\n4. Retorno em _ dias para reavaliação",
  },
  {
    key: "psicologia",
    label: "Evolução Psicologia",
    icon: Brain,
    color: "bg-teal-500/10 text-teal-600 border-teal-500/20",
    subjective:
      "Paciente relata... Humor: ... Sono: ... Apetite: ... Relações interpessoais: ... Eventos significativos desde última sessão: ...",
    objective:
      "Apresentação: ... Contato visual: ... Afeto: ... Discurso: ... Insight: ... Juízo crítico: ...",
    assessment:
      "Dinâmica psíquica: ... Hipótese diagnóstica: ...\nPaciente em _ª sessão. Evolução: (favorável/estável).\nRisco: (baixo/moderado/alto).",
    plan:
      "1. Abordagem terapêutica: ...\n2. Técnicas utilizadas: ...\n3. Encaminhamentos: ...\n4. Próxima sessão: ...",
  },
  {
    key: "enfermagem",
    label: "Evolução Enfermagem",
    icon: Syringe,
    color: "bg-pink-500/10 text-pink-600 border-pink-500/20",
    subjective:
      "Paciente refere... Queixas: ... Adesão ao tratamento: ...",
    objective:
      "SV: PA _x_ mmHg, FC _ bpm, FR _ irpm, Tax _°C, SpO2 _%. Glasgow: _. Pele: ... Acesso venoso: ... Feridas: ... Drenos: ...",
    assessment:
      "Diagnóstico de enfermagem (NANDA): ...\nPaciente (estável/instável). Riscos: ...",
    plan:
      "1. Cuidados: ...\n2. Medicações administradas: ...\n3. Procedimentos: ...\n4. Comunicar equipe médica: ...",
  },
  {
    key: "outro",
    label: "Outro Profissional",
    icon: ClipboardList,
    color: "bg-gray-500/10 text-gray-600 border-gray-500/20",
    subjective: "",
    objective: "",
    assessment: "",
    plan: "",
  },
];

export const EVOLUTION_TYPE_LABELS: Record<ClinicalEvolutionType, string> = {
  medica: "Médica",
  fisioterapia: "Fisioterapia",
  fonoaudiologia: "Fonoaudiologia",
  nutricao: "Nutrição",
  psicologia: "Psicologia",
  enfermagem: "Enfermagem",
  outro: "Outro",
};

export const EVOLUTION_TYPE_COLORS: Record<ClinicalEvolutionType, string> = {
  medica: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  fisioterapia: "bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300",
  fonoaudiologia: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  nutricao: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300",
  psicologia: "bg-teal-100 text-teal-700 dark:bg-teal-900/40 dark:text-teal-300",
  enfermagem: "bg-pink-100 text-pink-700 dark:bg-pink-900/40 dark:text-pink-300",
  outro: "bg-gray-100 text-gray-700 dark:bg-gray-900/40 dark:text-gray-300",
};
