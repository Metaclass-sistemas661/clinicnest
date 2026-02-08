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
import { ChevronLeft, ChevronRight, Check, Loader2 } from "lucide-react";
import { goalTypeLabels, periodLabels, type GoalType, type GoalPeriod } from "@/lib/goals";

interface Profile {
  id: string;
  full_name: string;
}

interface Product {
  id: string;
  name: string;
}

interface GoalCreateWizardProps {
  professionals: Profile[];
  products: Product[];
  formData: {
    name: string;
    goal_type: GoalType;
    target_value: string;
    period: GoalPeriod;
    professional_id: string | null;
    product_id: string | null;
    show_in_header: boolean;
  };
  onFormChange: (data: Partial<GoalCreateWizardProps["formData"]>) => void;
  onSubmit: (e: React.FormEvent) => void;
  isSaving: boolean;
}

const STEPS = [
  { id: 1, title: "Tipo e valor", description: "Defina o tipo de meta e o valor alvo" },
  { id: 2, title: "Período e escopo", description: "Escolha o período e para quem a meta se aplica" },
  { id: 3, title: "Confirmação", description: "Revise e crie a meta" },
];

export function GoalCreateWizard({
  professionals,
  products,
  formData,
  onFormChange,
  onSubmit,
  isSaving,
}: GoalCreateWizardProps) {
  const [step, setStep] = useState(1);

  const canGoNext = () => {
    if (step === 1) return formData.target_value && parseFloat(formData.target_value) > 0;
    if (step === 2) return true;
    return true;
  };

  const handleNext = () => {
    if (step < 3 && canGoNext()) setStep(step + 1);
  };

  const handlePrev = () => {
    if (step > 1) setStep(step - 1);
  };

  const canHaveProfessional =
    formData.goal_type === "revenue" ||
    formData.goal_type === "services_count" ||
    formData.goal_type === "clientes_novos" ||
    formData.goal_type === "ticket_medio";
  const canHaveProduct =
    formData.goal_type === "product_quantity" || formData.goal_type === "product_revenue";

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center gap-2">
        {STEPS.map((s) => (
          <div key={s.id} className="flex items-center gap-2">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                step >= s.id
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {step > s.id ? <Check className="h-4 w-4" /> : s.id}
            </div>
            {s.id < 3 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
          </div>
        ))}
      </div>
      <p className="text-sm text-muted-foreground">
        {STEPS[step - 1].description}
      </p>

      {step === 1 && (
        <div className="space-y-4">
          <div>
            <Label>Nome (opcional)</Label>
            <Input
              placeholder="Ex: Receita do mês"
              value={formData.name}
              onChange={(e) => onFormChange({ name: e.target.value })}
            />
          </div>
          <div>
            <Label>Tipo de meta</Label>
            <Select
              value={formData.goal_type}
              onValueChange={(v) => onFormChange({ goal_type: v as GoalType })}
            >
              <SelectTrigger>
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
            <Label>Valor da meta</Label>
            <Input
              type="number"
              step="0.01"
              min="0"
              placeholder={
                formData.goal_type.includes("revenue") || formData.goal_type === "ticket_medio"
                  ? "0,00"
                  : "0"
              }
              value={formData.target_value}
              onChange={(e) => onFormChange({ target_value: e.target.value })}
              required
            />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="space-y-4">
          <div>
            <Label>Período</Label>
            <Select
              value={formData.period}
              onValueChange={(v) => onFormChange({ period: v as GoalPeriod })}
            >
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
          {canHaveProfessional && (
            <div>
              <Label>Direcionar para profissional (opcional)</Label>
              <Select
                value={formData.professional_id || "all"}
                onValueChange={(v) => onFormChange({ professional_id: v === "all" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Salão todo" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Salão todo</SelectItem>
                  {professionals.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          {canHaveProduct && (
            <div>
              <Label>Produto (opcional)</Label>
              <Select
                value={formData.product_id || "all"}
                onValueChange={(v) => onFormChange({ product_id: v === "all" ? null : v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Todos os produtos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os produtos</SelectItem>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="wizard_show_header"
              checked={formData.show_in_header}
              onChange={(e) => onFormChange({ show_in_header: e.target.checked })}
              className="rounded"
            />
            <Label htmlFor="wizard_show_header" className="cursor-pointer">
              Exibir barra de progresso no cabeçalho
            </Label>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="rounded-lg border p-4 space-y-2 bg-muted/30">
          <p className="font-medium">Resumo da meta</p>
          <p><span className="text-muted-foreground">Nome:</span> {formData.name || `Meta ${goalTypeLabels[formData.goal_type]}`}</p>
          <p><span className="text-muted-foreground">Tipo:</span> {goalTypeLabels[formData.goal_type]}</p>
          <p><span className="text-muted-foreground">Valor:</span> {formData.target_value}</p>
          <p><span className="text-muted-foreground">Período:</span> {periodLabels[formData.period]}</p>
          {formData.professional_id && (
            <p>
              <span className="text-muted-foreground">Profissional:</span>{" "}
              {professionals.find((p) => p.id === formData.professional_id)?.full_name || "-"}
            </p>
          )}
        </div>
      )}

      <div className="flex justify-between pt-4">
        <Button type="button" variant="outline" onClick={handlePrev} disabled={step === 1}>
          <ChevronLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        {step < 3 ? (
          <Button type="button" onClick={handleNext} disabled={!canGoNext()}>
            Próximo
            <ChevronRight className="h-4 w-4 ml-2" />
          </Button>
        ) : (
          <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar meta"}
          </Button>
        )}
      </div>
    </form>
  );
}
