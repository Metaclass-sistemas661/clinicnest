import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, Users } from "lucide-react";
import { goalTypeLabels, periodLabels, type GoalType, type GoalPeriod } from "@/lib/goals";

interface Profile {
  id: string;
  full_name: string;
}

interface BulkCreateGoalsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionals: Profile[];
  onConfirm: (params: {
    goal_type: GoalType;
    target_value: number;
    period: GoalPeriod;
    professionalIds: string[];
  }) => Promise<void>;
}

export function BulkCreateGoalsDialog({
  open,
  onOpenChange,
  professionals,
  onConfirm,
}: BulkCreateGoalsDialogProps) {
  const [goalType, setGoalType] = useState<GoalType>("revenue");
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState<GoalPeriod>("monthly");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [isSaving, setIsSaving] = useState(false);

  const toggleProfessional = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === professionals.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(professionals.map((p) => p.id)));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0 || selectedIds.size === 0) return;
    setIsSaving(true);
    try {
      await onConfirm({
        goal_type: goalType,
        target_value: target,
        period,
        professionalIds: Array.from(selectedIds),
      });
      onOpenChange(false);
      setTargetValue("");
      setSelectedIds(new Set());
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Criar metas em lote
          </DialogTitle>
          <DialogDescription>
            Crie a mesma meta para vários profissionais de uma vez.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Tipo de meta</Label>
            <Select
              value={goalType}
              onValueChange={(v) => setGoalType(v as GoalType)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(["revenue", "services_count", "clientes_novos", "ticket_medio"] as GoalType[]).map(
                  (k) => (
                    <SelectItem key={k} value={k}>
                      {goalTypeLabels[k]}
                    </SelectItem>
                  )
                )}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor da meta</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={goalType.includes("revenue") || goalType === "ticket_medio" ? "0,00" : "0"}
              value={targetValue}
              onChange={(e) => setTargetValue(e.target.value)}
              required
            />
          </div>
          <div>
            <Label>Período</Label>
            <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriod)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(periodLabels).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Profissionais</Label>
              <Button type="button" variant="ghost" size="sm" onClick={selectAll} data-tour="goals-bulk-select-all">
                {selectedIds.size === professionals.length ? "Desmarcar todos" : "Marcar todos"}
              </Button>
            </div>
            <div className="max-h-48 overflow-y-auto space-y-2 rounded-md border p-3">
              {professionals.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum profissional cadastrado.</p>
              ) : (
                professionals.map((p) => (
                  <div key={p.id} className="flex items-center space-x-2">
                    <Checkbox
                      id={`bulk-${p.id}`}
                      checked={selectedIds.has(p.id)}
                      onCheckedChange={() => toggleProfessional(p.id)}
                    />
                    <label
                      htmlFor={`bulk-${p.id}`}
                      className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                    >
                      {p.full_name}
                    </label>
                  </div>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} data-tour="goals-bulk-cancel">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving || selectedIds.size === 0 || !targetValue}
              variant="gradient"
              data-tour="goals-bulk-submit"
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                `Criar ${selectedIds.size} meta(s)`
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
