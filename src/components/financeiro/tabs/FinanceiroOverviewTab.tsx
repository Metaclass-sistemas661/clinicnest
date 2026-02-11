import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { FinanceCharts } from "@/components/financeiro/FinanceCharts";
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
    );
  }
  return <FinanceCharts transactions={transactions} filterMonth={filterMonth} />;
});
