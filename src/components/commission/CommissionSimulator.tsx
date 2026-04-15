import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { TussCombobox } from "@/components/ui/tuss-combobox";
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { logger } from "@/lib/logger";
import {
  Calculator,
  ArrowRight,
  CheckCircle2,
  Info,
  Loader2,
} from "lucide-react";
import type { CommissionRule } from "./CommissionRuleCard";

interface ProcedureOption {
  id: string;
  name: string;
  price: number;
}

interface Insurance {
  id: string;
  name: string;
}

interface CommissionSimulatorProps {
  professionalId: string;
  rules: CommissionRule[];
}

export function CommissionSimulator({ professionalId, rules }: CommissionSimulatorProps) {
  const { profile } = useAuth();
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);
  const [insurances, setInsurances] = useState<Insurance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Simulation inputs
  const [selectedProcedureId, setSelectedProcedureId] = useState<string>("");
  const [selectedInsuranceId, setSelectedInsuranceId] = useState<string>("particular");
  const [procedureCode, setProcedureCode] = useState<string>("");
  const [procedureValue, setProcedureValue] = useState<string>("");
  const [monthlyRevenue, setMonthlyRevenue] = useState<string>("0");

  // Simulation result
  const [result, setResult] = useState<{
    appliedRule: CommissionRule | null;
    commissionValue: number;
    isInverted: boolean;
  } | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id) return;

    const loadData = async () => {
      try {
        const [proceduresRes, insurancesRes] = await Promise.all([
          api
            .from("procedures")
            .select("id, name, price")
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
        logger.error("Error loading simulator data:", error);
      }
    };

    loadData();
  }, [profile?.tenant_id]);

  // Auto-fill service value when service is selected
  useEffect(() => {
    if (selectedProcedureId) {
      const procedure = procedures.find((s) => s.id === selectedProcedureId);
      if (procedure) {
        setProcedureValue(String(procedure.price));
      }
    }
  }, [selectedProcedureId, procedures]);

  const findApplicableRule = (): CommissionRule | null => {
    const activeRules = rules.filter((r) => r.is_active);
    
    // Sort by priority (highest first)
    const sortedRules = [...activeRules].sort((a, b) => b.priority - a.priority);

    for (const rule of sortedRules) {
      // Check procedure/TUSS rules (highest priority)
      if (rule.rule_type === "procedure" && rule.procedure_code) {
        if (procedureCode && rule.procedure_code === procedureCode) {
          return rule;
        }
        continue;
      }

      // Check service rules
      if (rule.rule_type === "service" && rule.procedure_id === selectedProcedureId) {
        return rule;
      }

      // Check insurance rules
      if (rule.rule_type === "insurance") {
        if (selectedInsuranceId === "particular" && rule.insurance_id === "particular") {
          return rule;
        }
        if (rule.insurance_id === selectedInsuranceId) {
          return rule;
        }
      }

      // Default rule (lowest priority)
      if (rule.rule_type === "default") {
        return rule;
      }
    }

    return null;
  };

  const calculateCommission = (rule: CommissionRule, value: number): number => {
    if (rule.calculation_type === "percentage") {
      return (value * rule.value) / 100;
    }

    if (rule.calculation_type === "fixed") {
      return rule.value;
    }

    if (rule.calculation_type === "tiered" && rule.tier_config) {
      const revenue = Number(monthlyRevenue) || 0;
      
      // Find applicable tier based on monthly revenue
      for (const tier of rule.tier_config) {
        const max = tier.max ?? Infinity;
        if (revenue >= tier.min && revenue <= max) {
          return (value * tier.value) / 100;
        }
      }

      // If no tier matches, use the last tier
      const lastTier = rule.tier_config[rule.tier_config.length - 1];
      return (value * lastTier.value) / 100;
    }

    return 0;
  };

  const handleSimulate = () => {
    setIsLoading(true);

    setTimeout(() => {
      const value = Number(procedureValue) || 0;
      const appliedRule = findApplicableRule();

      if (appliedRule) {
        const commissionValue = calculateCommission(appliedRule, value);
        setResult({
          appliedRule,
          commissionValue,
          isInverted: appliedRule.is_inverted,
        });
      } else {
        setResult({
          appliedRule: null,
          commissionValue: 0,
          isInverted: false,
        });
      }

      setIsLoading(false);
    }, 300);
  };

  const getRuleTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      default: "Padrão",
      service: "Por Procedimento",
      insurance: "Por Convênio",
      procedure: "Por Código TUSS",
      referral: "Por Captação",
      sale: "Por Venda",
    };
    return labels[type] || type;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Calculator className="h-5 w-5" />
          Simulador de Comissão
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Procedure Select */}
          <div className="space-y-2">
            <Label>Procedimento</Label>
            <Select value={selectedProcedureId} onValueChange={setSelectedProcedureId}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um procedimento" />
              </SelectTrigger>
              <SelectContent>
                {procedures.map((svc) => (
                  <SelectItem key={svc.id} value={svc.id}>
                    {svc.name} - {formatCurrency(svc.price)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Insurance Select */}
          <div className="space-y-2">
            <Label>Convênio</Label>
            <Select value={selectedInsuranceId} onValueChange={setSelectedInsuranceId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="particular">Particular</SelectItem>
                {insurances.map((ins) => (
                  <SelectItem key={ins.id} value={ins.id}>
                    {ins.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* TUSS Code (optional, for procedure rules) */}
          <div className="space-y-2">
            <Label>Código TUSS (opcional)</Label>
            <TussCombobox
              value={procedureCode}
              onChange={setProcedureCode}
              placeholder="Buscar código TUSS..."
            />
            <p className="text-xs text-muted-foreground">
              Usado para testar regras por código TUSS
            </p>
          </div>

          {/* Service Value */}
          <div className="space-y-2">
            <Label>Valor do Procedimento (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={procedureValue}
              onChange={(e) => setProcedureValue(e.target.value)}
              placeholder="0.00"
            />
          </div>

          {/* Monthly Revenue (for tiered) */}
          <div className="space-y-2">
            <Label>Faturamento do Mês (R$)</Label>
            <Input
              type="number"
              min="0"
              step="0.01"
              value={monthlyRevenue}
              onChange={(e) => setMonthlyRevenue(e.target.value)}
              placeholder="0.00"
            />
            <p className="text-xs text-muted-foreground">
              Usado para cálculo escalonado
            </p>
          </div>
        </div>

        <Button
          onClick={handleSimulate}
          disabled={!selectedProcedureId || !procedureValue || isLoading}
          className="w-full"
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Calculator className="mr-2 h-4 w-4" />
          )}
          Simular Comissão
        </Button>

        {/* Result */}
        {result && (
          <>
            <Separator />

            <div className="space-y-4">
              {result.appliedRule ? (
                <>
                  <div className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-green-600" />
                    <span>Regra aplicada:</span>
                    <Badge variant="outline">
                      {getRuleTypeLabel(result.appliedRule.rule_type)}
                    </Badge>
                    {result.appliedRule.calculation_type === "percentage" && (
                      <span className="text-muted-foreground">
                        ({result.appliedRule.value}%)
                      </span>
                    )}
                    {result.appliedRule.calculation_type === "fixed" && (
                      <span className="text-muted-foreground">
                        ({formatCurrency(result.appliedRule.value)} fixo)
                      </span>
                    )}
                    {result.appliedRule.calculation_type === "tiered" && (
                      <span className="text-muted-foreground">(escalonado)</span>
                    )}
                  </div>

                  <div className="flex items-center justify-between p-4 rounded-lg bg-primary/10">
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Valor do Procedimento
                      </span>
                      <span className="font-semibold">
                        {formatCurrency(Number(procedureValue))}
                      </span>
                    </div>
                    <ArrowRight className="h-5 w-5 text-muted-foreground" />
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        {result.isInverted ? "Receita (invertido)" : "Comissão"}
                      </span>
                      <span
                        className={`text-2xl font-bold ${
                          result.isInverted ? "text-green-600" : "text-primary"
                        }`}
                      >
                        {formatCurrency(result.commissionValue)}
                      </span>
                    </div>
                  </div>

                  {result.isInverted && (
                    <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 text-sm">
                      <Info className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                      <p className="text-amber-700 dark:text-amber-300">
                        Esta regra é de repasse invertido. O valor será registrado como
                        receita para a clínica.
                      </p>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-start gap-2 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 text-sm">
                  <Info className="h-4 w-4 text-red-600 mt-0.5 shrink-0" />
                  <p className="text-red-700 dark:text-red-300">
                    Nenhuma regra de comissão encontrada para esta combinação.
                    Crie uma regra padrão para garantir que todas as situações sejam cobertas.
                  </p>
                </div>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
