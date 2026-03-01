import { useState, useEffect } from "react";
import { ArrowRightLeft, Printer, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import type { DocumentContext } from "./QuickDocumentActions";

interface EncaminhamentoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DocumentContext;
  onSave?: (data: EncaminhamentoData) => void;
  onPrint?: (data: EncaminhamentoData) => void;
}

export interface EncaminhamentoData {
  patientId: string;
  professionalId?: string;
  medicalRecordId?: string;
  tipo: "especialista" | "exame" | "internacao" | "urgencia" | "outro";
  especialidade: string;
  profissionalDestino?: string;
  instituicaoDestino?: string;
  prioridade: "normal" | "urgente" | "emergencia";
  hipoteseDiagnostica: string;
  cid10?: string;
  motivoEncaminhamento: string;
  resumoClinico: string;
  examesSolicitados?: string;
  observacoes: string;
  contraReferencia: boolean;
}

const ESPECIALIDADES = [
  "Cardiologia",
  "Dermatologia",
  "Endocrinologia",
  "Gastroenterologia",
  "Ginecologia",
  "Neurologia",
  "Oftalmologia",
  "Ortopedia",
  "Otorrinolaringologia",
  "Pediatria",
  "Pneumologia",
  "Psiquiatria",
  "Reumatologia",
  "Urologia",
  "Cirurgia Geral",
  "Fisioterapia",
  "Nutrição",
  "Psicologia",
  "Outra",
];

export function EncaminhamentoDrawer({
  open,
  onOpenChange,
  context,
  onSave,
  onPrint,
}: EncaminhamentoDrawerProps) {
  const { profile, tenantId } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [tipo, setTipo] = useState<EncaminhamentoData["tipo"]>("especialista");
  const [especialidade, setEspecialidade] = useState("");
  const [profissionalDestino, setProfissionalDestino] = useState("");
  const [instituicaoDestino, setInstituicaoDestino] = useState("");
  const [prioridade, setPrioridade] = useState<EncaminhamentoData["prioridade"]>("normal");
  const [hipoteseDiagnostica, setHipoteseDiagnostica] = useState(context.diagnosis || "");
  const [cid10, setCid10] = useState(context.cid10 || "");
  const [motivoEncaminhamento, setMotivoEncaminhamento] = useState("");
  const [resumoClinico, setResumoClinico] = useState("");
  const [examesSolicitados, setExamesSolicitados] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [contraReferencia, setContraReferencia] = useState(true);

  useEffect(() => {
    if (open) {
      setTipo("especialista");
      setEspecialidade("");
      setProfissionalDestino("");
      setInstituicaoDestino("");
      setPrioridade("normal");
      setHipoteseDiagnostica(context.diagnosis || "");
      setCid10(context.cid10 || "");
      setMotivoEncaminhamento("");
      setResumoClinico("");
      setExamesSolicitados("");
      setObservacoes("");
      setContraReferencia(true);
    }
  }, [open, context.diagnosis, context.cid10]);

  const getData = (): EncaminhamentoData => ({
    patientId: context.patientId,
    professionalId: context.professionalId,
    medicalRecordId: context.medicalRecordId,
    tipo,
    especialidade,
    profissionalDestino: profissionalDestino || undefined,
    instituicaoDestino: instituicaoDestino || undefined,
    prioridade,
    hipoteseDiagnostica,
    cid10: cid10 || undefined,
    motivoEncaminhamento,
    resumoClinico,
    examesSolicitados: tipo === "exame" ? examesSolicitados : undefined,
    observacoes,
    contraReferencia,
  });

  const handleSave = async () => {
    if (!motivoEncaminhamento.trim()) {
      toast.error("Informe o motivo do encaminhamento");
      return;
    }

    setIsSaving(true);
    try {
      if (tenantId && profile?.id) {
        const { error } = await supabase.from("referrals").insert({
          tenant_id: tenantId,
          patient_id: context.patientId,
          from_professional: profile.id,
          medical_record_id: context.medicalRecordId || null,
          priority: prioridade,
          reason: motivoEncaminhamento,
          clinical_summary: resumoClinico || null,
          notes: [observacoes, examesSolicitados ? `Exames: ${examesSolicitados}` : "", contraReferencia ? "Contra-referência solicitada" : ""].filter(Boolean).join(" | ") || null,
        });

        if (error) {
          if (error.code === "42P01") {
            logger.warn("Tabela referrals não encontrada, salvando via callback");
          } else {
            throw error;
          }
        } else {
          toast.success("Encaminhamento salvo com sucesso!");
        }
      }

      onSave?.(getData());
      onOpenChange(false);
    } catch (err) {
      logger.error("Erro ao salvar encaminhamento:", err);
      toast.error("Erro ao salvar encaminhamento");
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
            <ArrowRightLeft className="h-5 w-5 text-orange-600" />
            Novo Encaminhamento
          </SheetTitle>
          <SheetDescription>
            Paciente: <strong>{context.clientName}</strong>
            {context.clientCpf && ` • CPF: ${context.clientCpf}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Encaminhamento</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as EncaminhamentoData["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="especialista">Especialista</SelectItem>
                  <SelectItem value="exame">Exame/Procedimento</SelectItem>
                  <SelectItem value="internacao">Internação</SelectItem>
                  <SelectItem value="urgencia">Urgência/Emergência</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Prioridade</Label>
              <Select
                value={prioridade}
                onValueChange={(v) => setPrioridade(v as EncaminhamentoData["prioridade"])}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="urgente">Urgente</SelectItem>
                  <SelectItem value="emergencia">Emergência</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {tipo === "especialista" && (
            <div className="space-y-2">
              <Label>Especialidade</Label>
              <Select value={especialidade} onValueChange={setEspecialidade}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a especialidade" />
                </SelectTrigger>
                <SelectContent>
                  {ESPECIALIDADES.map((esp) => (
                    <SelectItem key={esp} value={esp}>
                      {esp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {tipo === "exame" && (
            <div className="space-y-2">
              <Label>Exames/Procedimentos Solicitados</Label>
              <Textarea
                placeholder="Liste os exames ou procedimentos..."
                value={examesSolicitados}
                onChange={(e) => setExamesSolicitados(e.target.value)}
                rows={3}
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Profissional de Destino (opcional)</Label>
              <Input
                placeholder="Nome do profissional"
                value={profissionalDestino}
                onChange={(e) => setProfissionalDestino(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Instituição de Destino (opcional)</Label>
              <Input
                placeholder="Hospital, clínica, etc."
                value={instituicaoDestino}
                onChange={(e) => setInstituicaoDestino(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Hipótese Diagnóstica</Label>
              <Input
                placeholder="Diagnóstico principal"
                value={hipoteseDiagnostica}
                onChange={(e) => setHipoteseDiagnostica(e.target.value)}
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
            <Label>Motivo do Encaminhamento</Label>
            <Textarea
              placeholder="Por que está encaminhando este paciente?"
              value={motivoEncaminhamento}
              onChange={(e) => setMotivoEncaminhamento(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Resumo Clínico</Label>
            <Textarea
              placeholder="Breve resumo do quadro clínico, tratamentos realizados, etc."
              value={resumoClinico}
              onChange={(e) => setResumoClinico(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Observações adicionais"
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex items-center justify-between py-2 border-t">
            <div className="space-y-1">
              <Label>Solicitar Contra-Referência</Label>
              <p className="text-xs text-muted-foreground">
                Pedir retorno de informações do especialista
              </p>
            </div>
            <Switch checked={contraReferencia} onCheckedChange={setContraReferencia} />
          </div>
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4 mr-2" />
            Salvar
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
