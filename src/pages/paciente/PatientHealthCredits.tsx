import { useQuery } from "@tanstack/react-query";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Coins, TrendingUp, Gift, Star, ArrowUp, ArrowDown, Clock } from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const TIER_CONFIG = {
  bronze: { label: "Bronze", color: "bg-amber-700 text-white", min: 0 },
  silver: { label: "Prata", color: "bg-gray-400 text-white", min: 200 },
  gold: { label: "Ouro", color: "bg-yellow-500 text-white", min: 500 },
  platinum: { label: "Platina", color: "bg-gradient-to-r from-gray-600 to-gray-800 text-white", min: 1000 },
} as const;

const TYPE_CONFIG = {
  earn: { label: "Ganho", icon: ArrowUp, color: "text-green-600" },
  redeem: { label: "Resgatado", icon: ArrowDown, color: "text-red-600" },
  expire: { label: "Expirado", icon: Clock, color: "text-gray-400" },
  adjustment: { label: "Ajuste", icon: TrendingUp, color: "text-blue-600" },
} as const;

export default function PatientHealthCredits() {
  const { data: balance, isLoading: loadingBalance } = useQuery({
    queryKey: ["patient-health-credits-balance"],
    queryFn: async () => {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return null;

      const { data: pp } = await supabasePatient
        .from("patient_profiles")
        .select("client_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!pp) return null;

      const { data } = await supabasePatient
        .from("health_credits_balance" as never)
        .select("*")
        .eq("tenant_id", pp.tenant_id)
        .eq("patient_id", pp.client_id)
        .maybeSingle();

      return (data as Record<string, unknown> | null) || {
        balance: 0,
        lifetime_earned: 0,
        lifetime_redeemed: 0,
        tier: "bronze",
      };
    },
  });

  const { data: transactions, isLoading: loadingTx } = useQuery({
    queryKey: ["patient-health-credits-transactions"],
    queryFn: async () => {
      const { data: { user } } = await supabasePatient.auth.getUser();
      if (!user) return [];

      const { data: pp } = await supabasePatient
        .from("patient_profiles")
        .select("client_id, tenant_id")
        .eq("user_id", user.id)
        .eq("is_active", true)
        .maybeSingle();
      if (!pp) return [];

      const { data } = await supabasePatient
        .from("health_credits_transactions" as never)
        .select("*")
        .eq("tenant_id", pp.tenant_id)
        .eq("patient_id", pp.client_id)
        .order("created_at", { ascending: false })
        .limit(20);

      return (data || []) as Array<{
        id: string;
        type: string;
        amount: number;
        balance_after: number;
        reason: string;
        created_at: string;
      }>;
    },
  });

  const isLoading = loadingBalance || loadingTx;
  const tier = (balance as Record<string, unknown>)?.tier as keyof typeof TIER_CONFIG || "bronze";
  const tierCfg = TIER_CONFIG[tier] || TIER_CONFIG.bronze;
  const currentBalance = Number((balance as Record<string, unknown>)?.balance) || 0;
  const lifetimeEarned = Number((balance as Record<string, unknown>)?.lifetime_earned) || 0;
  const lifetimeRedeemed = Number((balance as Record<string, unknown>)?.lifetime_redeemed) || 0;

  // Next tier progress
  const tiers = Object.entries(TIER_CONFIG);
  const currentIdx = tiers.findIndex(([k]) => k === tier);
  const nextTier = currentIdx < tiers.length - 1 ? tiers[currentIdx + 1] : null;
  const progressToNext = nextTier
    ? Math.min(100, Math.round((lifetimeEarned / nextTier[1].min) * 100))
    : 100;

  if (isLoading) {
    return (
      <PatientLayout title="Créditos de Saúde" subtitle="Seus pontos e recompensas">
        <div className="space-y-4">
          <Skeleton className="h-40 w-full rounded-xl" />
          <Skeleton className="h-32 w-full rounded-xl" />
        </div>
      </PatientLayout>
    );
  }

  return (
    <PatientLayout title="Créditos de Saúde" subtitle="Seus pontos e recompensas">
    <div className="space-y-4 max-w-lg mx-auto">
      {/* Balance card */}
      <Card className="bg-gradient-to-br from-teal-500 to-cyan-600 text-white border-0">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Coins className="h-5 w-5" />
              <span className="text-sm font-medium opacity-90">Créditos de Saúde</span>
            </div>
            <Badge className={cn("text-xs", tierCfg.color)}>
              <Star className="h-3 w-3 mr-1" />
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
        </CardContent>
      </Card>

      {/* How to earn */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Gift className="h-4 w-4 text-teal-600" /> Como ganhar pontos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <div className="flex justify-between"><span>Consulta realizada</span><Badge variant="outline" className="text-xs">+10 pts</Badge></div>
          <div className="flex justify-between"><span>Check-up preventivo</span><Badge variant="outline" className="text-xs">+20 pts</Badge></div>
          <div className="flex justify-between"><span>Vacinação em dia</span><Badge variant="outline" className="text-xs">+15 pts</Badge></div>
          <div className="flex justify-between"><span>Indicar um amigo</span><Badge variant="outline" className="text-xs">+30 pts</Badge></div>
          <div className="flex justify-between"><span>Avaliar a clínica</span><Badge variant="outline" className="text-xs">+5 pts</Badge></div>
          <div className="flex justify-between"><span>Aniversário</span><Badge variant="outline" className="text-xs">+25 pts</Badge></div>
        </CardContent>
      </Card>

      {/* Transaction history */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-teal-600" /> Extrato
          </CardTitle>
        </CardHeader>
        <CardContent>
          {!transactions?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhuma movimentação ainda.</p>
          ) : (
            <div className="space-y-2">
              {transactions.map((tx) => {
                const cfg = TYPE_CONFIG[tx.type as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.earn;
                const Icon = cfg.icon;
                const isPositive = tx.type === "earn" || (tx.type === "adjustment" && tx.amount > 0);

                return (
                  <div key={tx.id} className="flex items-center gap-3 py-2 border-b last:border-0">
                    <div className={cn("p-1.5 rounded-full bg-muted", cfg.color)}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm truncate">{tx.reason}</p>
                      <p className="text-xs text-muted-foreground">
                        {new Date(tx.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <span className={cn("text-sm font-bold", isPositive ? "text-green-600" : "text-red-600")}>
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
