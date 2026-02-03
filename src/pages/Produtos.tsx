import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Package, Plus, Loader2, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { formatInAppTz } from "@/lib/date";
import type { Product, StockMovement, StockOutReasonType } from "@/types/database";

export default function Produtos() {
  const { profile, isAdmin } = useAuth();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isEditPriceDialogOpen, setIsEditPriceDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  const [productForm, setProductForm] = useState({
    name: "",
    description: "",
    cost: "",
    sale_price: "",
    quantity: "",
    min_quantity: "5",
    purchased_with_company_cash: "no" as "yes" | "no",
  });

  const [movementForm, setMovementForm] = useState({
    product_id: "",
    quantity: "",
    movement_type: "in" as "in" | "out",
    out_reason_type: "" as "" | "sale" | "damaged",
    purchased_with_company_cash: "no" as "yes" | "no",
    reason: "",
  });

  const [editPriceForm, setEditPriceForm] = useState({
    cost: "",
    sale_price: "",
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchProducts();
    }
  }, [profile?.tenant_id]);

  const fetchProducts = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      setProducts((data as Product[]) || []);
    } catch (error) {
      console.error("Error fetching products:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !isAdmin) return;

    setIsSaving(true);

    try {
      const cost = parseFloat(productForm.cost) || 0;
      const salePrice = parseFloat(productForm.sale_price) || 0;
      const quantity = parseInt(productForm.quantity) || 0;

      const { data: newProduct, error } = await supabase
        .from("products")
        .insert({
          tenant_id: profile.tenant_id,
          name: productForm.name,
          description: productForm.description || null,
          cost,
          sale_price: salePrice,
          quantity,
          min_quantity: parseInt(productForm.min_quantity) || 5,
        })
        .select("id")
        .single();

      if (error) throw error;
      if (!newProduct?.id) throw new Error("Produto não retornado");

      if (productForm.purchased_with_company_cash === "yes" && quantity > 0 && cost > 0) {
        const expenseAmount = cost * quantity;
        const { error: txError } = await supabase.from("financial_transactions").insert({
          tenant_id: profile.tenant_id,
          type: "expense",
          category: "Compra de Produto",
          amount: expenseAmount,
          description: `Compra de estoque: ${productForm.name} (${quantity} un.)`,
          transaction_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
          product_id: newProduct.id,
        });
        if (txError) {
          console.error("Erro ao registrar despesa da compra:", txError);
          toast.error("Produto salvo, mas a despesa não foi registrada.");
        }
      }

      toast.success("Produto cadastrado com sucesso!");
      setIsProductDialogOpen(false);
      setProductForm({
        name: "",
        description: "",
        cost: "",
        sale_price: "",
        quantity: "",
        min_quantity: "5",
        purchased_with_company_cash: "no",
      });
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao cadastrar produto");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleStockMovement = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    if (movementForm.movement_type === "out" && !movementForm.out_reason_type) {
      toast.error("Informe se a saída é venda ou baixa danificado.");
      return;
    }

    setIsSaving(true);

    try {
      const quantity = parseInt(movementForm.quantity);
      const product = products.find((p) => p.id === movementForm.product_id);

      if (!product) throw new Error("Produto não encontrado");

      const newQuantity =
        movementForm.movement_type === "in"
          ? product.quantity + quantity
          : product.quantity - quantity;

      if (newQuantity < 0) {
        toast.error("Quantidade insuficiente em estoque");
        setIsSaving(false);
        return;
      }

      const outReasonType: StockOutReasonType | null =
        movementForm.movement_type === "out" ? (movementForm.out_reason_type as StockOutReasonType) : null;

      // Create stock movement record
      await supabase.from("stock_movements").insert({
        tenant_id: profile.tenant_id,
        product_id: movementForm.product_id,
        quantity: movementForm.movement_type === "out" ? -quantity : quantity,
        movement_type: movementForm.movement_type,
        reason: movementForm.reason || null,
        out_reason_type: outReasonType,
        created_by: profile.id,
      });

      // Update product quantity
      const { error } = await supabase
        .from("products")
        .update({ quantity: newQuantity })
        .eq("id", movementForm.product_id);

      if (error) throw error;

      if (movementForm.movement_type === "out" && movementForm.out_reason_type === "sale") {
        const saleAmount = (product.sale_price || 0) * quantity;
        if (saleAmount > 0) {
          const { error: txError } = await supabase.from("financial_transactions").insert({
            tenant_id: profile.tenant_id,
            type: "income",
            category: "Venda de Produto",
            amount: saleAmount,
            description: `Venda: ${product.name} (${quantity} un.)`,
            transaction_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
            product_id: product.id,
          });
          if (txError) {
            console.error("Erro ao registrar receita da venda:", txError);
            toast.error("Saída registrada, mas a receita não foi lançada.");
          }
        }
      }

      if (movementForm.movement_type === "in" && movementForm.purchased_with_company_cash === "yes") {
        const expenseAmount = (product.cost || 0) * quantity;
        if (expenseAmount > 0) {
          const { error: txError } = await supabase.from("financial_transactions").insert({
            tenant_id: profile.tenant_id,
            type: "expense",
            category: "Compra de Produto",
            amount: expenseAmount,
            description: `Compra de estoque: ${product.name} (${quantity} un.)`,
            transaction_date: formatInAppTz(new Date(), "yyyy-MM-dd"),
            product_id: product.id,
          });
          if (txError) {
            console.error("Erro ao registrar despesa da compra:", txError);
            toast.error("Entrada registrada, mas a despesa não foi lançada.");
          }
        }
      }

      toast.success(
        movementForm.movement_type === "in"
          ? "Entrada registrada com sucesso!"
          : movementForm.out_reason_type === "sale"
            ? "Saída (venda) e receita registradas!"
            : "Baixa (danificado) registrada para histórico."
      );
      setIsMovementDialogOpen(false);
      setMovementForm({
        product_id: "",
        quantity: "",
        movement_type: "in",
        out_reason_type: "",
        purchased_with_company_cash: "no",
        reason: "",
      });
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao registrar movimentação");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const openEditPriceDialog = (product: Product) => {
    setSelectedProduct(product);
    setEditPriceForm({
      cost: product.cost?.toString() ?? "",
      sale_price: product.sale_price?.toString() ?? "",
    });
    setIsEditPriceDialogOpen(true);
  };

  const handleUpdateProductPrices = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !selectedProduct) return;

    setIsSaving(true);
    try {
      const cost = parseFloat(editPriceForm.cost) || 0;
      const salePrice = parseFloat(editPriceForm.sale_price) || 0;

      const { error } = await supabase
        .from("products")
        .update({ cost, sale_price: salePrice })
        .eq("id", selectedProduct.id);

      if (error) throw error;

      toast.success("Preços atualizados com sucesso!");
      setIsEditPriceDialogOpen(false);
      setSelectedProduct(null);
      setEditPriceForm({ cost: "", sale_price: "" });
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao atualizar preços");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const lowStockCount = products.filter((p) => p.quantity <= p.min_quantity).length;

  if (!isAdmin) {
    return (
      <MainLayout title="Produtos" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem gerenciar produtos
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Produtos"
      subtitle="Gerencie o estoque do salão"
      actions={
        <div className="flex gap-3">
          <Dialog open={isMovementDialogOpen} onOpenChange={setIsMovementDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <ArrowUp className="mr-2 h-4 w-4" />
                Entrada/Saída
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Movimentação de Estoque</DialogTitle>
                <DialogDescription>Registre entrada ou saída de produtos</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleStockMovement}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Select
                      value={movementForm.product_id}
                      onValueChange={(v) => setMovementForm({ ...movementForm, product_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o produto" />
                      </SelectTrigger>
                      <SelectContent>
                        {products.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.name} ({product.quantity} em estoque)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Tipo</Label>
                    <Select
                      value={movementForm.movement_type}
                      onValueChange={(v) =>
                        setMovementForm({
                          ...movementForm,
                          movement_type: v as "in" | "out",
                          out_reason_type: v === "in" ? "" : movementForm.out_reason_type,
                          purchased_with_company_cash: v === "out" ? "no" : movementForm.purchased_with_company_cash,
                        })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="in">
                          <span className="flex items-center gap-2">
                            <ArrowUp className="h-4 w-4 text-success" /> Entrada
                          </span>
                        </SelectItem>
                        <SelectItem value="out">
                          <span className="flex items-center gap-2">
                            <ArrowDown className="h-4 w-4 text-destructive" /> Saída
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Quantidade</Label>
                    <Input
                      type="number"
                      min="1"
                      value={movementForm.quantity}
                      onChange={(e) => setMovementForm({ ...movementForm, quantity: e.target.value })}
                      required
                    />
                  </div>
                  {movementForm.movement_type === "in" && (
                    <div className="space-y-3">
                      <Label>Você utilizou o caixa da empresa para comprar esse produto?</Label>
                      <RadioGroup
                        value={movementForm.purchased_with_company_cash}
                        onValueChange={(v) =>
                          setMovementForm({ ...movementForm, purchased_with_company_cash: v as "yes" | "no" })
                        }
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="yes" id="movement-cash-yes" />
                          <Label htmlFor="movement-cash-yes" className="font-normal cursor-pointer">Sim</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="no" id="movement-cash-no" />
                          <Label htmlFor="movement-cash-no" className="font-normal cursor-pointer">Não</Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        Se sim, a entrada será registrada como despesa no financeiro.
                      </p>
                    </div>
                  )}
                  {movementForm.movement_type === "out" && (
                    <div className="space-y-3">
                      <Label>Você está registrando essa saída como venda ou baixa danificado?</Label>
                      <RadioGroup
                        value={movementForm.out_reason_type}
                        onValueChange={(v) =>
                          setMovementForm({ ...movementForm, out_reason_type: v as "sale" | "damaged" })
                        }
                        className="flex gap-4"
                      >
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="sale" id="out-sale" />
                          <Label htmlFor="out-sale" className="font-normal cursor-pointer">Venda</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <RadioGroupItem value="damaged" id="out-damaged" />
                          <Label htmlFor="out-damaged" className="font-normal cursor-pointer">Baixa danificado</Label>
                        </div>
                      </RadioGroup>
                      <p className="text-xs text-muted-foreground">
                        Venda gera receita no financeiro. Baixa danificado apenas registra histórico para conferência.
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Motivo</Label>
                    <Input
                      value={movementForm.reason}
                      onChange={(e) => setMovementForm({ ...movementForm, reason: e.target.value })}
                      placeholder="Ex: Compra de fornecedor, uso em serviço..."
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsMovementDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Registrando...
                      </>
                    ) : (
                      "Registrar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                Novo Produto
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Produto</DialogTitle>
                <DialogDescription>Cadastre um novo produto no estoque</DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateProduct}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      value={productForm.name}
                      onChange={(e) => setProductForm({ ...productForm, name: e.target.value })}
                      placeholder="Ex: Shampoo Profissional"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={productForm.description}
                      onChange={(e) => setProductForm({ ...productForm, description: e.target.value })}
                      placeholder="Descrição opcional..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Custo (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productForm.cost}
                        onChange={(e) => setProductForm({ ...productForm, cost: e.target.value })}
                        placeholder="0,00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço de Venda (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={productForm.sale_price}
                        onChange={(e) => setProductForm({ ...productForm, sale_price: e.target.value })}
                        placeholder="0,00"
                      />
                    </div>
                  </div>
                  {(() => {
                    const cost = parseFloat(productForm.cost) || 0;
                    const salePrice = parseFloat(productForm.sale_price) || 0;
                    const profit = salePrice - cost;
                    const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;
                    const profitPercent = cost > 0 ? (profit / cost) * 100 : 0;
                    if (cost > 0 || salePrice > 0) {
                      return (
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                          <p className="font-medium text-muted-foreground">Margem de lucro</p>
                          <div className="mt-1 flex flex-wrap gap-4">
                            <span><strong>Lucro (R$):</strong> {formatCurrency(profit)}</span>
                            <span><strong>Margem (%):</strong> {marginPercent.toFixed(1)}%</span>
                            <span><strong>Markup (%):</strong> {profitPercent.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Quantidade Inicial</Label>
                      <Input
                        type="number"
                        min="0"
                        value={productForm.quantity}
                        onChange={(e) => setProductForm({ ...productForm, quantity: e.target.value })}
                        placeholder="0"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Quantidade Mínima</Label>
                      <Input
                        type="number"
                        min="0"
                        value={productForm.min_quantity}
                        onChange={(e) => setProductForm({ ...productForm, min_quantity: e.target.value })}
                        placeholder="5"
                      />
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Alerta será exibido quando estoque atingir a quantidade mínima
                  </p>
                  <div className="space-y-3">
                    <Label>Você utilizou o caixa da empresa para comprar esse produto?</Label>
                    <RadioGroup
                      value={productForm.purchased_with_company_cash}
                      onValueChange={(v) =>
                        setProductForm({ ...productForm, purchased_with_company_cash: v as "yes" | "no" })
                      }
                      className="flex gap-4"
                    >
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="yes" id="cash-yes" />
                        <Label htmlFor="cash-yes" className="font-normal cursor-pointer">Sim</Label>
                      </div>
                      <div className="flex items-center space-x-2">
                        <RadioGroupItem value="no" id="cash-no" />
                        <Label htmlFor="cash-no" className="font-normal cursor-pointer">Não</Label>
                      </div>
                    </RadioGroup>
                    <p className="text-xs text-muted-foreground">
                      Se sim, a compra será registrada como despesa no financeiro.
                    </p>
                  </div>
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsProductDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Cadastrar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>

          <Dialog
            open={isEditPriceDialogOpen}
            onOpenChange={(open) => {
              setIsEditPriceDialogOpen(open);
              if (!open) {
                setSelectedProduct(null);
              }
            }}
          >
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Atualizar Preços</DialogTitle>
                <DialogDescription>
                  Ajuste o custo e o preço de venda do produto
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleUpdateProductPrices}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Produto</Label>
                    <Input value={selectedProduct?.name || ""} disabled />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Custo (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPriceForm.cost}
                        onChange={(e) => setEditPriceForm({ ...editPriceForm, cost: e.target.value })}
                        placeholder="0,00"
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Preço de Venda (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editPriceForm.sale_price}
                        onChange={(e) => setEditPriceForm({ ...editPriceForm, sale_price: e.target.value })}
                        placeholder="0,00"
                        required
                      />
                    </div>
                  </div>
                  {(() => {
                    const cost = parseFloat(editPriceForm.cost) || 0;
                    const salePrice = parseFloat(editPriceForm.sale_price) || 0;
                    const profit = salePrice - cost;
                    const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;
                    if (cost > 0 || salePrice > 0) {
                      return (
                        <div className="rounded-lg border bg-muted/30 p-3 text-sm">
                          <p className="font-medium text-muted-foreground">Margem de lucro</p>
                          <div className="mt-1 flex flex-wrap gap-4">
                            <span><strong>Lucro (R$):</strong> {formatCurrency(profit)}</span>
                            <span><strong>Margem (%):</strong> {marginPercent.toFixed(1)}%</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>
                <DialogFooter>
                  <Button type="button" variant="outline" onClick={() => setIsEditPriceDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                    {isSaving ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      "Salvar"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Low Stock Alert */}
      {lowStockCount > 0 && (
        <Card className="mb-6 border-warning/30 bg-warning/5">
          <CardContent className="flex items-center gap-4 p-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-warning/20 text-warning">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <div>
              <p className="font-medium text-warning">Atenção ao estoque</p>
              <p className="text-sm text-muted-foreground">
                {lowStockCount} produto{lowStockCount > 1 ? "s" : ""} com estoque baixo ou zerado
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Products Table */}
      <Card>
        <CardHeader>
          <CardTitle>Produtos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <Package className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum produto cadastrado</p>
            </div>
          ) : (
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
                {products.map((product) => {
                  const isLowStock = product.quantity <= product.min_quantity;
                  const salePrice = product.sale_price ?? 0;
                  const cost = product.cost ?? 0;
                  const profit = salePrice - cost;
                  const marginPercent = salePrice > 0 ? (profit / salePrice) * 100 : 0;
                  return (
                    <TableRow key={product.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          {product.description && (
                            <p className="text-sm text-muted-foreground">{product.description}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>{formatCurrency(product.cost)}</TableCell>
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
                        <Button variant="outline" size="sm" onClick={() => openEditPriceDialog(product)}>
                          Editar preços
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
