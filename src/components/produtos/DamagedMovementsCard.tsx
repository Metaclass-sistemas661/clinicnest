import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatInAppTz } from "@/lib/date";
import type { StockMovement } from "@/types/database";

interface ProductBasic {
  id: string;
  name: string;
}

interface DamagedMovementsCardProps {
  movements: StockMovement[];
  products: ProductBasic[];
  isLoading: boolean;
}

export function DamagedMovementsCard({
  movements,
  products,
  isLoading,
}: DamagedMovementsCardProps) {
  if (isLoading) {
    return (
      <Card className="mt-6" data-tour="products-damaged-history">
        <CardHeader>
          <CardTitle>Histórico de Baixas (danificados)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, idx) => (
              <Skeleton key={idx} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (movements.length === 0) {
    return (
      <Card className="mt-6" data-tour="products-damaged-history">
        <CardHeader>
          <CardTitle>Histórico de Baixas (danificados)</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Nenhuma baixa de produto danificado registrada até o momento.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="mt-6" data-tour="products-damaged-history">
      <CardHeader>
        <CardTitle>Histórico de Baixas (danificados)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="block md:hidden space-y-3">
          {movements.map((movement) => {
            const product = products.find((p) => p.id === movement.product_id);
            const productName = product?.name ?? "Produto removido";
            const quantity = Math.abs(movement.quantity);
            return (
              <div key={movement.id} className="rounded-lg border p-4 space-y-1">
                <p className="font-medium">{productName}</p>
                <p className="text-xs text-muted-foreground">
                  {formatInAppTz(movement.created_at, "dd/MM/yyyy HH:mm")} · Qtd: {quantity}
                </p>
                {movement.reason && <p className="text-sm">{movement.reason}</p>}
              </div>
            );
          })}
        </div>
        <div className="hidden md:block">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Produto</TableHead>
                <TableHead className="text-center">Quantidade</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {movements.map((movement) => {
                const product = products.find((p) => p.id === movement.product_id);
                const productName = product?.name ?? "Produto removido";
                const quantity = Math.abs(movement.quantity);
                return (
                  <TableRow key={movement.id}>
                    <TableCell>
                      {formatInAppTz(movement.created_at, "dd/MM/yyyy HH:mm")}
                    </TableCell>
                    <TableCell>{productName}</TableCell>
                    <TableCell className="text-center">{quantity}</TableCell>
                    <TableCell>{movement.reason || "—"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
