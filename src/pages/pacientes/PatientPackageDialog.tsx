import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Loader2 } from "lucide-react";
import { packageFormSchema } from "./helpers";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  procedures: Array<{ id: string; name: string }>;
  isSaving: boolean;
  onSave: (data: { procedure_id: string; total_sessions: number; expires_at: string | null; notes: string | null }) => void;
}

const initialForm = { procedure_id: "", total_sessions: "5", expires_at: "", notes: "" };

export function PatientPackageDialog({ open, onOpenChange, procedures, isSaving, onSave }: Props) {
  const [form, setForm] = useState(initialForm);

  // Reset form when dialog opens
  const [wasOpen, setWasOpen] = useState(false);
  if (open && !wasOpen) { setWasOpen(true); setForm(initialForm); }
  if (!open && wasOpen) { setWasOpen(false); }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = packageFormSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }
    onSave({
      procedure_id: parsed.data.procedure_id,
      total_sessions: parsed.data.total_sessions,
      expires_at: parsed.data.expires_at || null,
      notes: parsed.data.notes || null,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Vender Pacote</DialogTitle>
          <DialogDescription>Crie um pacote de sessões para o paciente</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Procedimento</Label>
              <Select value={form.procedure_id || undefined} onValueChange={(v) => setForm({ ...form, procedure_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                <SelectContent>
                  {procedures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Total de sessões</Label>
              <Input type="number" min="1" max="100" value={form.total_sessions} onChange={(e) => setForm({ ...form, total_sessions: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Validade (opcional)</Label>
              <Input type="date" value={form.expires_at} onChange={(e) => setForm({ ...form, expires_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} placeholder="Notas sobre o pacote..." />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
            <Button type="submit" className="gradient-primary text-primary-foreground" disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Pacote"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
