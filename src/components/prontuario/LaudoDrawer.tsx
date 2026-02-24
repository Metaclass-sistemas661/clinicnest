import { useState, useEffect } from "react";
import { ClipboardList, Printer, Save } from "lucide-react";
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
import type { DocumentContext } from "./QuickDocumentActions";

interface LaudoDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DocumentContext;
  onSave?: (data: LaudoData) => void;
  onPrint?: (data: LaudoData) => void;
}

export interface LaudoData {
  clientId: string;
  professionalId?: string;
  medicalRecordId?: string;
  tipo: "medico" | "pericial" | "aptidao" | "capacidade" | "outro";
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
  const [tipo, setTipo] = useState<LaudoData["tipo"]>("medico");
  const [finalidade, setFinalidade] = useState("");
  const [historiaClinica, setHistoriaClinica] = useState("");
  const [exameFisico, setExameFisico] = useState("");
  const [examesComplementares, setExamesComplementares] = useState("");
  const [diagnostico, setDiagnostico] = useState(context.diagnosis || "");
  const [cid10, setCid10] = useState(context.cid10 || "");
  const [conclusao, setConclusao] = useState("");
  const [observacoes, setObservacoes] = useState("");

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
    clientId: context.clientId,
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

  const handleSave = () => {
    onSave?.(getData());
    onOpenChange(false);
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
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Laudo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as LaudoData["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="medico">Laudo Médico</SelectItem>
                  <SelectItem value="pericial">Laudo Pericial</SelectItem>
                  <SelectItem value="aptidao">Laudo de Aptidão</SelectItem>
                  <SelectItem value="capacidade">Laudo de Capacidade</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Finalidade</Label>
              <Input
                placeholder="Ex: Processo judicial, INSS, Concurso"
                value={finalidade}
                onChange={(e) => setFinalidade(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>História Clínica</Label>
            <Textarea
              placeholder="Resumo da história clínica relevante..."
              value={historiaClinica}
              onChange={(e) => setHistoriaClinica(e.target.value)}
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>Exame Físico</Label>
            <Textarea
              placeholder="Achados do exame físico..."
              value={exameFisico}
              onChange={(e) => setExameFisico(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label>Exames Complementares</Label>
            <Textarea
              placeholder="Resultados de exames laboratoriais, imagem, etc."
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
            <Label>Conclusão</Label>
            <Textarea
              placeholder="Conclusão e parecer médico..."
              value={conclusao}
              onChange={(e) => setConclusao(e.target.value)}
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
