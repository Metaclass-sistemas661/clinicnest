import { useState, useEffect } from "react";
import { format } from "date-fns";
import { Pill, Plus, Trash2, Printer, Save } from "lucide-react";
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
import { Separator } from "@/components/ui/separator";
import type { DocumentContext } from "./QuickDocumentActions";

interface ReceitaItem {
  id: string;
  medicamento: string;
  dosagem: string;
  posologia: string;
  quantidade: string;
  uso: "oral" | "topico" | "injetavel" | "inalatorio" | "outro";
}

interface ReceitaDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: DocumentContext;
  onSave?: (data: ReceitaData) => void;
  onPrint?: (data: ReceitaData) => void;
}

export interface ReceitaData {
  patientId: string;
  professionalId?: string;
  medicalRecordId?: string;
  tipo: "simples" | "especial" | "controle_especial";
  itens: ReceitaItem[];
  observacoes: string;
  usoContinuo: boolean;
}

const emptyItem = (): ReceitaItem => ({
  id: crypto.randomUUID(),
  medicamento: "",
  dosagem: "",
  posologia: "",
  quantidade: "",
  uso: "oral",
});

export function ReceitaDrawer({
  open,
  onOpenChange,
  context,
  onSave,
  onPrint,
}: ReceitaDrawerProps) {
  const [tipo, setTipo] = useState<ReceitaData["tipo"]>("simples");
  const [itens, setItens] = useState<ReceitaItem[]>([emptyItem()]);
  const [observacoes, setObservacoes] = useState("");
  const [usoContinuo, setUsoContinuo] = useState(false);

  useEffect(() => {
    if (open) {
      setItens([emptyItem()]);
      setObservacoes("");
      setUsoContinuo(false);
      setTipo("simples");
    }
  }, [open]);

  const addItem = () => {
    setItens([...itens, emptyItem()]);
  };

  const removeItem = (id: string) => {
    if (itens.length > 1) {
      setItens(itens.filter((i) => i.id !== id));
    }
  };

  const updateItem = (id: string, field: keyof ReceitaItem, value: string) => {
    setItens(
      itens.map((i) => (i.id === id ? { ...i, [field]: value } : i))
    );
  };

  const getData = (): ReceitaData => ({
    patientId: context.patientId,
    professionalId: context.professionalId,
    medicalRecordId: context.medicalRecordId,
    tipo,
    itens,
    observacoes,
    usoContinuo,
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
      <SheetContent className="w-full sm:max-w-xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <Pill className="h-5 w-5 text-blue-600" />
            Nova Receita Médica
          </SheetTitle>
          <SheetDescription>
            Paciente: <strong>{context.clientName}</strong>
            {context.clientCpf && ` • CPF: ${context.clientCpf}`}
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo de Receita</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as ReceitaData["tipo"])}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simples">Receita Simples</SelectItem>
                  <SelectItem value="especial">Receita Especial (Branca)</SelectItem>
                  <SelectItem value="controle_especial">Controle Especial (Azul/Amarela)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between pt-6">
              <Label htmlFor="uso-continuo">Uso Contínuo</Label>
              <Switch
                id="uso-continuo"
                checked={usoContinuo}
                onCheckedChange={setUsoContinuo}
              />
            </div>
          </div>

          <Separator />

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Medicamentos</Label>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </div>

            {itens.map((item, index) => (
              <div key={item.id} className="p-4 border rounded-lg space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-muted-foreground">
                    Item {index + 1}
                  </span>
                  {itens.length > 1 && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeItem(item.id)}
                      className="h-8 w-8 text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <div className="space-y-2">
                  <Label>Medicamento</Label>
                  <Input
                    placeholder="Nome do medicamento"
                    value={item.medicamento}
                    onChange={(e) => updateItem(item.id, "medicamento", e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Dosagem</Label>
                    <Input
                      placeholder="Ex: 500mg"
                      value={item.dosagem}
                      onChange={(e) => updateItem(item.id, "dosagem", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Via de Uso</Label>
                    <Select
                      value={item.uso}
                      onValueChange={(v) => updateItem(item.id, "uso", v)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="oral">Oral</SelectItem>
                        <SelectItem value="topico">Tópico</SelectItem>
                        <SelectItem value="injetavel">Injetável</SelectItem>
                        <SelectItem value="inalatorio">Inalatório</SelectItem>
                        <SelectItem value="outro">Outro</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Posologia</Label>
                    <Input
                      placeholder="Ex: 1 comp. 8/8h"
                      value={item.posologia}
                      onChange={(e) => updateItem(item.id, "posologia", e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      placeholder="Ex: 30 comprimidos"
                      value={item.quantidade}
                      onChange={(e) => updateItem(item.id, "quantidade", e.target.value)}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            <Label>Observações</Label>
            <Textarea
              placeholder="Instruções adicionais, alertas, etc."
              value={observacoes}
              onChange={(e) => setObservacoes(e.target.value)}
              rows={3}
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
