import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Package, Search, Plus, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";

export function EstoquePreview() {
  return (
    <div className="relative dark min-h-full" style={{ backgroundColor: "hsl(200 25% 7%)", color: "hsl(200 15% 95%)" }}>
      <div className="w-full rounded-2xl overflow-hidden min-h-full" style={{ backgroundColor: "hsl(200 25% 7%)" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 to-cyan-500 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Package className="h-5 w-5 text-white" />
            <h3 className="text-white font-semibold text-sm">Insumos</h3>
          </div>
          <Button size="sm" className="bg-white/20 hover:bg-white/30 text-white border-white/30">
            <Plus className="h-4 w-4 mr-1" />
            Novo Insumo
          </Button>
        </div>

        {/* Content */}
        <div className="p-6 lg:p-8" style={{ backgroundColor: "hsl(200 25% 7%)" }}>
          {/* Search Bar */}
          <div className="mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar insumos..."
                className="pl-10 bg-card border-border"
                style={{ backgroundColor: "hsl(200 25% 10%)" }}
              />
            </div>
          </div>

          {/* Products List */}
          <Card className="border-border" style={{ backgroundColor: "hsl(200 25% 10%)" }}>
            <CardHeader className="pb-4">
              <CardTitle className="text-lg text-foreground flex items-center gap-2">
                <Package className="h-5 w-5" />
                Insumos em Estoque
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {[
                  { name: "Luvas Descartáveis (cx)", quantity: 45, minStock: 20, price: "R$ 35,00", status: "ok" },
                  { name: "Seringas 5ml", quantity: 12, minStock: 15, price: "R$ 32,00", status: "low" },
                  { name: "Álcool 70% (L)", quantity: 28, minStock: 10, price: "R$ 18,00", status: "ok" },
                  { name: "Máscaras Cirúrgicas (cx)", quantity: 8, minStock: 10, price: "R$ 55,00", status: "low" },
                ].map((product, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-4 rounded-lg border bg-card hover:bg-accent/50 transition-colors"
                    style={{ backgroundColor: "hsl(200 25% 10%)" }}
                  >
                    <div className="flex items-center gap-4 flex-1">
                      <div className={cn(
                        "h-12 w-12 rounded-lg flex items-center justify-center",
                        product.status === "low"
                          ? "bg-red-500/20 text-red-400"
                          : "bg-green-500/20 text-green-400"
                      )}>
                        <Package className="h-6 w-6" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm text-foreground">{product.name}</p>
                          {product.status === "low" && (
                            <AlertTriangle className="h-4 w-4 text-yellow-400" />
                          )}
                        </div>
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <span>Estoque: {product.quantity} unidades</span>
                          <span>Mínimo: {product.minStock}</span>
                        </div>
                        <div className="mt-2">
                          <Badge
                            variant="outline"
                            className={cn(
                              "text-xs",
                              product.status === "low"
                                ? "bg-yellow-500/10 text-yellow-400 border-yellow-500/30"
                                : "bg-green-500/10 text-green-400 border-green-500/30"
                            )}
                          >
                            {product.status === "low" ? "Estoque Baixo" : "Estoque OK"}
                          </Badge>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-foreground">{product.price}</p>
                      <p className="text-xs text-muted-foreground">Custo unitário</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
