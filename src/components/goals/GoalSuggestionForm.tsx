import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, Sparkles } from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { goalTypeLabels, periodLabels, type GoalType, type GoalPeriod } from "@/lib/goals";

interface GoalSuggestionFormProps {
  tenantId: string;
  professionalId: string;
  onSuccess: () => void;
}

export function GoalSuggestionForm({ tenantId, professionalId, onSuccess }: GoalSuggestionFormProps) {
  const [name, setName] = useState("");
  const [goalType, setGoalType] = useState<GoalType>("revenue");
  const [targetValue, setTargetValue] = useState("");
  const [period, setPeriod] = useState<GoalPeriod>("monthly");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0) {
      toast.error("Informe um valor de meta válido");
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await api.from("goal_suggestions").insert({
        tenant_id: tenantId,
        professional_id: professionalId,
        name: name.trim() || `Meta ${goalTypeLabels[goalType]}`,
        goal_type: goalType,
        target_value: target,
        period,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Sugestão enviada! O administrador analisará em breve.");
      setName("");
      setTargetValue("");
      setGoalType("revenue");
      setPeriod("monthly");
      onSuccess();
    } catch (e: unknown) {
      logger.error(e);
      toast.error((e as { message?: string })?.message || "Erro ao enviar sugestão");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="p-4 space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Sparkles className="h-5 w-5 text-primary" />
        <h3 className="font-semibold text-lg">Sugerir uma meta</h3>
      </div>
      <p className="text-sm text-muted-foreground -mt-2 mb-4">
        Proponha uma meta para si mesmo. O administrador revisará e poderá aprovar ou rejeitar.
      </p>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <Label htmlFor="suggestion-name">Nome (opcional)</Label>
          <Input
            id="suggestion-name"
            placeholder="Ex: Receita do mês"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="mt-1"
            data-tour="my-goals-suggest-name"
          />
        </div>

        <div>
          <Label htmlFor="suggestion-type">Tipo de meta</Label>
          <Select value={goalType} onValueChange={(v) => setGoalType(v as GoalType)}>
            <SelectTrigger id="suggestion-type" className="mt-1" data-tour="my-goals-suggest-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(goalTypeLabels).map(([k, v]) => (
                <SelectItem key={k} value={k}>
                  {v}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="suggestion-period">Período</Label>
          <Select value={period} onValueChange={(v) => setPeriod(v as GoalPeriod)}>
            <SelectTrigger id="suggestion-period" className="mt-1" data-tour="my-goals-suggest-period">
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

        <div className="sm:col-span-2">
          <Label htmlFor="suggestion-value">Valor da meta</Label>
          <Input
            id="suggestion-value"
            type="number"
            step="0.01"
            min="0"
            placeholder={
              goalType.includes("revenue") || goalType === "ticket_medio" ? "0,00" : "0"
            }
            value={targetValue}
            onChange={(e) => setTargetValue(e.target.value)}
            required
            className="mt-1"
            data-tour="my-goals-suggest-target-value"
          />
        </div>
      </div>

      <Button
        type="submit"
        disabled={isSubmitting || !targetValue}
        variant="gradient" className="w-full sm:w-auto"
        data-tour="my-goals-suggest-submit"
      >
        {isSubmitting ? (
          <Loader2 className="h-4 w-4 animate-spin mr-2" />
        ) : (
          <Sparkles className="h-4 w-4 mr-2" />
        )}
        Enviar sugestão
      </Button>
    </form>
  );
}
