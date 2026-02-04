import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  DollarSign,
  TrendingUp,
  Calendar,
  Users,
  Package,
  Clock,
  Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";

export function DashboardPreview() {
  return (
    <div className="relative">
      {/* Mock Dashboard Container */}
      <div className="rounded-2xl border bg-card shadow-2xl overflow-hidden">
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
        <div className="p-6 bg-background">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <StatCard
              title="Saldo do Mês"
              value="R$ 12.450"
              icon={Wallet}
              variant="success"
              trend={{ value: 15, isPositive: true }}
            />
            <StatCard
              title="Agendamentos Hoje"
              value="8"
              icon={Calendar}
              variant="info"
            />
            <StatCard
              title="Clientes"
              value="342"
              icon={Users}
              variant="default"
            />
            <StatCard
              title="Estoque Baixo"
              value="3"
              icon={Package}
              variant="warning"
            />
          </div>

          {/* Mock Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Agendamentos de Hoje</CardTitle>
              <CardDescription>Próximos compromissos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  { time: "09:00", client: "Maria Silva", service: "Corte + Escova", status: "confirmed" },
                  { time: "10:30", client: "João Santos", service: "Barba", status: "confirmed" },
                  { time: "14:00", client: "Ana Costa", service: "Coloração", status: "pending" },
                ].map((apt, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-gradient-to-br from-violet-100 to-fuchsia-100 flex items-center justify-center text-sm font-semibold text-violet-700">
                        {apt.time}
                      </div>
                      <div>
                        <p className="font-medium text-sm">{apt.client}</p>
                        <p className="text-xs text-muted-foreground">{apt.service}</p>
                      </div>
                    </div>
                    <Badge
                      variant={apt.status === "confirmed" ? "default" : "secondary"}
                      className={cn(
                        apt.status === "confirmed" && "bg-green-100 text-green-700"
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

      {/* Decorative Elements */}
      <div className="absolute -top-4 -right-4 h-24 w-24 bg-violet-500/20 rounded-full blur-2xl -z-10" />
      <div className="absolute -bottom-4 -left-4 h-32 w-32 bg-fuchsia-500/20 rounded-full blur-3xl -z-10" />
    </div>
  );
}
