import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DollarSign, TrendingUp, TrendingDown, Plus, ArrowUpRight, ArrowDownRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { SidebarPreview } from "./SidebarPreview";

export function FinanceiroPreview() {
  return (
    <div className="relative dark min-h-full flex" style={{ backgroundColor: "hsl(250 25% 7%)", color: "hsl(250 15% 95%)" }}>
      {/* Sidebar */}
      <SidebarPreview activePage="financeiro" />
      
      <div className="flex-1 ml-72 rounded-2xl overflow-hidden min-h-full" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <DollarSign className="h-5 w-5 text-white" />
            <h3 className="text-white font-semibold text-sm">Financeiro</h3>
          </div>
          <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
            <Plus className="h-4 w-4 mr-1" />
            Nova Transação
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-6">
            <div className="dark">
              <StatCard
                title="Saldo do Mês"
                value="R$ 12.450,00"
                icon={DollarSign}
                variant="success"
              />
            </div>
            <div className="dark">
              <StatCard
                title="Receitas"
                value="R$ 18.500,00"
                icon={TrendingUp}
                variant="success"
              />
            </div>
            <div className="dark">
              <StatCard
                title="Despesas"
                value="R$ 6.050,00"
                icon={TrendingDown}
                variant="danger"
              />
            </div>
            <div className="dark">
              <StatCard
                title="Lucro"
                value="R$ 12.450,00"
                icon={DollarSign}
                variant="success"
              />
            </div>
          </div>

          {/* Transactions List */}
          <Card className="border-border" style={{ backgroundColor: "hsl(250 25% 10%)" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Últimas Transações</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { type: "income", description: "Serviço - Corte + Escova", amount: "R$ 120,00", date: "Hoje, 09:00" },
                  { type: "expense", description: "Compra de produtos", amount: "R$ 350,00", date: "Hoje, 08:30" },
                  { type: "income", description: "Venda de produto", amount: "R$ 85,00", date: "Ontem, 16:00" },
                  { type: "income", description: "Serviço - Coloração", amount: "R$ 280,00", date: "Ontem, 14:00" },
                ].map((transaction, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ backgroundColor: "hsl(250 25% 10%)" }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "h-10 w-10 rounded-lg flex items-center justify-center",
                        transaction.type === "income" 
                          ? "bg-green-500/20 text-green-400" 
                          : "bg-red-500/20 text-red-400"
                      )}>
                        {transaction.type === "income" ? (
                          <ArrowUpRight className="h-5 w-5" />
                        ) : (
                          <ArrowDownRight className="h-5 w-5" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-foreground">{transaction.description}</p>
                        <p className="text-xs text-muted-foreground">{transaction.date}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={cn(
                        "text-sm font-semibold",
                        transaction.type === "income" ? "text-green-400" : "text-red-400"
                      )}>
                        {transaction.type === "income" ? "+" : "-"} {transaction.amount}
                      </p>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-xs mt-1",
                          transaction.type === "income" 
                            ? "bg-green-500/10 text-green-400 border-green-500/30" 
                            : "bg-red-500/10 text-red-400 border-red-500/30"
                        )}
                      >
                        {transaction.type === "income" ? "Receita" : "Despesa"}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
