import { useState, useEffect } from "react";
import { ClipboardList, Printer, Save, Loader2, CheckCircle } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { LAUDO_TIPOS } from "@/data/exam-types";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import type { DocumentContext } from "./QuickDocumentActions";

// Tipo expandido para incluir os novos tipos da tabela medical_reports
type LaudoTipo = "medico" | "pericial" | "aptidao" | "capacidade" | "complementar" | "psicologico" | "neuropsicologico" | "ocupacional" | "outro";

interface LaudoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DocumentContext;
  onSave?: (data: LaudoData) => void;
  onPrint?: (data: LaudoData) => void;
}

export interface LaudoData {
  patientId: string;
  professionalId?: string;
  medicalRecordId?: string;
  tipo: LaudoTipo;
  finalidade: string;
  historiaClinica: string;
  exameFisico: string;
  examesComplementares: string;
  diagnostico: string;
  cid10?: string;
  conclusao: string;
  observacoes: string;
}

export function LaudoDrawer({
  open,
  onOpenChange,
  context,
  onSave,
  onPrint,
}: LaudoDrawerProps) {
  const { profile, tenantId } = useAuth();
  const [tipo, setTipo] = useState<LaudoTipo>("medico");
  const [finalidade, setFinalidade] = useState("");
  const [historiaClinica, setHistoriaClinica] = useState("");
  const [exameFisico, setExameFisico] = useState("");
  const [examesComplementares, setExamesComplementares] = useState("");
  const [diagnostico, setDiagnostico] = useState(context.diagnosis || "");
  const [cid10, setCid10] = useState(context.cid10 || "");
  const [conclusao, setConclusao] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setTipo("medico");
      setFinalidade("");
      setHistoriaClinica("");
      setExameFisico("");
      setExamesComplementares("");
      setDiagnostico(context.diagnosis || "");
      setCid10(context.cid10 || "");
      setConclusao("");
      setObservacoes("");
    }
  }, [open, context.diagnosis, context.cid10]);

  const getData = (): LaudoData => ({
    patientId: context.patientId,
    professionalId: context.professionalId,
    medicalRecordId: context.medicalRecordId,
    tipo,
    finalidade,
    historiaClinica,
    exameFisico,
    examesComplementares,
    diagnostico,
    cid10,
    conclusao,
    observacoes,
  });

  // Persiste na tabela medical_reports + chama callback
  const handleSave = async () => {
    if (!conclusao.trim()) {
      toast.error("A conclusão do laudo é obrigatória");
      return;
    }

    setIsSaving(true);
    try {
      // Salvar na tabela medical_reports (CFM Res. 1.658/2002)
      if (tenantId && profile?.id) {
        const { error } = await supabase.from("medical_reports").insert({
          tenant_id: tenantId,
          patient_id: context.patientId,
          professional_id: profile.id,
          medical_record_id: context.medicalRecordId || null,
          tipo,
          finalidade: finalidade || null,
          historia_clinica: historiaClinica || null,
          exame_fisico: exameFisico || null,
          exames_complementares: examesComplementares || null,
          diagnostico: diagnostico || null,
          cid10: cid10 || null,
          conclusao,
          observacoes: observacoes || null,
          status: "finalizado",
        });

        if (error) {
          // Se tabela ainda não existe (migration pendente), apenas loga e continua
          if (error.code === "42P01") {
            logger.warn("Tabela medical_reports ainda não existe, salvando apenas via callback");
          } else {
            throw error;
          }
        } else {
          toast.success("Laudo salvo no prontuário!");
        }
      }

      // Chama callback externo (compatibilidade)
      onSave?.(getData());
      onOpenChange(false);
    } catch (err) {
      logger.error("Erro ao salvar laudo:", err);
      toast.error("Erro ao salvar laudo médico", { description: normalizeError(err, "Não foi possível salvar o laudo.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    onPrint?.(getData());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-purple-600" />
            Novo Laudo Médico
          </SheetTitle>
          <SheetDescription>
            Paciente: <strong>{context.clientName}</strong>
            {context.clientCpf && ` • CPF: ${context.clientCpf}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Tipo de laudo — lista expandida CFM */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Laudo *</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as LaudoTipo)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LAUDO_TIPOS.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Finalidade</Label>
              <Input
                placeholder="Ex: Processo judicial, INSS, Concurso, Carteira de motorista"
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
              />
            </div>
          </div>

          {/* Informação CFM */}
          <div className="rounded-lg bg-purple-50 dark:bg-purple-950/20 border border-purple-200 dark:border-purple-800 p-3">
            <p className="text-xs text-purple-700 dark:text-purple-300">
              <strong>CFM Res. 1.658/2002:</strong> O laudo deve conter história clínica, exame físico,
              exames complementares, diagnóstico com CID-10 e conclusão fundamentada.
              Este documento será salvo permanentemente no prontuário.
            </p>
          </div>

          <div className="space-y-2">
            <Label>História Clínica</Label>
            <Textarea
              placeholder="Resumo da história clínica relevante, incluindo queixa principal, HDA, antecedentes..."
              value={historiaClinica}
              onChange={(e) => setHistoriaClinica(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Exame Físico</Label>
            <Textarea
              placeholder="Achados do exame físico: inspeção, palpação, ausculta, sinais vitais..."
              value={exameFisico}
              onChange={(e) => setExameFisico(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Exames Complementares</Label>
            <Textarea
              placeholder="Resultados de exames laboratoriais, imagem, etc. referenciados neste laudo..."
              value={examesComplementares}
              onChange={(e) => setExamesComplementares(e.target.value)}
              rows={3}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Diagnóstico</Label>
              <Input
                placeholder="Diagnóstico principal"
                value={diagnostico}
                onChange={(e) => setDiagnostico(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>CID-10</Label>
              <Input
                placeholder="Ex: J06.9"
                value={cid10}
                onChange={(e) => setCid10(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Conclusão *</Label>
            <Textarea
              placeholder="Conclusão e parecer médico fundamentado..."
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
              rows={4}
              className={!conclusao.trim() ? "border-orange-300" : ""}
            />
            {!conclusao.trim() && (
              <p className="text-xs text-orange-500">Campo obrigatório conforme CFM</p>
            )}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais, recomendações, prazo de validade..."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" onClick={handlePrint} disabled={isSaving}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleSave} disabled={isSaving || !conclusao.trim()}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            {isSaving ? "Salvando..." : "Salvar Laudo"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
