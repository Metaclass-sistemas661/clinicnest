import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { logger } from "@/lib/logger";
import { TrendingUp, Award, Target, ChevronUp, Loader2, Info } from "lucide-react";
import { startOfMonth, endOfMonth } from "date-fns";

interface TierConfig {
  min: number;
  max: number | null;
  value: number;
}

interface TieredRule {
  id: string;
  tier_config: TierConfig[];
  rule_type: string;
}

interface TierIndicatorProps {
  className?: string;
  compact?: boolean;
}

export function CommissionTierIndicator({ className, compact = false }: TierIndicatorProps) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [monthlyRevenue, setMonthlyRevenue] = useState(0);
  const [tieredRule, setTieredRule] = useState<TieredRule | null>(null);

  useEffect(() => {
    if (profile?.tenant_id && profile?.id) {
      loadData();
    }
  }, [profile?.tenant_id, profile?.id]);

  const loadData = async () => {
    if (!profile?.tenant_id || !profile?.id) return;

    setIsLoading(true);
    try {
      const now = new Date();
      const monthStart = startOfMonth(now).toISOString();
      const monthEnd = endOfMonth(now).toISOString();

      // Buscar faturamento do mês
      const { data: appointments, error: aptError } = await api
        .from("appointments")
        .select("price")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.id)
        .eq("status", "completed")
        .gte("scheduled_at", monthStart)
        .lte("scheduled_at", monthEnd);

      if (aptError) throw aptError;

      const revenue = (appointments || []).reduce((sum, apt) => sum + (apt.price || 0), 0);
      setMonthlyRevenue(revenue);

      // Buscar regra escalonada do profissional
      const { data: rules, error: rulesError } = await api
        .from("commission_rules")
        .select("id, tier_config, rule_type")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", profile.id)
        .eq("calculation_type", "tiered")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(1);

      if (rulesError) throw rulesError;

      if (rules && rules.length > 0) {
        setTieredRule(rules[0] as TieredRule);
      }
    } catch (error) {
      logger.error("Error loading tier data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const tierInfo = useMemo(() => {
    if (!tieredRule?.tier_config) return null;

    const tiers = tieredRule.tier_config;
    let currentTier: TierConfig | null = null;
    let currentTierIndex = 0;
    let nextTier: TierConfig | null = null;

    for (let i = 0; i < tiers.length; i++) {
      const tier = tiers[i];
      if (monthlyRevenue >= tier.min && (tier.max === null || monthlyRevenue <= tier.max)) {
        currentTier = tier;
        currentTierIndex = i;
        nextTier = tiers[i + 1] || null;
        break;
      }
    }

    if (!currentTier && tiers.length > 0) {
      currentTier = tiers[0];
      nextTier = tiers[1] || null;
    }

    if (!currentTier) return null;

    const progressToNext = nextTier
      ? Math.min(100, ((monthlyRevenue - currentTier.min) / (nextTier.min - currentTier.min)) * 100)
      : 100;

    const amountToNext = nextTier ? nextTier.min - monthlyRevenue : 0;

    return {
      currentTier,
      currentTierIndex,
      nextTier,
      progressToNext,
      amountToNext,
      totalTiers: tiers.length,
      isMaxTier: !nextTier,
    };
  }, [tieredRule, monthlyRevenue]);

  if (isLoading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <Spinner size="sm" className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  if (!tieredRule || !tierInfo) {
    return null;
  }

  if (compact) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={`flex items-center gap-2 p-2 rounded-lg bg-gradient-to-r from-cyan-500/10 to-teal-500/10 border border-cyan-500/20 ${className}`}>
              <div className="p-1.5 rounded-full bg-cyan-500/20">
                <TrendingUp className="h-4 w-4 text-cyan-600 dark:text-cyan-400" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-semibold text-cyan-700 dark:text-cyan-300">
                    {tierInfo.currentTier.value}%
                  </span>
                  {tierInfo.isMaxTier && (
                    <Award className="h-3.5 w-3.5 text-yellow-500" />
                  )}
                </div>
                <Progress value={tierInfo.progressToNext} className="h-1.5 mt-1" />
              </div>
              {!tierInfo.isMaxTier && tierInfo.nextTier && (
                <div className="text-xs text-muted-foreground">
                  <ChevronUp className="h-3 w-3 inline" />
                  {tierInfo.nextTier.value}%
                </div>
              )}
            </div>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="max-w-xs">
            <div className="space-y-1">
              <p className="font-medium">Faixa de Comissão Atual: {tierInfo.currentTier.value}%</p>
              <p className="text-xs text-muted-foreground">
                Faturamento: {formatCurrency(monthlyRevenue)}
              </p>
              {!tierInfo.isMaxTier && tierInfo.nextTier && (
                <p className="text-xs text-muted-foreground">
                  Faltam {formatCurrency(tierInfo.amountToNext)} para {tierInfo.nextTier.value}%
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-cyan-600" />
          Faixa de Comissão
          {tierInfo.isMaxTier && (
            <Badge variant="outline" className="ml-auto bg-warning/10 text-warning border-warning/20">
              <Award className="h-3 w-3 mr-1" />
              Faixa Máxima
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Tier Display */}
        <div className="flex items-center justify-between">
          <div>
            <p className="text-3xl font-bold text-cyan-600 dark:text-cyan-400">
              {tierInfo.currentTier.value}%
            </p>
            <p className="text-sm text-muted-foreground">
              Comissão atual
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold">{formatCurrency(monthlyRevenue)}</p>
            <p className="text-sm text-muted-foreground">Faturamento do mês</p>
          </div>
        </div>

        {/* Progress to Next Tier */}
        {!tierInfo.isMaxTier && tierInfo.nextTier && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Progresso para próxima faixa</span>
              <span className="font-medium">{tierInfo.nextTier.value}%</span>
            </div>
            <Progress value={tierInfo.progressToNext} className="h-2" />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{formatCurrency(tierInfo.currentTier.min)}</span>
              <span className="flex items-center gap-1">
                <Target className="h-3 w-3" />
                Faltam {formatCurrency(tierInfo.amountToNext)}
              </span>
              <span>{formatCurrency(tierInfo.nextTier.min)}</span>
            </div>
          </div>
        )}

        {/* All Tiers Overview */}
        <div className="pt-2 border-t">
          <div className="flex items-center gap-1 mb-2">
            <Info className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">Todas as faixas</span>
          </div>
          <div className="flex gap-1">
            {tieredRule.tier_config.map((tier, idx) => (
              <TooltipProvider key={idx}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div
                      className={`flex-1 h-8 rounded flex items-center justify-center text-xs font-medium transition-colors ${
                        idx === tierInfo.currentTierIndex
                          ? "bg-cyan-500 text-white"
                          : idx < tierInfo.currentTierIndex
                          ? "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/50 dark:text-cyan-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {tier.value}%
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {formatCurrency(tier.min)} - {tier.max ? formatCurrency(tier.max) : "∞"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
