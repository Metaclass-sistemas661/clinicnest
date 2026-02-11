import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, Link as LinkIcon } from "lucide-react";
import { formatInAppTz } from "@/lib/date";
import type { FinancialTransaction } from "@/types/database";

interface FinanceiroTransactionsTabProps {
  isLoading: boolean;
  transactions: FinancialTransaction[];
  formatCurrency: (value: number) => string;
}

export const FinanceiroTransactionsTab = memo(function FinanceiroTransactionsTab({
  isLoading,
  transactions,
  formatCurrency,
}: FinanceiroTransactionsTabProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todas as Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (transactions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Todas as Transações</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhuma transação neste período</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Todas as Transações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="block md:hidden space-y-3">
          {transactions.map((transaction) => (
            <div key={transaction.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between items-start">
                <Badge
                  variant="outline"
                  className={
                    transaction.type === "income"
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-destructive/20 text-destructive border-destructive/30"
                  }
                >
                  {transaction.type === "income" ? "Entrada" : "Saída"}
                </Badge>
                <span
                  className={`font-semibold ${
                    transaction.type === "income" ? "text-success" : "text-destructive"
                  }`}
                >
                  {transaction.type === "income" ? "+" : "-"}
                  {formatCurrency(transaction.amount)}
                </span>
              </div>
              <p className="text-sm font-medium">{transaction.category}</p>
              <p className="text-xs text-muted-foreground">
                {formatInAppTz(transaction.transaction_date, "dd/MM/yyyy")}
                {transaction.appointment_id && " · Agenda"}
              </p>
              {transaction.description && (
                <p className="text-sm text-muted-foreground truncate">{transaction.description}</p>
              )}
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Categoria</TableHead>
                <TableHead>Descrição</TableHead>
                <TableHead>Origem</TableHead>
                <TableHead className="text-right">Valor</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {transactions.map((transaction) => (
                <TableRow key={transaction.id}>
                  <TableCell>
                    {formatInAppTz(transaction.transaction_date, "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        transaction.type === "income"
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-destructive/20 text-destructive border-destructive/30"
                      }
                    >
                      {transaction.type === "income" ? "Entrada" : "Saída"}
                    </Badge>
                  </TableCell>
                  <TableCell>{transaction.category}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {transaction.description || "—"}
                  </TableCell>
                  <TableCell>
                    {transaction.appointment_id ? (
                      <Badge variant="secondary" className="gap-1">
                        <LinkIcon className="h-3 w-3" />
                        Agenda
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">Manual</span>
                    )}
                  </TableCell>
                  <TableCell
                    className={`text-right font-semibold ${
                      transaction.type === "income" ? "text-success" : "text-destructive"
                    }`}
                  >
                    {transaction.type === "income" ? "+" : "-"}
                    {formatCurrency(transaction.amount)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});
