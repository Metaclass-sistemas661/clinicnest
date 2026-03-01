import { useState, useEffect } from "react";
import { format, addDays } from "date-fns";
import { FileSignature, Printer, Save, Loader2 } from "lucide-react";
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

interface AtestadoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DocumentContext;
  onSave?: (data: AtestadoData) => void;
  onPrint?: (data: AtestadoData) => void;
}

export interface AtestadoData {
  patientId: string;
  professionalId?: string;
  medicalRecordId?: string;
  tipo: "medico" | "comparecimento" | "acompanhante";
  dataInicio: string;
  dataFim: string;
  diasAfastamento: number;
  cid10?: string;
  incluirCid: boolean;
  motivo: string;
  observacoes: string;
  horarioComparecimento?: string;
}

export function AtestadoDrawer({
  open,
  onOpenChange,
  context,
  onSave,
  onPrint,
}: AtestadoDrawerProps) {
  const { profile, tenantId } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [tipo, setTipo] = useState<AtestadoData["tipo"]>("medico");
  const [dataInicio, setDataInicio] = useState(format(new Date(), "yyyy-MM-dd"));
  const [diasAfastamento, setDiasAfastamento] = useState(1);
  const [cid10, setCid10] = useState(context.cid10 || "");
  const [incluirCid, setIncluirCid] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [observacoes, setObservacoes] = useState("");
  const [horarioComparecimento, setHorarioComparecimento] = useState("");

  useEffect(() => {
    if (open) {
      setTipo("medico");
      setDataInicio(format(new Date(), "yyyy-MM-dd"));
      setDiasAfastamento(1);
      setCid10(context.cid10 || "");
      setIncluirCid(false);
      setMotivo("");
      setObservacoes("");
      setHorarioComparecimento("");
    }
  }, [open, context.cid10]);

  const dataFim = format(addDays(new Date(dataInicio), diasAfastamento - 1), "yyyy-MM-dd");

  const getData = (): AtestadoData => ({
    patientId: context.patientId,
    professionalId: context.professionalId,
    medicalRecordId: context.medicalRecordId,
    tipo,
    dataInicio,
    dataFim,
    diasAfastamento,
    cid10: incluirCid ? cid10 : undefined,
    incluirCid,
    motivo,
    observacoes,
    horarioComparecimento: tipo === "comparecimento" ? horarioComparecimento : undefined,
  });

  const handleSave = async () => {
    if (!motivo.trim() && tipo === "medico") {
      toast.error("Preencha o motivo/justificativa");
      return;
    }

    setIsSaving(true);
    try {
      // Montar conteúdo textual do atestado
      const conteudo = tipo === "comparecimento"
        ? `Declaro que o paciente ${context.clientName} compareceu a esta unidade de saúde${horarioComparecimento ? ` às ${horarioComparecimento}` : ""} na data de hoje.${motivo ? ` Motivo: ${motivo}` : ""}${observacoes ? ` Obs: ${observacoes}` : ""}`
        : `Atesto que o paciente ${context.clientName} necessita de ${diasAfastamento} dia(s) de afastamento a partir de ${format(new Date(dataInicio), "dd/MM/yyyy")}.${motivo ? ` Motivo: ${motivo}` : ""}${cid10 && incluirCid ? ` CID-10: ${cid10}` : ""}${observacoes ? ` Obs: ${observacoes}` : ""}`;

      const certificateType = tipo === "comparecimento" ? "declaracao_comparecimento" : "atestado";

      if (tenantId && profile?.id) {
        const { error } = await supabase.from("medical_certificates").insert({
          tenant_id: tenantId,
          patient_id: context.patientId,
          professional_id: profile.id,
          appointment_id: null,
          medical_record_id: context.medicalRecordId || null,
          certificate_type: certificateType,
          days_off: tipo === "medico" ? diasAfastamento : null,
          start_date: tipo === "medico" ? dataInicio : null,
          end_date: tipo === "medico" ? dataFim : null,
          cid_code: incluirCid ? cid10 || null : null,
          content: conteudo,
          notes: observacoes || null,
        });

        if (error) {
          if (error.code === "42P01") {
            logger.warn("Tabela medical_certificates não encontrada, salvando via callback");
          } else {
            throw error;
          }
        } else {
          toast.success("Atestado salvo com sucesso!");
        }
      }

      onSave?.(getData());
      onOpenChange(false);
    } catch (err) {
      logger.error("Erro ao salvar atestado:", err);
      toast.error("Erro ao salvar atestado");
    } finally {
      setIsSaving(false);
    }
  };

  const handlePrint = () => {
    onPrint?.(getData());
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-green-600" />
            Novo Atestado
          </SheetTitle>
          <SheetDescription>
            Paciente: <strong>{context.clientName}</strong>
            {context.clientCpf && ` • CPF: ${context.clientCpf}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="space-y-2">
            <Label>Tipo de Atestado</Label>
            <Select value={tipo} onValueChange={(v) => setTipo(v as AtestadoData["tipo"])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="medico">Atestado Médico (Afastamento)</SelectItem>
                <SelectItem value="comparecimento">Declaração de Comparecimento</SelectItem>
                <SelectItem value="acompanhante">Atestado de Acompanhante</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {tipo === "medico" && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Data Início</Label>
                  <Input
                    type="date"
                    value={dataInicio}
                    onChange={(e) => setDataInicio(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dias de Afastamento</Label>
                  <Input
                    type="number"
                    min={1}
                    value={diasAfastamento}
                    onChange={(e) => setDiasAfastamento(parseInt(e.target.value) || 1)}
                  />
                </div>
              </div>

              <div className="p-3 bg-muted rounded-lg text-sm">
                Período: <strong>{format(new Date(dataInicio), "dd/MM/yyyy")}</strong> a{" "}
                <strong>{format(new Date(dataFim), "dd/MM/yyyy")}</strong>
              </div>

              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <Label>Incluir CID-10</Label>
                  <p className="text-xs text-muted-foreground">
                    Requer autorização do paciente
                  </p>
                </div>
                <Switch checked={incluirCid} onCheckedChange={setIncluirCid} />
              </div>

              {incluirCid && (
                <div className="space-y-2">
                  <Label>Código CID-10</Label>
                  <Input
                    placeholder="Ex: J06.9"
                    value={cid10}
                    onChange={(e) => setCid10(e.target.value)}
                  />
                </div>
              )}
            </>
          )}

          {tipo === "comparecimento" && (
            <div className="space-y-2">
              <Label>Horário de Comparecimento</Label>
              <Input
                type="time"
                value={horarioComparecimento}
                onChange={(e) => setHorarioComparecimento(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label>Motivo / Justificativa</Label>
            <Textarea
              placeholder={
                tipo === "medico"
                  ? "Motivo do afastamento (opcional se CID incluído)"
                  : "Motivo da consulta/comparecimento"
              }
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={3}
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
        </div>

        <SheetFooter className="mt-6 flex gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="h-4 w-4 mr-2" />
            Imprimir
          </Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
