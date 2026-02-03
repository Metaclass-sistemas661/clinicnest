import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell
} from "recharts";
import { format, parseISO, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import type { FinancialTransaction } from "@/types/database";

interface FinanceChartsProps {
  transactions: FinancialTransaction[];
  filterMonth: string;
}

const COLORS = ['#7c3aed', '#f97316', '#10b981', '#ef4444', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899'];

export function FinanceCharts({ transactions, filterMonth }: FinanceChartsProps) {
  const [year, month] = filterMonth.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  // Daily cash flow data
  const dailyCashFlow = useMemo(() => {
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
    let cumulativeBalance = 0;

    return days.map((day) => {
      const dayStr = format(day, "yyyy-MM-dd");
      const dayTransactions = transactions.filter(
        (t) => t.transaction_date === dayStr
      );

      const income = dayTransactions
        .filter((t) => t.type === "income")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      const expense = dayTransactions
        .filter((t) => t.type === "expense")
        .reduce((sum, t) => sum + Number(t.amount), 0);

      cumulativeBalance += income - expense;

      return {
        date: formatInAppTz(day, "dd"),
        fullDate: formatInAppTz(day, "dd/MM"),
        receita: income,
        despesa: expense,
        saldo: cumulativeBalance,
      };
    });
  }, [transactions, monthStart, monthEnd]);

  // Category breakdown
  const categoryData = useMemo(() => {
    const incomeByCategory: Record<string, number> = {};
    const expenseByCategory: Record<string, number> = {};

    transactions.forEach((t) => {
      if (t.type === "income") {
        incomeByCategory[t.category] = (incomeByCategory[t.category] || 0) + Number(t.amount);
      } else {
        expenseByCategory[t.category] = (expenseByCategory[t.category] || 0) + Number(t.amount);
      }
    });

    return {
      income: Object.entries(incomeByCategory).map(([name, value]) => ({ name, value })),
      expense: Object.entries(expenseByCategory).map(([name, value]) => ({ name, value })),
    };
  }, [transactions]);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
      minimumFractionDigits: 0,
    }).format(value);
  };

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload) return null;

    return (
      <div className="rounded-lg border bg-card p-3 shadow-lg">
        <p className="mb-2 font-medium">{label}</p>
        {payload.map((entry: any, index: number) => (
          <p key={index} style={{ color: entry.color }} className="text-sm">
            {entry.name}: {formatCurrency(entry.value)}
          </p>
        ))}
      </div>
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {/* Cash Flow Evolution */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Fluxo de Caixa Diário</CardTitle>
          <CardDescription>
            Evolução do saldo acumulado ao longo do mês
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={dailyCashFlow}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="fullDate" 
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickFormatter={(v) => formatCurrency(v)}
                  tick={{ fontSize: 12 }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="saldo" 
                  name="Saldo Acumulado"
                  stroke="hsl(var(--primary))" 
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Daily Income vs Expense */}
      <Card>
        <CardHeader>
          <CardTitle>Receitas vs Despesas</CardTitle>
          <CardDescription>
            Comparação diária de entradas e saídas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dailyCashFlow}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <YAxis 
                  tickFormatter={(v) => `${v / 1000}k`}
                  tick={{ fontSize: 10 }}
                  className="text-muted-foreground"
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Bar dataKey="receita" name="Receita" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="despesa" name="Despesa" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Expense by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Despesas por Categoria</CardTitle>
          <CardDescription>
            Distribuição dos gastos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {categoryData.expense.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData.expense}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.expense.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Nenhuma despesa registrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Income by Category */}
      <Card>
        <CardHeader>
          <CardTitle>Receitas por Categoria</CardTitle>
          <CardDescription>
            Distribuição das entradas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-64">
            {categoryData.income.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryData.income}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={80}
                    paddingAngle={2}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    {categoryData.income.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => formatCurrency(value)}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground">
                Nenhuma receita registrada
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Category Summary Table */}
      <Card className="lg:col-span-2">
        <CardHeader>
          <CardTitle>Resumo por Categoria</CardTitle>
          <CardDescription>
            Detalhamento de receitas e despesas por categoria
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-6 md:grid-cols-2">
            {/* Income Categories */}
            <div>
              <h4 className="mb-3 font-semibold text-success">Receitas</h4>
              <div className="space-y-2">
                {categoryData.income.length > 0 ? (
                  categoryData.income.map((cat, idx) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span>{cat.name}</span>
                      </div>
                      <span className="font-semibold text-success">
                        +{formatCurrency(cat.value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma receita</p>
                )}
              </div>
            </div>

            {/* Expense Categories */}
            <div>
              <h4 className="mb-3 font-semibold text-destructive">Despesas</h4>
              <div className="space-y-2">
                {categoryData.expense.length > 0 ? (
                  categoryData.expense.map((cat, idx) => (
                    <div
                      key={cat.name}
                      className="flex items-center justify-between rounded-lg border p-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className="h-3 w-3 rounded-full"
                          style={{ backgroundColor: COLORS[idx % COLORS.length] }}
                        />
                        <span>{cat.name}</span>
                      </div>
                      <span className="font-semibold text-destructive">
                        -{formatCurrency(cat.value)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-sm text-muted-foreground">Nenhuma despesa</p>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
