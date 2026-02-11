import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CashFlowTable } from "@/components/financeiro/CashFlowTable";
import type { FinancialTransaction } from "@/types/database";

interface FinanceiroCashFlowTabProps {
  isLoading: boolean;
  transactions: FinancialTransaction[];
  filterMonth: string;
}

export const FinanceiroCashFlowTab = memo(function FinanceiroCashFlowTab({
  isLoading,
  transactions,
  filterMonth,
}: FinanceiroCashFlowTabProps) {
  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6 space-y-3">
          <Skeleton className="h-6 w-40" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }
  return <CashFlowTable transactions={transactions} filterMonth={filterMonth} />;
});
