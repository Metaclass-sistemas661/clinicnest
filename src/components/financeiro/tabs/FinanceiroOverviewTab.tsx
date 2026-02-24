import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceCharts } from "@/components/financeiro/FinanceCharts";
import { CashFlowTable } from "@/components/financeiro/CashFlowTable";
import type { FinancialTransaction } from "@/types/database";

interface FinanceiroOverviewTabProps {
  isLoading: boolean;
  transactions: FinancialTransaction[];
  filterMonth: string;
}

export const FinanceiroOverviewTab = memo(function FinanceiroOverviewTab({
  isLoading,
  transactions,
  filterMonth,
}: FinanceiroOverviewTabProps) {
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-[280px] w-full" />
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-[200px]" />
              <Skeleton className="h-[200px]" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 space-y-3">
            <Skeleton className="h-6 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }
  return (
    <div className="space-y-6">
      <FinanceCharts transactions={transactions} filterMonth={filterMonth} />
      <CashFlowTable transactions={transactions} filterMonth={filterMonth} />
    </div>
  );
});
