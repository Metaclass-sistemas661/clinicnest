import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { StatCard } from "@/components/ui/stat-card";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  Clock,
  Plus,
  AlertTriangle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { format, startOfMonth, endOfMonth, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import type { DashboardStats, Appointment, Product } from "@/types/database";

export default function Dashboard() {
  const { profile, tenant, isAdmin } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    monthlyBalance: 0,
    monthlyIncome: 0,
    monthlyExpenses: 0,
    todayAppointments: 0,
    lowStockProducts: 0,
    pendingAppointments: 0,
  });
  const [todayAppointments, setTodayAppointments] = useState<Appointment[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchDashboardData();
    }
  }, [profile?.tenant_id]);

  const fetchDashboardData = async () => {
    if (!profile?.tenant_id) return;

    const today = new Date();
    const monthStart = startOfMonth(today).toISOString();
    const monthEnd = endOfMonth(today).toISOString();
    const dayStart = startOfDay(today).toISOString();
    const dayEnd = endOfDay(today).toISOString();

    try {
      // Fetch financial data (admin only)
      let monthlyIncome = 0;
      let monthlyExpenses = 0;

      if (isAdmin) {
        const { data: financialData } = await supabase
          .from("financial_transactions")
          .select("type, amount")
          .eq("tenant_id", profile.tenant_id)
          .gte("transaction_date", monthStart.split("T")[0])
          .lte("transaction_date", monthEnd.split("T")[0]);

        if (financialData) {
          monthlyIncome = financialData
            .filter((t) => t.type === "income")
            .reduce((sum, t) => sum + Number(t.amount), 0);
          monthlyExpenses = financialData
            .filter((t) => t.type === "expense")
            .reduce((sum, t) => sum + Number(t.amount), 0);
        }
      }

      // Fetch today's appointments
      const { data: appointmentsData } = await supabase
        .from("appointments")
        .select(`
          *,
          client:clients(name, phone),
          service:services(name, duration_minutes),
          professional:profiles(full_name)
        `)
        .eq("tenant_id", profile.tenant_id)
        .gte("scheduled_at", dayStart)
        .lte("scheduled_at", dayEnd)
        .order("scheduled_at", { ascending: true });

      // Fetch pending appointments count
      const { count: pendingCount } = await supabase
        .from("appointments")
        .select("*", { count: "exact", head: true })
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "pending");

      // Fetch low stock products (admin only)
      let lowStockData: Product[] = [];
      if (isAdmin) {
        const { data } = await supabase
          .from("products")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true);

        if (data) {
          lowStockData = (data as Product[]).filter(
            (p) => p.quantity <= p.min_quantity
          );
        }
      }

      setStats({
        monthlyBalance: monthlyIncome - monthlyExpenses,
        monthlyIncome,
        monthlyExpenses,
        todayAppointments: appointmentsData?.length || 0,
        lowStockProducts: lowStockData.length,
        pendingAppointments: pendingCount || 0,
      });

      setTodayAppointments((appointmentsData as Appointment[]) || []);
      setLowStockProducts(lowStockData);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-warning/20 text-warning border-warning/30",
      confirmed: "bg-info/20 text-info border-info/30",
      completed: "bg-success/20 text-success border-success/30",
      cancelled: "bg-destructive/20 text-destructive border-destructive/30",
    };
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
    };
    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  return (
    <MainLayout
      title={`Olá, ${profile?.full_name?.split(" ")[0] || "Usuário"}!`}
      subtitle={`Bem-vindo ao ${tenant?.name || "seu salão"}`}
      actions={
        <Button asChild className="gradient-primary text-primary-foreground text-sm md:text-base">
          <Link to="/agenda">
            <Plus className="mr-1 md:mr-2 h-4 w-4" />
            <span className="hidden sm:inline">Novo Agendamento</span>
            <span className="sm:hidden">Agendar</span>
          </Link>
        </Button>
      }
    >
      <div className="space-y-8">
        {/* Stats Grid */}
        <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
          {isAdmin && (
            <>
              <StatCard
                title="Saldo do Mês"
                value={formatCurrency(stats.monthlyBalance)}
                icon={DollarSign}
                variant={stats.monthlyBalance >= 0 ? "success" : "danger"}
              />
              <StatCard
                title="Receitas"
                value={formatCurrency(stats.monthlyIncome)}
                icon={TrendingUp}
                variant="success"
              />
              <StatCard
                title="Despesas"
                value={formatCurrency(stats.monthlyExpenses)}
                icon={TrendingDown}
                variant="danger"
              />
            </>
          )}
          <StatCard
            title="Agendamentos Hoje"
            value={stats.todayAppointments}
            icon={Calendar}
          />
          <StatCard
            title="Pendentes"
            value={stats.pendingAppointments}
            icon={Clock}
            variant={stats.pendingAppointments > 0 ? "warning" : "default"}
          />
          {isAdmin && (
            <StatCard
              title="Estoque Baixo"
              value={stats.lowStockProducts}
              icon={Package}
              variant={stats.lowStockProducts > 0 ? "warning" : "default"}
            />
          )}
        </div>

        <div className="grid gap-4 md:gap-6 lg:grid-cols-2">
          {/* Today's Appointments */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg">Agenda de Hoje</CardTitle>
                <CardDescription>
                  {format(new Date(), "EEEE, d 'de' MMMM", { locale: ptBR })}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/agenda">Ver tudo</Link>
              </Button>
            </CardHeader>
            <CardContent>
              {todayAppointments.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Calendar className="mb-4 h-12 w-12 text-muted-foreground/50" />
                  <p className="text-muted-foreground">
                    Nenhum agendamento para hoje
                  </p>
                  <Button variant="link" asChild className="mt-2">
                    <Link to="/agenda">Criar agendamento</Link>
                  </Button>
                </div>
              ) : (
                <div className="space-y-2 md:space-y-3">
                  {todayAppointments.slice(0, 5).map((appointment) => (
                    <div
                      key={appointment.id}
                      className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border p-3 md:p-4 transition-colors hover:bg-muted/50 gap-2 sm:gap-4"
                    >
                      <div className="flex items-center gap-3 md:gap-4">
                        <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-primary/10 text-primary shrink-0">
                          <Clock className="h-4 w-4 md:h-5 md:w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-medium text-sm md:text-base truncate">
                            {appointment.client?.name || "Cliente não informado"}
                          </p>
                          <p className="text-xs md:text-sm text-muted-foreground truncate">
                            {appointment.service?.name} •{" "}
                            {format(new Date(appointment.scheduled_at), "HH:mm")}
                          </p>
                        </div>
                      </div>
                      <div className="self-end sm:self-auto">
                        {getStatusBadge(appointment.status)}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Low Stock Alert - Admin Only */}
          {isAdmin && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-lg">Alertas de Estoque</CardTitle>
                  <CardDescription>
                    Produtos com estoque baixo ou zerado
                  </CardDescription>
                </div>
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/produtos">Ver todos</Link>
                </Button>
              </CardHeader>
              <CardContent>
                {lowStockProducts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-8 text-center">
                    <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-muted-foreground">
                      Todos os produtos estão com estoque adequado
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 md:space-y-3">
                    {lowStockProducts.slice(0, 5).map((product) => (
                      <div
                        key={product.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between rounded-lg border border-warning/30 bg-warning/5 p-3 md:p-4 gap-2"
                      >
                        <div className="flex items-center gap-3 md:gap-4">
                          <div className="flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full bg-warning/20 text-warning shrink-0">
                            <AlertTriangle className="h-4 w-4 md:h-5 md:w-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="font-medium text-sm md:text-base truncate">{product.name}</p>
                            <p className="text-xs md:text-sm text-muted-foreground">
                              Mínimo: {product.min_quantity} unid.
                            </p>
                          </div>
                        </div>
                        <div className="text-right self-end sm:self-auto">
                          <p className="text-base md:text-lg font-bold text-warning">
                            {product.quantity}
                          </p>
                          <p className="text-xs text-muted-foreground">em estoque</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
