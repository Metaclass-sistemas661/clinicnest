import { memo } from "react";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Activity, Apple, Brain, Ear, Gem } from "lucide-react";
import type { ProfessionalType } from "@/types/database";

interface Props {
  professionalType: ProfessionalType;
  values: Record<string, string>;
  onChange: (key: string, value: string) => void;
  disabled?: boolean;
}

/* ─── Field definitions per profession ─── */

function FisioFields({ values, onChange, disabled }: Omit<Props, "professionalType">) {
  return (
    <div className="rounded-lg border border-info/20 bg-info/5 p-4 space-y-3">
      <p className="text-xs font-semibold flex items-center gap-1.5 text-info">
        <Activity className="h-3.5 w-3.5" /> Avaliação Cinético-Funcional
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">ADM (Amplitude de Movimento)</Label>
          <Input value={values.rom || ""} onChange={e => onChange("rom", e.target.value)} placeholder="Ex: Ombro D flexão 120°" disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Força Muscular (Escala Oxford)</Label>
          <Input value={values.muscle_strength || ""} onChange={e => onChange("muscle_strength", e.target.value)} placeholder="Ex: Quadríceps D grau 4" disabled={disabled} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Testes Funcionais</Label>
        <Textarea value={values.functional_tests || ""} onChange={e => onChange("functional_tests", e.target.value)} placeholder="Testes especiais realizados e resultados..." rows={2} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Objetivos / Progressão</Label>
        <Textarea value={values.rehab_goals || ""} onChange={e => onChange("rehab_goals", e.target.value)} placeholder="Metas de reabilitação e exercícios prescritos..." rows={2} disabled={disabled} />
      </div>
    </div>
  );
}

function NutriFields({ values, onChange, disabled }: Omit<Props, "professionalType">) {
  return (
    <div className="rounded-lg border border-success/20 bg-success/5 p-4 space-y-3">
      <p className="text-xs font-semibold flex items-center gap-1.5 text-success">
        <Apple className="h-3.5 w-3.5" /> Avaliação Nutricional
      </p>
      <div className="grid grid-cols-3 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">IMC calculado</Label>
          <Input value={values.bmi || ""} onChange={e => onChange("bmi", e.target.value)} placeholder="Ex: 24.5" disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Circ. Abdominal (cm)</Label>
          <Input value={values.waist_circumference || ""} onChange={e => onChange("waist_circumference", e.target.value)} placeholder="Ex: 88" disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">% Gordura Corporal</Label>
          <Input value={values.body_fat || ""} onChange={e => onChange("body_fat", e.target.value)} placeholder="Ex: 22%" disabled={disabled} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Recordatório Alimentar 24h</Label>
        <Textarea value={values.food_recall || ""} onChange={e => onChange("food_recall", e.target.value)} placeholder="Desjejum, lanches, almoço, jantar..." rows={3} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Plano Alimentar / Orientações</Label>
        <Textarea value={values.diet_plan || ""} onChange={e => onChange("diet_plan", e.target.value)} placeholder="Metas calóricas, restrições, suplementação..." rows={2} disabled={disabled} />
      </div>
    </div>
  );
}

function PsicoFields({ values, onChange, disabled }: Omit<Props, "professionalType">) {
  return (
    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3">
      <p className="text-xs font-semibold flex items-center gap-1.5 text-primary">
        <Brain className="h-3.5 w-3.5" /> Nota de Sessão
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de Sessão</Label>
          <Select value={values.session_type || ""} onValueChange={v => onChange("session_type", v)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="individual">Individual</SelectItem>
              <SelectItem value="casal">Casal</SelectItem>
              <SelectItem value="familiar">Familiar</SelectItem>
              <SelectItem value="grupo">Grupo</SelectItem>
              <SelectItem value="avaliacao">Avaliação Psicológica</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Abordagem</Label>
          <Select value={values.approach || ""} onValueChange={v => onChange("approach", v)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="tcc">TCC</SelectItem>
              <SelectItem value="psicanalise">Psicanálise</SelectItem>
              <SelectItem value="humanista">Humanista</SelectItem>
              <SelectItem value="sistemica">Sistêmica</SelectItem>
              <SelectItem value="comportamental">Comportamental</SelectItem>
              <SelectItem value="gestalt">Gestalt</SelectItem>
              <SelectItem value="outra">Outra</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Humor / Estado Emocional Observado</Label>
        <Input value={values.patient_mood || ""} onChange={e => onChange("patient_mood", e.target.value)} placeholder="Ex: Ansioso, humor rebaixado, colaborativo..." disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Impressões e Intervenções</Label>
        <Textarea value={values.session_notes || ""} onChange={e => onChange("session_notes", e.target.value)} placeholder="Temas abordados, intervenções realizadas, dinâmica da sessão..." rows={3} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Tarefa / Homework</Label>
        <Input value={values.homework || ""} onChange={e => onChange("homework", e.target.value)} placeholder="Exercício ou tarefa para próxima sessão..." disabled={disabled} />
      </div>
    </div>
  );
}

function FonoFields({ values, onChange, disabled }: Omit<Props, "professionalType">) {
  return (
    <div className="rounded-lg border border-warning/20 bg-warning/5 p-4 space-y-3">
      <p className="text-xs font-semibold flex items-center gap-1.5 text-warning">
        <Ear className="h-3.5 w-3.5" /> Avaliação Fonoaudiológica
      </p>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Área de Atuação</Label>
          <Select value={values.fono_area || ""} onValueChange={v => onChange("fono_area", v)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="linguagem">Linguagem</SelectItem>
              <SelectItem value="motricidade">Motricidade Orofacial</SelectItem>
              <SelectItem value="voz">Voz</SelectItem>
              <SelectItem value="audiologia">Audiologia</SelectItem>
              <SelectItem value="disfagia">Disfagia</SelectItem>
              <SelectItem value="fluencia">Fluência</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Avaliação Auditiva</Label>
          <Input value={values.hearing_assessment || ""} onChange={e => onChange("hearing_assessment", e.target.value)} placeholder="Resultados audiométricos..." disabled={disabled} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Avaliação de Linguagem / Fala</Label>
        <Textarea value={values.speech_assessment || ""} onChange={e => onChange("speech_assessment", e.target.value)} placeholder="Compreensão, expressão, articulação, fluência..." rows={2} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Deglutição / Motricidade Orofacial</Label>
        <Textarea value={values.swallowing_assessment || ""} onChange={e => onChange("swallowing_assessment", e.target.value)} placeholder="Funções estomatognáticas, achados..." rows={2} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Exercícios e Orientações</Label>
        <Textarea value={values.fono_exercises || ""} onChange={e => onChange("fono_exercises", e.target.value)} placeholder="Exercícios prescritos, orientações ao paciente/família..." rows={2} disabled={disabled} />
      </div>
    </div>
  );
}

/* ─── Estética ─── */
function EsteticaFields({ values, onChange, disabled }: Omit<Props, "professionalType">) {
  return (
    <div className="space-y-3 p-3 border rounded-lg bg-fuchsia-50/30 dark:bg-fuchsia-950/10">
      <div className="flex items-center gap-2 text-fuchsia-600 dark:text-fuchsia-400">
        <Gem className="h-4 w-4" />
        <span className="text-xs font-semibold">Campos Estéticos</span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Tipo de Procedimento</Label>
          <Select value={values.procedure_type || ""} onValueChange={v => onChange("procedure_type", v)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="toxina">Toxina Botulínica</SelectItem>
              <SelectItem value="preenchimento">Preenchimento</SelectItem>
              <SelectItem value="bioestimulador">Bioestimulador</SelectItem>
              <SelectItem value="fios_pdo">Fios de PDO</SelectItem>
              <SelectItem value="laser">Laser</SelectItem>
              <SelectItem value="microagulhamento">Microagulhamento</SelectItem>
              <SelectItem value="peeling">Peeling</SelectItem>
              <SelectItem value="outro">Outro</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Classificação Glogau</Label>
          <Select value={values.glogau || ""} onValueChange={v => onChange("glogau", v)} disabled={disabled}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Selecione..." /></SelectTrigger>
            <SelectContent>
              <SelectItem value="I">I - Sem rugas</SelectItem>
              <SelectItem value="II">II - Rugas em movimento</SelectItem>
              <SelectItem value="III">III - Rugas em repouso</SelectItem>
              <SelectItem value="IV">IV - Rugas difusas</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1">
          <Label className="text-xs">Produto Utilizado</Label>
          <Input value={values.aesthetic_product || ""} onChange={e => onChange("aesthetic_product", e.target.value)} placeholder="Nome comercial, fabricante..." disabled={disabled} />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Lote / Validade</Label>
          <Input value={values.batch_info || ""} onChange={e => onChange("batch_info", e.target.value)} placeholder="Lote e validade do produto" disabled={disabled} />
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Zonas Tratadas</Label>
        <Textarea value={values.treated_zones || ""} onChange={e => onChange("treated_zones", e.target.value)} placeholder="Regiões faciais/corporais tratadas, pontos de aplicação..." rows={2} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Intercorrências</Label>
        <Textarea value={values.complications || ""} onChange={e => onChange("complications", e.target.value)} placeholder="Eventos durante ou após o procedimento..." rows={2} disabled={disabled} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs">Orientações Pós-Procedimento</Label>
        <Textarea value={values.post_care || ""} onChange={e => onChange("post_care", e.target.value)} placeholder="Cuidados pós, restrições, retorno..." rows={2} disabled={disabled} />
      </div>
    </div>
  );
}

const SUPPORTED: ProfessionalType[] = ["fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo", "esteticista"];

export const ProfessionFields = memo(function ProfessionFields({ professionalType, values, onChange, disabled }: Props) {
  if (!SUPPORTED.includes(professionalType)) return null;

  switch (professionalType) {
    case "fisioterapeuta": return <FisioFields values={values} onChange={onChange} disabled={disabled} />;
    case "nutricionista": return <NutriFields values={values} onChange={onChange} disabled={disabled} />;
    case "psicologo": return <PsicoFields values={values} onChange={onChange} disabled={disabled} />;
    case "fonoaudiologo": return <FonoFields values={values} onChange={onChange} disabled={disabled} />;
    case "esteticista": return <EsteticaFields values={values} onChange={onChange} disabled={disabled} />;
    default: return null;
  }
});
