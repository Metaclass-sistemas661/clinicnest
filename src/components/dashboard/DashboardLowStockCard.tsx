import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { Product } from "@/types/database";

type DashboardLowStockCardProps = {
  lowStockProducts: Product[];
};

export const DashboardLowStockCard = memo(function DashboardLowStockCard({ lowStockProducts }: DashboardLowStockCardProps) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <div className="flex items-center gap-2">
          <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${lowStockProducts.length > 0 ? "bg-amber-500/10" : "bg-emerald-500/10"}`}>
            <Package className={`h-4 w-4 ${lowStockProducts.length > 0 ? "text-amber-600" : "text-emerald-600"}`} />
          </div>
          <CardTitle className="text-base font-semibold">Alertas de Estoque</CardTitle>
        </div>
        <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50 hover:text-teal-700">
          <Link to="/produtos" data-tour="dashboard-low-stock-view-all">Ver todos →</Link>
        </Button>
      </CardHeader>

      <CardContent className="flex-1">
        {lowStockProducts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-500" />
            </div>
            <p className="text-sm font-medium text-muted-foreground">Estoque em dia</p>
            <p className="mt-1 text-xs text-muted-foreground/70">Todos os itens com quantidade adequada</p>
          </div>
        ) : (
          <div className="space-y-2">
            {lowStockProducts.slice(0, 5).map((product) => {
              const isZero = product.quantity === 0;
              return (
                <div
                  key={product.id}
                  className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${
                    isZero ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"
                  }`}
                >
                  <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${isZero ? "bg-red-100" : "bg-amber-100"}`}>
                    <AlertTriangle className={`h-4 w-4 ${isZero ? "text-red-600" : "text-amber-600"}`} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{product.name}</p>
                    <p className="text-xs text-muted-foreground">Mín: {product.min_quantity} un.</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`tabular-nums text-base font-bold ${isZero ? "text-red-600" : "text-amber-600"}`}>
                      {product.quantity}
                    </p>
                    <p className="text-xs text-muted-foreground">em estoque</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
});
