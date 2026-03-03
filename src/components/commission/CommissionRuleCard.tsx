import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  Percent,
  DollarSign,
  TrendingUp,
  Building2,
  Stethoscope,
  FileText,
  MoreVertical,
  Pencil,
  Trash2,
  ArrowDownUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export interface CommissionRule {
  id: string;
  tenant_id: string;
  professional_id: string;
  rule_type: "default" | "service" | "insurance" | "procedure" | "sale" | "referral";
  procedure_id: string | null;
  insurance_id: string | null;
  procedure_code: string | null;
  calculation_type: "percentage" | "fixed" | "tiered";
  value: number;
  tier_config: { min: number; max: number | null; value: number }[] | null;
  priority: number;
  is_inverted: boolean;
  is_active: boolean;
  created_at: string;
  procedure?: { name: string } | null;
  insurance?: { name: string } | null;
}

interface CommissionRuleCardProps {
  rule: CommissionRule;
  onEdit: (rule: CommissionRule) => void;
  onDelete: (rule: CommissionRule) => void;
  onToggleActive: (rule: CommissionRule, active: boolean) => void;
}

const ruleTypeConfig = {
  default: {
    label: "Padrão",
    icon: DollarSign,
    color: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    description: "Aplicada quando nenhuma regra específica se aplica",
  },
  insurance: {
    label: "Por Convênio",
    icon: Building2,
    color: "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
    description: "Aplicada para atendimentos de um convênio específico",
  },
  service: {
    label: "Por Serviço",
    icon: Stethoscope,
    color: "bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300",
    description: "Aplicada para um serviço específico",
  },
  procedure: {
    label: "Por Procedimento",
    icon: FileText,
    color: "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
    description: "Aplicada para um código TUSS específico",
  },
  referral: {
    label: "Por Captação",
    icon: TrendingUp,
    color: "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
    description: "Comissão para quem agendou ou indicou o paciente",
  },
  sale: {
    label: "Por Venda",
    icon: TrendingUp,
    color: "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300",
    description: "Comissão para quem vendeu o serviço",
  },
};

const calculationTypeLabels = {
  percentage: "Percentual",
  fixed: "Valor Fixo",
  tiered: "Escalonado",
};

export function CommissionRuleCard({
  rule,
  onEdit,
  onDelete,
  onToggleActive,
}: CommissionRuleCardProps) {
  const config = ruleTypeConfig[rule.rule_type];
  const Icon = config.icon;

  const getFilterLabel = () => {
    switch (rule.rule_type) {
      case "insurance":
        return rule.insurance?.name || "Convênio não encontrado";
      case "service":
        return rule.procedure?.name || "Procedimento não encontrado";
      case "procedure":
        return `TUSS: ${rule.procedure_code}`;
      case "referral":
        return "Captação/Indicação";
      default:
        return null;
    }
  };

  const getValueDisplay = () => {
    if (rule.calculation_type === "tiered" && rule.tier_config) {
      return (
        <div className="space-y-1">
          {rule.tier_config.map((tier, idx) => (
            <div key={idx} className="text-xs text-muted-foreground">
              {formatCurrency(tier.min)} - {tier.max ? formatCurrency(tier.max) : "∞"}: {tier.value}%
            </div>
          ))}
        </div>
      );
    }

    if (rule.calculation_type === "percentage") {
      return (
        <span className="text-2xl font-bold text-primary">
          {rule.value}%
        </span>
      );
    }

    return (
      <span className="text-2xl font-bold text-primary">
        {formatCurrency(rule.value)}
      </span>
    );
  };

  const filterLabel = getFilterLabel();

  return (
    <Card
      className={cn(
        "transition-all hover:shadow-md",
        !rule.is_active && "opacity-60"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div
              className={cn(
                "flex h-10 w-10 shrink-0 items-center justify-center rounded-lg",
                config.color
              )}
            >
              <Icon className="h-5 w-5" />
            </div>

            <div className="flex-1 min-w-0 space-y-1">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={config.color}>
                  {config.label}
                </Badge>
                <Badge variant="secondary">
                  {calculationTypeLabels[rule.calculation_type]}
                </Badge>
                {rule.is_inverted && (
                  <Badge variant="destructive" className="gap-1">
                    <ArrowDownUp className="h-3 w-3" />
                    Invertido
                  </Badge>
                )}
                <Badge variant="outline" className="text-xs">
                  Prioridade: {rule.priority}
                </Badge>
              </div>

              {filterLabel && (
                <p className="text-sm font-medium truncate">{filterLabel}</p>
              )}

              <p className="text-xs text-muted-foreground">{config.description}</p>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Switch
                checked={rule.is_active}
                onCheckedChange={(checked) => onToggleActive(rule, checked)}
                aria-label="Ativar/desativar regra"
              />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-8 w-8">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onEdit(rule)}>
                    <Pencil className="mr-2 h-4 w-4" />
                    Editar
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() => onDelete(rule)}
                    className="text-destructive focus:text-destructive"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            <div className="text-right">{getValueDisplay()}</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
