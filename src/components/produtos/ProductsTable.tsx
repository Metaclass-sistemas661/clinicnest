import { Fragment } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Package, Plus, AlertTriangle } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import type { ProductCategory } from "@/types/database";

export interface ProductWithCategory {
  id: string;
  name: string;
  description?: string | null;
  cost?: number | null;
  sale_price?: number | null;
  quantity: number;
  min_quantity: number;
  category_id?: string | null;
  category?: ProductCategory | null;
}

export interface ProductGroup {
  category: ProductCategory | null;
  products: ProductWithCategory[];
}

interface ProductsTableProps {
  groupedProducts: ProductGroup[];
  isLoading: boolean;
  formatCurrency: (value: number) => string;
  onEditPrice: (product: ProductWithCategory) => void;
  isAdmin: boolean;
  onAddProduct: () => void;
}

export function ProductsTable({
  groupedProducts,
  isLoading,
  formatCurrency,
  onEditPrice,
  isAdmin,
  onAddProduct,
}: ProductsTableProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (groupedProducts.length === 0 || groupedProducts.every((g) => g.products.length === 0)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Package}
            title="Nenhum produto cadastrado"
            description="Cadastre os produtos em estoque para controlar vendas e baixas."
            action={
              <Button variant="outline" onClick={onAddProduct} data-tour="products-add-empty">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar Produto
              </Button>
            }
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Produtos Cadastrados</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="block md:hidden space-y-4">
          {groupedProducts.map((group) => (
            <div key={group.category?.id ?? "uncategorized"}>
              <p className="text-sm font-semibold text-muted-foreground mb-2">
                {group.category ? group.category.name : "Sem categoria"} ({group.products.length})
              </p>
              <div className="space-y-3">
                {group.products.map((product) => {
                  const isLowStock = product.quantity <= product.min_quantity;
                  const salePrice = product.sale_price ?? 0;
                  const cost = product.cost ?? 0;
                  const profit = salePrice - cost;
                  const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;
                  return (
                    <div key={product.id} className="rounded-lg border p-4 space-y-2">
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-xs text-muted-foreground line-clamp-1">{product.description}</p>
                          )}
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            isLowStock
                              ? "bg-warning/20 text-warning border-warning/30"
                              : "bg-success/20 text-success border-success/30"
                          }
                        >
                          {isLowStock ? "Baixo" : "Normal"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <span className="text-muted-foreground">Custo:</span>
                        <span>{formatCurrency(product.cost ?? 0)}</span>
                        <span className="text-muted-foreground">Venda:</span>
                        <span>{formatCurrency(salePrice)}</span>
                        <span className="text-muted-foreground">Margem:</span>
                        <span>{marginPercent.toFixed(1)}%</span>
                        <span className="text-muted-foreground">Estoque:</span>
                        <span className={isLowStock ? "font-bold text-warning" : ""}>{product.quantity}</span>
                      </div>
                      {isAdmin && (
                        <Button
                          variant="outline"
                          size="sm"
                          className="w-full mt-2"
                          onClick={() => onEditPrice(product)}
                          data-tour="products-item-edit"
                        >
                          Editar detalhes
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Custo</TableHead>
                <TableHead>Preço Venda</TableHead>
                <TableHead className="text-center">Margem %</TableHead>
                <TableHead>Lucro (R$)</TableHead>
                <TableHead className="text-center">Estoque</TableHead>
                <TableHead className="text-center">Mínimo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {groupedProducts.map((group) => (
                <Fragment key={group.category?.id ?? "uncategorized"}>
                  <TableRow className="bg-muted/40">
                    <TableCell colSpan={9} className="font-semibold">
                      {group.category ? group.category.name : "Sem categoria"}{" "}
                      <span className="text-sm text-muted-foreground">
                        ({group.products.length} produto{group.products.length === 1 ? "" : "s"})
                      </span>
                    </TableCell>
                  </TableRow>
                  {group.products.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground">
                        Nenhum produto nesta categoria
                      </TableCell>
                    </TableRow>
                  ) : (
                    group.products.map((product) => {
                      const isLowStock = product.quantity <= product.min_quantity;
                      const salePrice = product.sale_price ?? 0;
                      const cost = product.cost ?? 0;
                      const profit = salePrice - cost;
                      const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;
                      return (
                        <TableRow key={product.id}>
                          <TableCell>
                            <div className="space-y-1">
                              <p className="font-medium">{product.name}</p>
                              {product.description && (
                                <p className="text-sm text-muted-foreground">{product.description}</p>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>{formatCurrency(product.cost ?? 0)}</TableCell>
                          <TableCell>{formatCurrency(salePrice)}</TableCell>
                          <TableCell className="text-center">{marginPercent.toFixed(1)}%</TableCell>
                          <TableCell>{formatCurrency(profit)}</TableCell>
                          <TableCell className="text-center">
                            <span className={isLowStock ? "font-bold text-warning" : ""}>
                              {product.quantity}
                            </span>
                          </TableCell>
                          <TableCell className="text-center">{product.min_quantity}</TableCell>
                          <TableCell>
                            {isLowStock ? (
                              <Badge variant="outline" className="bg-warning/20 text-warning border-warning/30">
                                <AlertTriangle className="mr-1 h-3 w-3" />
                                Baixo
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                                Normal
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {isAdmin && (
                              <Button variant="outline" size="sm" onClick={() => onEditPrice(product)} data-tour="products-item-edit">
                                Editar detalhes
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
