import { useState, useEffect } from "react";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { logger } from "@/lib/logger";
import {
  Wallet,
  Percent,
  DollarSign,
  TrendingUp,
  ArrowDownUp,
  Info,
} from "lucide-react";

interface CommissionRule {
  id: string;
  rule_type: "default" | "service" | "insurance" | "procedure" | "sale" | "referral";
  calculation_type: "percentage" | "fixed" | "tiered";
  value: number;
  tier_config: { min: number; max: number | null; value: number }[] | null;
  is_inverted: boolean;
  procedure?: { name: string } | null;
  insurance?: { name: string } | null;
  procedure_code?: string | null;
}

interface CommissionPreviewProps {
  tenantId: string;
  professionalId: string;
  procedureId?: string | null;
  insuranceId?: string | null;
  procedureValue?: number;
  children: React.ReactNode;
}

const ruleTypeLabels: Record<string, string> = {
  default: "Padrão",
  service: "Por Procedimento",
  insurance: "Por Convênio",
  procedure: "Por Procedimento",
  sale: "Por Venda",
};

export function CommissionPreview({
  tenantId,
  professionalId,
  procedureId,
  insuranceId,
  procedureValue,
  children,
}: CommissionPreviewProps) {
  const [rule, setRule] = useState<CommissionRule | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [calculatedValue, setCalculatedValue] = useState<number | null>(null);

  useEffect(() => {
    if (!tenantId || !professionalId) return;

    const fetchApplicableRule = async () => {
      setIsLoading(true);
      try {
        // Fetch all active rules for this professional
        const { data: rules, error } = await supabase
          .from("commission_rules")
          .select(`
            id,
            rule_type,
            calculation_type,
            value,
            tier_config,
            is_inverted,
            procedure_id,
            insurance_id,
            procedure_code,
            priority,
            procedure:procedures(name),
            insurance:insurance_plans(name)
          `)
          .eq("tenant_id", tenantId)
          .eq("professional_id", professionalId)
          .eq("is_active", true)
          .order("priority", { ascending: false });

        if (error) throw error;

        if (!rules || rules.length === 0) {
          setRule(null);
          return;
        }

        // Find the most applicable rule based on priority
        let applicableRule: CommissionRule | null = null;

        for (const r of rules) {
          // Service-specific rule
          if (r.rule_type === "service" && r.procedure_id === procedureId) {
            applicableRule = r as CommissionRule;
            break;
          }

          // Insurance-specific rule
          if (r.rule_type === "insurance" && r.insurance_id === insuranceId) {
            applicableRule = r as CommissionRule;
            break;
          }

          // Default rule (fallback)
          if (r.rule_type === "default" && !applicableRule) {
            applicableRule = r as CommissionRule;
          }
        }

        setRule(applicableRule);

        // Calculate commission value if service value is provided
        if (applicableRule && procedureValue && procedureValue > 0) {
          let commission = 0;

          if (applicableRule.calculation_type === "percentage") {
            commission = (procedureValue * applicableRule.value) / 100;
          } else if (applicableRule.calculation_type === "fixed") {
            commission = applicableRule.value;
          } else if (applicableRule.calculation_type === "tiered" && applicableRule.tier_config) {
            // For tiered, use the first tier as preview (actual calculation needs monthly revenue)
            const firstTier = applicableRule.tier_config[0];
            commission = (procedureValue * firstTier.value) / 100;
          }

          setCalculatedValue(commission);
        } else {
          setCalculatedValue(null);
        }
      } catch (error) {
        logger.error("Error fetching commission rule:", error);
        setRule(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchApplicableRule();
  }, [tenantId, professionalId, procedureId, insuranceId, procedureValue]);

  const getValueDisplay = () => {
    if (!rule) return null;

    if (rule.calculation_type === "percentage") {
      return `${rule.value}%`;
    }

    if (rule.calculation_type === "fixed") {
      return formatCurrency(rule.value);
    }

    if (rule.calculation_type === "tiered" && rule.tier_config) {
      const minValue = Math.min(...rule.tier_config.map((t) => t.value));
      const maxValue = Math.max(...rule.tier_config.map((t) => t.value));
      return `${minValue}% - ${maxValue}%`;
    }

    return null;
  };

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>{children}</TooltipTrigger>
        <TooltipContent side="top" className="max-w-xs p-3">
          {isLoading ? (
            <div className="flex items-center gap-2 text-sm">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="flex items-center gap-2"><Spinner size="sm" />Carregando...</span>
            </div>
          ) : rule ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Wallet className="h-4 w-4 text-primary" />
                <span className="font-medium">Comissão</span>
              </div>

              <div className="flex items-center gap-2 text-sm">
                <Badge variant="outline" className="text-xs">
                  {ruleTypeLabels[rule.rule_type]}
                </Badge>
                {rule.is_inverted && (
                  <Badge variant="destructive" className="text-xs gap-1">
                    <ArrowDownUp className="h-3 w-3" />
                    Invertido
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {rule.calculation_type === "percentage" && (
                  <Percent className="h-4 w-4 text-muted-foreground" />
                )}
                {rule.calculation_type === "fixed" && (
                  <DollarSign className="h-4 w-4 text-muted-foreground" />
                )}
                {rule.calculation_type === "tiered" && (
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                )}
                <span className="text-lg font-bold text-primary">
                  {getValueDisplay()}
                </span>
              </div>

              {calculatedValue !== null && (
                <div className="pt-1 border-t text-sm">
                  <span className="text-muted-foreground">Estimativa: </span>
                  <span className="font-semibold text-green-600">
                    {formatCurrency(calculatedValue)}
                  </span>
                </div>
              )}

              {rule.rule_type === "service" && rule.procedure?.name && (
                <p className="text-xs text-muted-foreground">
                  Procedimento: {rule.procedure.name}
                </p>
              )}

              {rule.rule_type === "insurance" && rule.insurance?.name && (
                <p className="text-xs text-muted-foreground">
                  Convênio: {rule.insurance.name}
                </p>
              )}
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="h-4 w-4" />
              <span>Sem regra de comissão configurada</span>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
