import { useQuery } from "@tanstack/react-query";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, TrendingUp, Gift, Star, ArrowUp, ArrowDown, Clock, Shield, Award, Sparkles } from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { cn } from "@/lib/utils";

const TIER_CONFIG = {
  bronze: { label: "Bronze", color: "bg-amber-700 text-white", icon: Shield, min: 0 },
  silver: { label: "Prata", color: "bg-gray-400 text-white", icon: Award, min: 200 },
  gold: { label: "Ouro", color: "bg-yellow-500 text-white", icon: Star, min: 500 },
  platinum: { label: "Platina", color: "bg-gradient-to-r from-gray-600 to-gray-800 text-white", icon: Sparkles, min: 1000 },
} as const;

const TYPE_CONFIG = {
  earn: { label: "Ganho", icon: ArrowUp, color: "text-green-600" },
  redeem: { label: "Resgatado", icon: ArrowDown, color: "text-red-600" },
  expire: { label: "Expirado", icon: Clock, color: "text-gray-400" },
  adjustment: { label: "Ajuste", icon: TrendingUp, color: "text-blue-600" },
} as const;

const TRIGGER_LABELS: Record<string, string> = {
  appointment_completed: "Consulta realizada",
  referral: "Indicação de amigo",
  birthday: "Aniversário",
  streak: "Sequência de visitas",
  review: "Avaliação do atendimento",
  vaccine: "Vacinação em dia",
  checkup: "Check-up preventivo",
};

interface RuleRow {
  name: string;
  trigger_type: string;
  points: number;
  is_active: boolean;
}

interface RedemptionCfg {
  credits_per_real: number;
  min_redeem: number;
  max_discount_percent: number;
  is_active: boolean;
}

function usePatientProfile() {
  return useQuery({
    queryKey: ["patient-profile-for-credits"],
    queryFn: async () => {
      const { data: { user } } = await apiPatient.auth.getUser();
      if (!user) return null;
      const { data: pp } = await apiPatient
        .from("patient_profiles")
        .select("client_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      return pp;
    },
    staleTime: 60_000,
  });
}

export default function PatientHealthCredits() {
  const { data: pp } = usePatientProfile();

  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ["patient-health-credits-balance", pp?.tenant_id, pp?.client_id],
    enabled: !!pp,
    queryFn: async () => {
      const { data } = await apiPatient
        .from("health_credits_balance" as never)
        .select("*")
        .eq("tenant_id", pp!.tenant_id)
        .eq("patient_id", pp!.client_id)
        .maybeSingle();
      return (data as Record<string, unknown> | null) || {
        balance: 0, lifetime_earned: 0, lifetime_redeemed: 0, tier: "bronze",
      };
    },
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["patient-health-credits-transactions", pp?.tenant_id, pp?.client_id],
    enabled: !!pp,
    queryFn: async () => {
      const { data } = await apiPatient
        .from("health_credits_transactions" as never)
        .select("*")
        .eq("tenant_id", pp!.tenant_id)
        .eq("patient_id", pp!.client_id)
        .order("created_at", { ascending: false })
        .limit(30);
      return (data || []) as Array<{
        id: string; type: string; amount: number; balance_after: number;
        reason: string; created_at: string; expires_at: string | null;
      }>;
    },
  });

  // Regras ativas do tenant (dinâmicas)
  const { data: rules } = useQuery({
    queryKey: ["patient-health-credits-rules", pp?.tenant_id],
    enabled: !!pp,
    queryFn: async () => {
      const { data } = await apiPatient
        .from("health_credits_rules" as never)
        .select("name, trigger_type, points, is_active")
        .eq("tenant_id", pp!.tenant_id)
        .eq("is_active", true)
        .order("points", { ascending: false });
      return (data || []) as RuleRow[];
    },
  });

  // Config de resgate do tenant
  const { data: redeemCfg } = useQuery({
    queryKey: ["patient-credits-redeem-config", pp?.tenant_id],
    enabled: !!pp,
    queryFn: async () => {
      const { data } = await apiPatient
        .from("health_credits_redemption_config" as never)
        .select("credits_per_real, min_redeem, max_discount_percent, is_active")
        .eq("tenant_id", pp!.tenant_id)
        .maybeSingle();
      return data as RedemptionCfg | null;
    },
  });

  const isLoading = loadingBalance || loadingTx;
  const tier = (balance as Record<string, unknown>)?.tier as keyof typeof TIER_CONFIG || "bronze";
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const TierIcon = tierCfg.icon;
  const currentBalance = Number((balance as Record<string, unknown>)?.balance) || 0;
  const lifetimeEarned = Number((balance as Record<string, unknown>)?.lifetime_earned) || 0;
  const lifetimeRedeemed = Number((balance as Record<string, unknown>)?.lifetime_redeemed) || 0;

  const tiers = Object.entries(TIER_CONFIG);
  const currentIdx = tiers.findIndex(([k]) => k === tier);
  const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;
  const progressToNext = nextTier
    ? Math.min(100, Math.round((lifetimeEarned / nextTier[1].min) * 100))
    : 100;

  if (isLoading) {
    return (
      <PatientLayout title="Créditos de Saúde" subtitle="Programa de fidelidade">
        <div className="space-y-4 max-w-lg mx-auto">
          <Skeleton className="h-48 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout title="Créditos de Saúde" subtitle="Programa de fidelidade">
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Balance card */}
      <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-0 shadow-lg">
        <CardContent className="pt-6 pb-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">Créditos de Saúde</span>
            </div>
            <Badge className={cn("text-xs", tierCfg.color)}>
              <TierIcon className="h-3 w-3 mr-1" />
              {tierCfg.label}
            </Badge>
          </div>

          <div className="text-4xl font-bold mb-1">
            {currentBalance.toLocaleString("pt-BR")}
          </div>
          <p className="text-xs opacity-75">pontos disponíveis</p>

          <div className="grid grid-cols-2 gap-3 mt-4 pt-3 border-t border-white/20">
            <div>
              <p className="text-xs opacity-75">Total ganho</p>
              <p className="font-semibold">{lifetimeEarned.toLocaleString("pt-BR")}</p>
            </div>
            <div>
              <p className="text-xs opacity-75">Total resgatado</p>
              <p className="font-semibold">{lifetimeRedeemed.toLocaleString("pt-BR")}</p>
            </div>
          </div>

          {/* Progress to next tier */}
          {nextTier && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-xs opacity-75 mb-1">
                <span>Próximo nível: {(TIER_CONFIG as Record<string, { label: string }>)[nextTier[0]]?.label}</span>
                <span>{progressToNext}%</span>
              </div>
              <div className="h-1.5 bg-white/20 rounded-full overflow-hidden">
                <div className="h-full bg-white rounded-full transition-all" style={{ width: `${progressToNext}%` }} />
              </div>
            </div>
          )}

          {/* Redeem info */}
          {redeemCfg?.is_active && currentBalance >= (redeemCfg.min_redeem ?? 50) && (
            <div className="mt-4 rounded-lg bg-white/15 p-3">
              <p className="text-xs font-medium">
                Você pode converter seus créditos em desconto!
                {" "}{redeemCfg.credits_per_real} pts = R$ 1,00 (até {redeemCfg.max_discount_percent}% do valor).
                Solicite na recepção.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tier levels */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Award className="h-4 w-4 text-teal-600" /> Níveis de Fidelidade
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-2">
            {tiers.map(([key, cfg]) => {
              const active = key === tier;
              const Icon = cfg.icon;
              return (
                <div key={key} className={cn(
                  "flex flex-col items-center gap-1 rounded-lg p-2 text-center transition-all",
                  active ? "bg-teal-50 ring-2 ring-teal-500" : "opacity-60"
                )}>
                  <Icon className={cn("h-5 w-5", active ? "text-teal-600" : "text-muted-foreground")} />
                  <span className="text-xs font-medium">{cfg.label}</span>
                  <span className="text-[10px] text-muted-foreground">{cfg.min}+ pts</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* How to earn — dynamic from tenant rules */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Gift className="h-4 w-4 text-teal-600" /> Como ganhar pontos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          {rules?.length ? (
            rules.map((r) => (
              <div key={r.trigger_type + r.name} className="flex justify-between items-center">
                <span>{TRIGGER_LABELS[r.trigger_type] ?? r.name}</span>
                <Badge variant="outline" className="text-xs font-semibold">+{r.points} pts</Badge>
              </div>
            ))
          ) : (
            <>
              <div className="flex justify-between"><span>Consulta realizada</span><Badge variant="outline" className="text-xs">+10 pts</Badge></div>
              <div className="flex justify-between"><span>Avaliar o atendimento</span><Badge variant="outline" className="text-xs">+5 pts</Badge></div>
              <div className="flex justify-between"><span>Aniversário</span><Badge variant="outline" className="text-xs">+25 pts</Badge></div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Redemption info */}
      {redeemCfg?.is_active && (
        <Card className="border-teal-200 bg-teal-50/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Coins className="h-4 w-4 text-teal-600" /> Como usar seus créditos
            </CardTitle>
          </CardHeader>
          <CardContent className="text-xs text-muted-foreground space-y-2">
            <p>Troque seus créditos por desconto na próxima consulta ou procedimento:</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border bg-white p-2 text-center">
                <p className="font-bold text-lg text-teal-700">{redeemCfg.credits_per_real}</p>
                <p className="text-[10px]">créditos = R$ 1</p>
              </div>
              <div className="rounded-lg border bg-white p-2 text-center">
                <p className="font-bold text-lg text-teal-700">{redeemCfg.min_redeem}</p>
                <p className="text-[10px]">mínimo p/ resgatar</p>
              </div>
            </div>
            <p className="text-[10px] italic">Desconto máximo de {redeemCfg.max_discount_percent}% do valor. Solicite na recepção ao agendar.</p>
          </CardContent>
        </Card>
      )}

      {/* Transaction history */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" /> Extrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <div className="text-center py-8">
              <Coins className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">Nenhuma movimentação ainda</p>
              <p className="text-xs text-muted-foreground mt-1">Seus créditos aparecerão aqui após a primeira consulta</p>
            </div>
          ) : (
            <div className="space-y-1">
              {transactions.map((tx) => {
                const cfg = TYPE_CONFIG[tx.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.earn;
                const Icon = cfg.icon;
                const isPositive = tx.type === "earn" || (tx.type === "adjustment" && tx.amount > 0);

                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2.5 border-b last:border-0">
                    <div className={cn("p-1.5 rounded-full bg-muted", cfg.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{tx.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                        {tx.expires_at && (
                          <span className="ml-1 text-amber-500">
                            · expira {new Date(tx.expires_at).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </p>
                    </div>
                    <span className={cn("text-sm font-bold tabular-nums", isPositive ? "text-green-600" : "text-red-600")}>
                      {isPositive ? "+" : ""}{tx.amount}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
    </PatientLayout>
  );
}
