import { memo } from "react";
import { Link } from "react-router-dom";
import { StatCard } from "@/components/ui/stat-card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Calendar,
  Package,
  Clock,
  Wallet,
  CreditCard,
  Users,
  AlertTriangle,
} from "lucide-react";
import { formatInAppTz } from "@/lib/date";

export type DashboardStatsGridProps = {
  isLoading: boolean;
  isAdmin: boolean;
  /** Admin */
  dailyBalance?: number;
  monthlyBalance?: number;
  monthlyIncome?: number;
  monthlyExpenses?: number;
  productLossTotal?: number;
  clientsCount?: number;
  commissionsPending?: number;
  commissionsPaid?: number;
  salariesToPay?: number;
  salariesPaid?: number;
  /** Staff */
  professionalCommissionsToReceive?: number;
  professionalCommissionsReceived?: number;
  mySalaryAmount?: number | null;
  lastSalaryPayment?: { date: string | null; amount: number } | null;
  staffCompletedThisMonth?: number;
  staffValueGeneratedThisMonth?: number;
  staffMyClientsCount?: number | null;
  /** Shared */
  todayAppointments?: number;
  pendingAppointments?: number;
  lowStockProducts?: number;
  formatCurrency: (value: number) => string;
};

export const DashboardStatsGrid = memo(function DashboardStatsGrid({
  isLoading,
  isAdmin,
  dailyBalance = 0,
  monthlyBalance = 0,
  monthlyIncome = 0,
  monthlyExpenses = 0,
  productLossTotal = 0,
  clientsCount = 0,
  commissionsPending = 0,
  commissionsPaid = 0,
  salariesToPay = 0,
  salariesPaid = 0,
  professionalCommissionsToReceive = 0,
  professionalCommissionsReceived = 0,
  mySalaryAmount = null,
  lastSalaryPayment = null,
  staffCompletedThisMonth = 0,
  staffValueGeneratedThisMonth = 0,
  staffMyClientsCount = null,
  todayAppointments = 0,
  pendingAppointments = 0,
  lowStockProducts = 0,
  formatCurrency,
}: DashboardStatsGridProps) {
  if (isLoading) {
    return (
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: isAdmin ? 13 : 7 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl border border-border bg-card p-3 sm:p-4 lg:p-6 flex items-start justify-between gap-3"
          >
            <div className="space-y-2 flex-1 min-w-0">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-7 w-24 sm:h-8 lg:h-9" />
            </div>
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
      {isAdmin && (
        <>
          <StatCard
            title="Saldo do Dia"
            value={formatCurrency(dailyBalance)}
            icon={DollarSign}
            variant={dailyBalance >= 0 ? "success" : "danger"}
            description="Só transações de hoje (zera à meia-noite)"
          />
          <StatCard
            title="Saldo do Mês"
            value={formatCurrency(monthlyBalance)}
            icon={DollarSign}
            variant={monthlyBalance >= 0 ? "success" : "danger"}
          />
          <StatCard
            title="Receitas"
            value={formatCurrency(monthlyIncome)}
            icon={TrendingUp}
            variant="success"
          />
          <StatCard
            title="Despesas"
            value={formatCurrency(monthlyExpenses)}
            icon={TrendingDown}
            variant="danger"
          />
          <StatCard
            title="Perdas de Produtos"
            value={formatCurrency(productLossTotal)}
            icon={AlertTriangle}
            variant="danger"
            description="Baixas danificadas no mês"
          />
          <StatCard
            title="Total de Clientes"
            value={clientsCount}
            icon={Users}
            description="Clientes cadastrados"
          />
          <StatCard
            title="Comissões a Pagar"
            value={formatCurrency(commissionsPending)}
            icon={CreditCard}
            variant="warning"
            description="Comissões pendentes do mês"
          />
          <Link to="/financeiro?tab=commissions" data-tour="dashboard-stat-commissions-paid" className="block [&:hover]:no-underline">
            <StatCard
              title="Comissões Pagas"
              value={formatCurrency(commissionsPaid)}
              icon={Wallet}
              variant="success"
              description="Comissões pagas no mês"
            />
          </Link>
          <Link to="/financeiro?tab=salaries" data-tour="dashboard-stat-salaries-to-pay" className="block [&:hover]:no-underline">
            <StatCard
              title="Salários a Pagar"
              value={formatCurrency(salariesToPay)}
              icon={CreditCard}
              variant="warning"
              description="Total de salários fixos configurados"
            />
          </Link>
          <Link to="/financeiro?tab=salaries" data-tour="dashboard-stat-salaries-paid" className="block [&:hover]:no-underline">
            <StatCard
              title="Salários Pagos"
              value={formatCurrency(salariesPaid)}
              icon={DollarSign}
              variant="success"
              description="Salários pagos no mês"
            />
          </Link>
        </>
      )}
      {!isAdmin && (
        <>
          <StatCard
            title="Comissões a Receber"
            value={formatCurrency(professionalCommissionsToReceive)}
            icon={CreditCard}
            variant="warning"
            description="Comissões pendentes (aguardando pagamento do admin)"
          />
          <Link to="/minhas-comissoes" className="block [&:hover]:no-underline" data-tour="dashboard-stat-my-commissions">
            <StatCard
              title="Comissões Recebidas"
              value={formatCurrency(professionalCommissionsReceived)}
              icon={Wallet}
              variant="success"
              description="Comissões já pagas neste mês"
            />
          </Link>
          {mySalaryAmount !== null && (
            <Link to="/meus-salarios" className="block [&:hover]:no-underline" data-tour="dashboard-stat-my-salary">
              <StatCard
                title="Meu Salário"
                value={formatCurrency(mySalaryAmount)}
                icon={DollarSign}
                variant="info"
                description={
                  lastSalaryPayment
                    ? `Último pagamento: ${formatInAppTz(lastSalaryPayment.date || "", "dd/MM/yyyy")}`
                    : "Salário fixo configurado"
                }
              />
            </Link>
          )}
          <StatCard
            title="Meu desempenho"
            value={staffCompletedThisMonth}
            icon={TrendingUp}
            description={`${formatCurrency(staffValueGeneratedThisMonth)} gerados este mês`}
          />
          <StatCard
            title="Clientes que atendi"
            value={staffMyClientsCount ?? 0}
            icon={Users}
            description="Clientes únicos nos seus atendimentos"
          />
        </>
      )}
      <StatCard
        title="Agendamentos Hoje"
        value={todayAppointments}
        icon={Calendar}
      />
      <StatCard
        title={isAdmin ? "Pendentes" : "Meus pendentes"}
        value={pendingAppointments}
        icon={Clock}
        variant={pendingAppointments > 0 ? "warning" : "default"}
        description={!isAdmin ? "Agendamentos pendentes de confirmação" : undefined}
      />
      {isAdmin && (
        <StatCard
          title="Estoque Baixo"
          value={lowStockProducts}
          icon={Package}
          variant={lowStockProducts > 0 ? "warning" : "default"}
        />
      )}
    </div>
  );
});
