import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Calendar,
  Users,
  Package,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardPreview() {
  return (
    <div className="relative dark min-h-full" style={{ backgroundColor: "hsl(250 25% 7%)", color: "hsl(250 15% 95%)" }}>
      {/* Mock Dashboard Container */}
      <div className="w-full rounded-2xl overflow-hidden min-h-full" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
        {/* Mock Header */}
        <div className="bg-gradient-to-r from-violet-600 to-fuchsia-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-white/20 flex items-center justify-center">
              <Calendar className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="text-white font-semibold text-sm">Dashboard</h3>
              <p className="text-white/80 text-xs">Visão geral do seu salão</p>
            </div>
          </div>
          <Badge className="bg-white/20 text-white border-white/30">Hoje</Badge>
        </div>

        {/* Mock Content */}
        <div className="p-6 lg:p-8" style={{ backgroundColor: "hsl(250 25% 7%)" }}>
          {/* Stats Grid - Cards maiores e não comprimidos */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-6 mb-8">
            <div className="dark">
              <StatCard
                title="Saldo do Mês"
                value="R$ 12.450,00"
                icon={Wallet}
                variant="success"
                trend={{ value: 15, isPositive: true }}
              />
            </div>
            <div className="dark">
              <StatCard
                title="Agendamentos Hoje"
                value="8"
                icon={Calendar}
                variant="info"
              />
            </div>
            <div className="dark">
              <StatCard
                title="Total de Clientes"
                value="342"
                icon={Users}
                variant="default"
              />
            </div>
            <div className="dark">
              <StatCard
                title="Estoque Baixo"
                value="3"
                icon={Package}
                variant="warning"
              />
            </div>
          </div>

          {/* Mock Table - Mais espaçada */}
          <Card className="border-border" style={{ backgroundColor: "hsl(250 25% 10%)" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground">Agendamentos de Hoje</CardTitle>
              <CardDescription className="text-sm">Próximos compromissos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { time: "09:00", client: "Maria Silva", service: "Corte + Escova", status: "confirmed" },
                  { time: "10:30", client: "João Santos", service: "Barba Completa", status: "confirmed" },
                  { time: "14:00", client: "Ana Costa", service: "Coloração", status: "pending" },
                ].map((apt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ backgroundColor: "hsl(250 25% 10%)" }}
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-12 w-12 rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-sm font-semibold text-white">
                        {apt.time}
                      </div>
                      <div>
                        <p className="font-medium text-sm text-foreground">{apt.client}</p>
                        <p className="text-xs text-muted-foreground">{apt.service}</p>
                      </div>
                    </div>
                    <Badge
                      variant={apt.status === "confirmed" ? "default" : "secondary"}
                      className={cn(
                        apt.status === "confirmed" && "bg-green-500/20 text-green-400 border-green-500/30"
                      )}
                    >
                      {apt.status === "confirmed" ? "Confirmado" : "Pendente"}
                    </Badge>
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
