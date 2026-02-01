import { useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { format, eachDayOfInterval, startOfMonth, endOfMonth } from "date-fns";
import { ptBR } from "date-fns/locale";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { FinancialTransaction } from "@/types/database";

interface CashFlowTableProps {
  transactions: FinancialTransaction[];
  filterMonth: string;
}

export function CashFlowTable({ transactions, filterMonth }: CashFlowTableProps) {
  const [year, month] = filterMonth.split("-").map(Number);
  const monthStart = startOfMonth(new Date(year, month - 1));
  const monthEnd = endOfMonth(new Date(year, month - 1));

  const cashFlowData = useMemo(() => {
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

      const dailyBalance = income - expense;
      cumulativeBalance += dailyBalance;

      return {
        date: day,
        dateFormatted: format(day, "dd/MM (EEE)", { locale: ptBR }),
        income,
        expense,
        dailyBalance,
        cumulativeBalance,
        hasTransactions: dayTransactions.length > 0,
        transactionCount: dayTransactions.length,
      };
    });
  }, [transactions, monthStart, monthEnd]);

  // Only show days with transactions or every 5th day
  const filteredData = cashFlowData.filter(
    (day, index) => day.hasTransactions || index % 5 === 0
  );

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Fluxo de Caixa Detalhado</CardTitle>
        <CardDescription>
          Entradas, saídas e saldo acumulado por dia
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="max-h-[500px] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 bg-card">
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead className="text-right text-success">Entradas</TableHead>
                <TableHead className="text-right text-destructive">Saídas</TableHead>
                <TableHead className="text-right">Saldo Diário</TableHead>
                <TableHead className="text-right">Saldo Acumulado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.map((day) => (
                <TableRow
                  key={day.dateFormatted}
                  className={day.hasTransactions ? "" : "opacity-50"}
                >
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {day.dateFormatted}
                      {day.transactionCount > 0 && (
                        <Badge variant="secondary" className="text-xs">
                          {day.transactionCount}
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    {day.income > 0 ? (
                      <span className="font-medium text-success">
                        +{formatCurrency(day.income)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {day.expense > 0 ? (
                      <span className="font-medium text-destructive">
                        -{formatCurrency(day.expense)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      {day.dailyBalance > 0 ? (
                        <>
                          <TrendingUp className="h-4 w-4 text-success" />
                          <span className="font-medium text-success">
                            {formatCurrency(day.dailyBalance)}
                          </span>
                        </>
                      ) : day.dailyBalance < 0 ? (
                        <>
                          <TrendingDown className="h-4 w-4 text-destructive" />
                          <span className="font-medium text-destructive">
                            {formatCurrency(day.dailyBalance)}
                          </span>
                        </>
                      ) : (
                        <>
                          <Minus className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">R$ 0,00</span>
                        </>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <span
                      className={`font-semibold ${
                        day.cumulativeBalance >= 0 ? "text-success" : "text-destructive"
                      }`}
                    >
                      {formatCurrency(day.cumulativeBalance)}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
