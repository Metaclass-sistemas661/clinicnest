import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

export type ClientRankingItem = {
  client_id: string;
  client_name: string;
  today_total: number;
  month_total: number;
};

type DashboardClientRankingProps = {
  clientRanking: ClientRankingItem[];
  formatCurrency: (value: number) => string;
};

const podiumStyles = {
  1: {
    bg: "bg-amber-100 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700",
    badge: "bg-amber-400 text-amber-950 dark:bg-amber-500 dark:text-amber-950",
    label: "1º lugar",
    emoji: "🥇",
  },
  2: {
    bg: "bg-slate-100 dark:bg-slate-800/50 border-slate-300 dark:border-slate-600",
    badge: "bg-slate-400 text-white dark:bg-slate-500 dark:text-white",
    label: "2º lugar",
    emoji: "🥈",
  },
  3: {
    bg: "bg-amber-100/80 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800",
    badge: "bg-amber-700 text-amber-100 dark:bg-amber-800 dark:text-amber-100",
    label: "3º lugar",
    emoji: "🥉",
  },
} as const;

export const DashboardClientRanking = memo(function DashboardClientRanking({ clientRanking, formatCurrency }: DashboardClientRankingProps) {
  return (
    <Card>
      <CardHeader className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div>
          <CardTitle className="text-lg">Ranking – Clientes que mais consomem</CardTitle>
          <CardDescription>
            Gastos de hoje e do mês (atualiza automaticamente)
          </CardDescription>
        </div>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/clientes">Ver todos</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {clientRanking.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Nenhum consumo registrado neste mês
            </p>
          </div>
        ) : (
          <div className="space-y-2 md:space-y-3">
            {clientRanking.slice(0, 10).map((item, index) => {
              const rank = index + 1;
              const isPodium = rank <= 3;
              const style = isPodium ? podiumStyles[rank as 1 | 2 | 3] : null;
              return (
                <div
                  key={item.client_id}
                  className={`flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 gap-2 sm:gap-4 ${
                    style ? `${style.bg} border-2` : ""
                  }`}
                >
                  <div className="flex items-center gap-3 md:gap-4">
                    <div
                      className={`flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full font-bold text-sm shrink-0 ${
                        style ? `${style.badge}` : "bg-primary/10 text-primary"
                      }`}
                      title={style?.label}
                    >
                      {style?.emoji ?? rank}
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">
                        {item.client_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Hoje: {formatCurrency(item.today_total)} · Mês: {formatCurrency(item.month_total)}
                      </p>
                      {style && (
                        <Badge variant="outline" className="mt-1 text-xs">
                          {style.label}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="text-right self-end sm:self-auto">
                    <p className="text-base md:text-lg font-bold text-primary">
                      {formatCurrency(item.month_total)}
                    </p>
                    <p className="text-xs text-muted-foreground">total no mês</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
