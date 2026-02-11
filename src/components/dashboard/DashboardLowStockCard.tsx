import { memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Package, AlertTriangle } from "lucide-react";
import type { Product } from "@/types/database";

type DashboardLowStockCardProps = {
  lowStockProducts: Product[];
};

export const DashboardLowStockCard = memo(function DashboardLowStockCard({ lowStockProducts }: DashboardLowStockCardProps) {
  return (
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
  );
});
