import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { TussCombobox } from "@/components/ui/tuss-combobox";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Plus,
  Trash2,
  Info,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import type { CommissionRule } from "./CommissionRuleCard";

interface ProcedureOption {
  id: string;
  name: string;
}

interface Insurance {
  id: string;
  name: string;
}

interface TierConfig {
  min: number;
  max: number | null;
  value: number;
}

interface CommissionRuleFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  professionalId: string;
  professionalName: string;
  rule?: CommissionRule | null;
  onSave: () => void;
}

const ruleTypeOptions = [
  { value: "default", label: "Padrão", description: "Regra base quando nenhuma específica se aplica" },
  { value: "insurance", label: "Por Convênio", description: "Comissão diferenciada por convênio" },
  { value: "service", label: "Por Procedimento", description: "Comissão diferenciada por procedimento" },
  { value: "procedure", label: "Por Procedimento TUSS", description: "Comissão por código TUSS" },
  { value: "referral", label: "Por Captação/Indicação", description: "Comissão para quem agendou ou indicou o paciente" },
] as const;

const calculationTypeOptions = [
  { value: "percentage", label: "Percentual (%)", description: "Porcentagem do valor do procedimento" },
  { value: "fixed", label: "Valor Fixo (R$)", description: "Valor fixo por atendimento" },
  { value: "tiered", label: "Escalonado", description: "Percentual varia conforme faturamento" },
] as const;

const priorityByType: Record<string, number> = {
  default: 0,
  insurance: 10,
  service: 20,
  procedure: 30,
  referral: 5,
};

export function CommissionRuleForm({
  open,
  onOpenChange,
  professionalId,
  professionalName,
  rule,
  onSave,
}: CommissionRuleFormProps) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);

  // Form state
  const [ruleType, setRuleType] = useState<string>("default");
  const [calculationType, setCalculationType] = useState<string>("percentage");
  const [value, setValue] = useState<string>("30");
  const [procedureId, setProcedureId] = useState<string>("");
  const [insuranceId, setInsuranceId] = useState<string>("");
  const [procedureCode, setProcedureCode] = useState<string>("");
  const [isInverted, setIsInverted] = useState(false);
  const [isActive, setIsActive] = useState(true);
  const [tiers, setTiers] = useState<TierConfig[]>([
    { min: 0, max: 5000, value: 30 },
    { min: 5001, max: 10000, value: 35 },
    { min: 10001, max: null, value: 40 },
  ]);

  // Load services and insurances
  useEffect(() => {
    if (!profile?.tenant_id || !open) return;

    const loadData = async () => {
      try {
        const [proceduresRes, insurancesRes] = await Promise.all([
          api
            .from("procedures")
            .select("id, name")
            .eq("tenant_id", profile.tenant_id)
            .eq("is_active", true)
            .order("name"),
          api
            .from("insurance_plans")
            .select("id, name")
            .eq("tenant_id", profile.tenant_id)
            .eq("is_active", true)
            .order("name"),
        ]);

        if (proceduresRes.data) setProcedures(proceduresRes.data);
        if (insurancesRes.data) setInsurances(insurancesRes.data);
      } catch (error) {
        logger.error("Error loading form data:", error);
      }
    };

    loadData();
  }, [profile?.tenant_id, open]);

  // Populate form when editing
  useEffect(() => {
    if (rule) {
      setRuleType(rule.rule_type);
      setCalculationType(rule.calculation_type);
      setValue(String(rule.value));
      setProcedureId(rule.procedure_id || "");
      setInsuranceId(rule.insurance_id || "");
      setProcedureCode(rule.procedure_code || "");
      setIsInverted(rule.is_inverted);
      setIsActive(rule.is_active);
      if (rule.tier_config) {
        setTiers(rule.tier_config);
      }
    } else {
      // Reset form
      setRuleType("default");
      setCalculationType("percentage");
      setValue("30");
      setProcedureId("");
      setInsuranceId("");
      setProcedureCode("");
      setIsInverted(false);
      setIsActive(true);
      setTiers([
        { min: 0, max: 5000, value: 30 },
        { min: 5001, max: 10000, value: 35 },
        { min: 10001, max: null, value: 40 },
      ]);
    }
  }, [rule, open]);

  const handleAddTier = () => {
    const lastTier = tiers[tiers.length - 1];
    const newMin = lastTier.max ? lastTier.max + 1 : 0;
    setTiers([...tiers, { min: newMin, max: null, value: lastTier.value + 5 }]);
  };

  const handleRemoveTier = (index: number) => {
    if (tiers.length <= 1) return;
    setTiers(tiers.filter((_, i) => i !== index));
  };

  const handleTierChange = (index: number, field: keyof TierConfig, val: string) => {
    const newTiers = [...tiers];
    if (field === "max" && val === "") {
      newTiers[index][field] = null;
    } else {
      newTiers[index][field] = Number(val) as any;
    }
    setTiers(newTiers);
  };

  const validateForm = (): boolean => {
    if (ruleType === "insurance" && !insuranceId) {
      toast.error("Selecione um convênio");
      return false;
    }
    if (ruleType === "service" && !procedureId) {
      toast.error("Selecione um procedimento");
      return false;
    }
    if (ruleType === "procedure" && !procedureCode) {
      toast.error("Selecione um procedimento TUSS");
      return false;
    }
    if (calculationType !== "tiered" && (!value || Number(value) < 0)) {
      toast.error("Informe um valor válido");
      return false;
    }
    if (calculationType === "tiered" && tiers.length === 0) {
      toast.error("Configure pelo menos uma faixa");
      return false;
    }
    // Validar sobreposição de faixas (tiers)
    if (calculationType === "tiered" && tiers.length > 1) {
      const sorted = [...tiers].sort((a, b) => a.min - b.min);
      for (let i = 1; i < sorted.length; i++) {
        const prev = sorted[i - 1];
        const curr = sorted[i];
        if (prev.max !== null && curr.min <= prev.max) {
          toast.error(`Faixa ${i + 1} sobrepõe a faixa ${i}: ${curr.min} ≤ ${prev.max}`);
          return false;
        }
      }
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!profile?.tenant_id || !validateForm()) return;

    setIsLoading(true);
    try {
      const ruleData = {
        tenant_id: profile.tenant_id,
        professional_id: professionalId,
        rule_type: ruleType,
        calculation_type: calculationType,
        value: calculationType === "tiered" ? 0 : Number(value),
        procedure_id: ruleType === "service" ? procedureId : null,
        insurance_id: ruleType === "insurance" ? insuranceId : null,
        procedure_code: ruleType === "procedure" ? procedureCode : null,
        tier_config: calculationType === "tiered" ? tiers : null,
        priority: priorityByType[ruleType] || 0,
        is_inverted: isInverted,
        is_active: isActive,
        created_by: profile.user_id,
      };

      if (rule?.id) {
        const { error } = await api
          .from("commission_rules")
          .update(ruleData)
          .eq("id", rule.id);

        if (error) throw error;
        toast.success("Regra atualizada com sucesso!");
      } else {
        const { error } = await api
          .from("commission_rules")
          .insert(ruleData);

        if (error) throw error;
        toast.success("Regra criada com sucesso!");
      }

      onSave();
      onOpenChange(false);
    } catch (error: any) {
      logger.error("Error saving commission rule:", error);
      if (error.code === "23505") {
        toast.error("Já existe uma regra ativa com esta configuração");
      } else {
        toast.error("Erro ao salvar regra");
      }
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="sm:max-w-lg overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{rule ? "Editar Regra" : "Nova Regra de Comissão"}</SheetTitle>
          <SheetDescription>
            Configurar comissão para <strong>{professionalName}</strong>
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-6 py-6">
          {/* Rule Type */}
          <div className="space-y-2">
            <Label>Tipo de Regra</Label>
            <Select value={ruleType} onValueChange={setRuleType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o tipo">
                  {ruleTypeOptions.find((o) => o.value === ruleType)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {ruleTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col items-start py-0.5">
                      <span className="font-medium leading-tight">{opt.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filter by Insurance */}
          {ruleType === "insurance" && (
            <div className="space-y-2">
              <Label>Convênio</Label>
              <Select value={insuranceId} onValueChange={setInsuranceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o convênio" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="particular">Particular (sem convênio)</SelectItem>
                  {insurances.map((ins) => (
                    <SelectItem key={ins.id} value={ins.id}>
                      {ins.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filter by Service */}
          {ruleType === "service" && (
            <div className="space-y-2">
              <Label>Procedimento</Label>
              <Select value={procedureId} onValueChange={setProcedureId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  {procedures.map((svc) => (
                    <SelectItem key={svc.id} value={svc.id}>
                      {svc.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Filter by Procedure */}
          {ruleType === "procedure" && (
            <div className="space-y-2">
              <Label>Procedimento TUSS</Label>
              <TussCombobox
                value={procedureCode}
                onChange={setProcedureCode}
                placeholder="Buscar código TUSS..."
              />
            </div>
          )}

          <Separator />

          {/* Calculation Type */}
          <div className="space-y-2">
            <Label>Tipo de Cálculo</Label>
            <Select value={calculationType} onValueChange={setCalculationType}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione o cálculo">
                  {calculationTypeOptions.find((o) => o.value === calculationType)?.label}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {calculationTypeOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div className="flex flex-col items-start py-0.5">
                      <span className="font-medium leading-tight">{opt.label}</span>
                      <span className="text-xs text-muted-foreground leading-tight">{opt.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Value (for percentage and fixed) */}
          {calculationType !== "tiered" && (
            <div className="space-y-2">
              <Label>
                {calculationType === "percentage" ? "Percentual (%)" : "Valor (R$)"}
              </Label>
              <Input
                type="number"
                min="0"
                max={calculationType === "percentage" ? "100" : undefined}
                step={calculationType === "percentage" ? "0.5" : "0.01"}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder={calculationType === "percentage" ? "Ex: 30" : "Ex: 50.00"}
              />
            </div>
          )}

          {/* Tiered Configuration */}
          {calculationType === "tiered" && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>Faixas de Comissão</Label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleAddTier}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Adicionar Faixa
                </Button>
              </div>

              <div className="space-y-3">
                {tiers.map((tier, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-2 p-3 rounded-lg border bg-muted/30"
                  >
                    <div className="flex-1 grid grid-cols-3 gap-2">
                      <div>
                        <Label className="text-xs">De (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={tier.min}
                          onChange={(e) => handleTierChange(index, "min", e.target.value)}
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Até (R$)</Label>
                        <Input
                          type="number"
                          min="0"
                          value={tier.max ?? ""}
                          onChange={(e) => handleTierChange(index, "max", e.target.value)}
                          placeholder="∞"
                          className="h-8"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">Comissão (%)</Label>
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={tier.value}
                          onChange={(e) => handleTierChange(index, "value", e.target.value)}
                          className="h-8"
                        />
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleRemoveTier(index)}
                      disabled={tiers.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-sm">
                <Info className="h-4 w-4 text-blue-600 mt-0.5 shrink-0" />
                <p className="text-blue-700 dark:text-blue-300">
                  O escalonamento é calculado com base no faturamento acumulado do profissional no mês.
                  Quanto maior o faturamento, maior a comissão.
                </p>
              </div>
            </div>
          )}

          <Separator />

          {/* Inverted Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Repasse Invertido</Label>
              <p className="text-xs text-muted-foreground">
                Profissional paga à clínica (ex: locação de sala)
              </p>
            </div>
            <Switch checked={isInverted} onCheckedChange={setIsInverted} />
          </div>

          {isInverted && (
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
              <p className="text-amber-700 dark:text-amber-300">
                Com repasse invertido, o valor será registrado como <strong>receita</strong> para a clínica,
                não como despesa. Use para cenários onde o profissional aluga o espaço.
              </p>
            </div>
          )}

          {/* Active Toggle */}
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Regra Ativa</Label>
              <p className="text-xs text-muted-foreground">
                Regras inativas não são aplicadas nos cálculos
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>

          {/* Priority Info */}
          <div className="flex items-center gap-2">
            <Badge variant="outline">Prioridade: {priorityByType[ruleType] || 0}</Badge>
            <span className="text-xs text-muted-foreground">
              (Procedimento TUSS &gt; Procedimento &gt; Convênio &gt; Padrão)
            </span>
          </div>
        </div>

        <SheetFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {rule ? "Salvar Alterações" : "Criar Regra"}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
