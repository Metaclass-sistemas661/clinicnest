import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Send, Loader2 } from "lucide-react";
import { goalTypeLabels, periodLabels, type GoalType, type GoalPeriod } from "@/lib/goals";

interface GoalSuggestionFormProps {
  tenantId: string;
  professionalId: string;
  onSuccess: () => void;
}

export function GoalSuggestionForm({ tenantId, professionalId, onSuccess }: GoalSuggestionFormProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    goal_type: "revenue" as GoalType,
    target_value: "",
    period: "monthly" as GoalPeriod,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const target = parseFloat(formData.target_value);
    if (isNaN(target) || target <= 0) {
      return;
    }

    setIsSubmitting(true);
    try {
      const { supabase } = await import("@/integrations/supabase/client");
      const { error } = await supabase.from("goal_suggestions").insert({
        tenant_id: tenantId,
        professional_id: professionalId,
        name: formData.name.trim() || `Meta ${goalTypeLabels[formData.goal_type]}`,
        goal_type: formData.goal_type,
        target_value: target,
        period: formData.period,
        status: "pending",
      });

      if (error) throw error;

      const { toast } = await import("sonner");
      toast.success("Sugestão enviada! Aguarde a aprovação do administrador.");

      setFormData({ name: "", goal_type: "revenue", target_value: "", period: "monthly" });
      onSuccess();
    } catch (e) {
      const { toast } = await import("sonner");
      toast.error("Erro ao enviar sugestão. Tente novamente.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Send className="h-4 w-4" />
          Sugerir meta
        </CardTitle>
        <CardDescription>
          Proponha uma meta para si mesmo. O administrador do salão aprovará ou não.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label>Nome (opcional)</Label>
            <Input
              placeholder="Ex: Receita mensal"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            />
          </div>
          <div>
            <Label>Tipo de meta</Label>
            <Select
              value={formData.goal_type}
              onValueChange={(v) => setFormData({ ...formData, goal_type: v as GoalType })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="revenue">{goalTypeLabels.revenue}</SelectItem>
                <SelectItem value="services_count">{goalTypeLabels.services_count}</SelectItem>
                <SelectItem value="clientes_novos">{goalTypeLabels.clientes_novos}</SelectItem>
                <SelectItem value="ticket_medio">{goalTypeLabels.ticket_medio}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor da meta</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={formData.goal_type.includes("revenue") || formData.goal_type === "ticket_medio" ? "0,00" : "0"}
              value={formData.target_value}
              onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
              required
            />
          </div>
          <div>
            <Label>Período</Label>
            <Select
              value={formData.period}
              onValueChange={(v) => setFormData({ ...formData, period: v as GoalPeriod })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="weekly">{periodLabels.weekly}</SelectItem>
                <SelectItem value="monthly">{periodLabels.monthly}</SelectItem>
                <SelectItem value="quarterly">{periodLabels.quarterly}</SelectItem>
                <SelectItem value="yearly">{periodLabels.yearly}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={isSubmitting} className="w-full">
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Enviar sugestão"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
