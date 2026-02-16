import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { Plus, AlertTriangle, ArrowUp, Tag } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatInAppTz } from "@/lib/date";
import type { Product, ProductCategory, StockMovement, StockOutReasonType } from "@/types/database";
import {
  ProductCategoryDialog,
  StockMovementDialog,
  ProductFormDialog,
  ProductEditPriceDialog,
  ProductsTable,
  DamagedMovementsCard,
  type ProductFormState,
  type MovementFormState,
  type EditPriceFormState,
  type ProductGroup,
  type ProductWithCategory,
} from "@/components/produtos";

const NO_CATEGORY_VALUE = "__none__";

export default function Produtos() {
  const { profile, isAdmin } = useAuth();
  const [products, setProducts] = useState<ProductWithCategory[]>([]);
  const [categories, setCategories] = useState<ProductCategory[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isMovementDialogOpen, setIsMovementDialogOpen] = useState(false);
  const [isEditPriceDialogOpen, setIsEditPriceDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);
  const [damagedMovements, setDamagedMovements] = useState<StockMovement[]>([]);
  const [isDamagedLoading, setIsDamagedLoading] = useState(true);

  const [productForm, setProductForm] = useState<ProductFormState>({
    name: "",
    description: "",
    cost: "",
    sale_price: "",
    quantity: "",
    min_quantity: "5",
    purchased_with_company_cash: "no",
    category_id: NO_CATEGORY_VALUE,
  });

  const [movementForm, setMovementForm] = useState<MovementFormState>({
    product_id: "",
    quantity: "",
    movement_type: "in",
    out_reason_type: "",
    purchased_with_company_cash: "no",
    reason: "",
  });

  const [categoryForm, setCategoryForm] = useState({ name: "" });

  const [editPriceForm, setEditPriceForm] = useState<EditPriceFormState>({
    cost: "",
    sale_price: "",
    category_id: NO_CATEGORY_VALUE,
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchCategories();
      fetchProducts();
      fetchDamagedMovements();
    }
  }, [profile?.tenant_id]);

  const fetchCategories = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from("product_categories")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name", { ascending: true });

      if (error) throw error;
      setCategories((data as ProductCategory[]) || []);
    } catch (error) {
      logger.error("Error fetching categories:", error);
      toast.error("Erro ao carregar categorias de produto.");
    }
  };

  const fetchProducts = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from("products")
        .select("*, category:product_categories(id, name)")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      setProducts((data as ProductWithCategory[]) || []);
    } catch (error) {
      logger.error("Error fetching products:", error);
      toast.error("Erro ao carregar produtos. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchDamagedMovements = async () => {
    if (!profile?.tenant_id) return;

    setIsDamagedLoading(true);
    try {
      const { data, error } = await supabase
        .from("stock_movements")
        .select("id, tenant_id, product_id, quantity, movement_type, reason, created_by, created_at, out_reason_type")
        .eq("tenant_id", profile.tenant_id)
        .eq("movement_type", "out")
        .eq("out_reason_type", "damaged")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setDamagedMovements((data as StockMovement[]) || []);
    } catch (error) {
      logger.error("Error fetching damaged movements:", error);
      toast.error("Não foi possível carregar o histórico de baixas danificadas.");
    } finally {
      setIsDamagedLoading(false);
    }
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !isAdmin) return;

    const name = categoryForm.name.trim();
    if (!name) {
      toast.error("Informe um nome para a categoria.");
      return;
    }

    setIsSavingCategory(true);

    try {
      const { data, error } = await supabase
        .from("product_categories")
        .insert({
          tenant_id: profile.tenant_id,
          name,
        })
        .select("*")
        .single();

      if (error) throw error;

      toast.success("Categoria criada com sucesso!");
      setCategoryForm({ name: "" });
      setIsCategoryDialogOpen(false);
      await fetchCategories();

      if (data?.id) {
        setProductForm((current) => ({
          ...current,
          category_id: current.category_id === NO_CATEGORY_VALUE ? data.id : current.category_id,
        }));
        setEditPriceForm((current) => ({
          ...current,
          category_id: current.category_id === NO_CATEGORY_VALUE ? data.id : current.category_id,
        }));
      }
    } catch (error) {
      logger.error("Error creating category:", error);
      toast.error("Erro ao criar categoria");
    } finally {
      setIsSavingCategory(false);
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
          category_id: productForm.category_id === NO_CATEGORY_VALUE ? null : productForm.category_id,
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
          logger.error("Erro ao registrar despesa da compra:", txError);
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
        category_id: NO_CATEGORY_VALUE,
      });
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao cadastrar produto");
      logger.error(error);
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
            logger.error("Erro ao registrar receita da venda:", txError);
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
            logger.error("Erro ao registrar despesa da compra:", txError);
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
      fetchDamagedMovements();
    } catch (error) {
      toast.error("Erro ao registrar movimentação");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const groupedProducts = useMemo<ProductGroup[]>(() => {
    const sortedCategories = [...categories].sort((a, b) =>
      a.name.localeCompare(b.name, "pt-BR", { sensitivity: "base" })
    );

    const categoryGroups = sortedCategories.map<ProductGroup>((category) => ({
      category,
      products: [],
    }));

    const categoryMap = new Map<string, ProductGroup>(
      categoryGroups.map((group) => [group.category!.id, group])
    );

    const uncategorized: ProductWithCategory[] = [];

    products.forEach((product) => {
      if (product.category_id && categoryMap.has(product.category_id)) {
        categoryMap.get(product.category_id)!.products.push(product);
      } else {
        uncategorized.push(product);
      }
    });

    const result: ProductGroup[] = [...categoryGroups];

    if (uncategorized.length > 0 || result.length === 0) {
      result.unshift({
        category: null,
        products: uncategorized,
      });
    }

    return result;
  }, [products, categories]);

  const openEditPriceDialog = (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setEditPriceForm({
      cost: product.cost?.toString() ?? "",
      sale_price: product.sale_price?.toString() ?? "",
      category_id: product.category_id ?? NO_CATEGORY_VALUE,
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
      const categoryId = editPriceForm.category_id === NO_CATEGORY_VALUE ? null : editPriceForm.category_id;

      const { error } = await supabase
        .from("products")
        .update({ cost, sale_price: salePrice, category_id: categoryId })
        .eq("id", selectedProduct.id);

      if (error) throw error;

      toast.success("Preços atualizados com sucesso!");
      setIsEditPriceDialogOpen(false);
      setSelectedProduct(null);
      setEditPriceForm({ cost: "", sale_price: "", category_id: NO_CATEGORY_VALUE });
      fetchProducts();
    } catch (error) {
      toast.error("Erro ao atualizar preços");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const lowStockCount = products.filter((p) => p.quantity <= p.min_quantity).length;

  return (
    <MainLayout
      title="Produtos"
      subtitle={isAdmin ? "Gerencie o estoque do salão" : "Consulte produtos e estoque"}
      actions={
        isAdmin ? (
        <div className="flex flex-wrap gap-2 sm:gap-3 justify-center sm:justify-end">
          <ProductCategoryDialog
            open={isCategoryDialogOpen}
            onOpenChange={(open) => {
              setIsCategoryDialogOpen(open);
              if (!open) setCategoryForm({ name: "" });
            }}
            name={categoryForm.name}
            onNameChange={(name) => setCategoryForm({ name })}
            onSubmit={handleCreateCategory}
            isSaving={isSavingCategory}
          />
          <Button variant="outline" onClick={() => setIsCategoryDialogOpen(true)} data-tour="products-new-category">
            <Tag className="mr-2 h-4 w-4" />
            Nova Categoria
          </Button>

          <Button variant="outline" onClick={() => setIsMovementDialogOpen(true)} data-tour="products-stock-movement">
            <ArrowUp className="mr-2 h-4 w-4" />
            Entrada/Saída
          </Button>
          <StockMovementDialog
            open={isMovementDialogOpen}
            onOpenChange={setIsMovementDialogOpen}
            form={movementForm}
            setForm={setMovementForm}
            products={products as (Product & { quantity: number })[]}
            onSubmit={handleStockMovement}
            isSaving={isSaving}
          />

          <Button className="gradient-primary text-primary-foreground" onClick={() => setIsProductDialogOpen(true)} data-tour="products-new">
            <Plus className="mr-2 h-4 w-4" />
            Novo Produto
          </Button>
          <ProductFormDialog
            open={isProductDialogOpen}
            onOpenChange={setIsProductDialogOpen}
            form={productForm}
            setForm={setProductForm}
            categories={categories}
            noCategoryValue={NO_CATEGORY_VALUE}
            onSubmit={handleCreateProduct}
            isSaving={isSaving}
            onOpenCategoryDialog={() => setIsCategoryDialogOpen(true)}
            formatCurrency={formatCurrency}
          />

          <ProductEditPriceDialog
            open={isEditPriceDialogOpen}
            onOpenChange={(open) => {
              if (!open) {
                setSelectedProduct(null);
                setEditPriceForm({ cost: "", sale_price: "", category_id: NO_CATEGORY_VALUE });
              }
              setIsEditPriceDialogOpen(open);
            }}
            product={selectedProduct}
            form={editPriceForm}
            setForm={setEditPriceForm}
            categories={categories}
            noCategoryValue={NO_CATEGORY_VALUE}
            onSubmit={handleUpdateProductPrices}
            isSaving={isSaving}
            formatCurrency={formatCurrency}
          />
        </div>
        ) : null
      }
    >
      {/* Low Stock Alert - Admin only */}
      {isAdmin && lowStockCount > 0 && (
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

      <ProductsTable
        groupedProducts={groupedProducts}
        isLoading={isLoading}
        formatCurrency={formatCurrency}
        onEditPrice={openEditPriceDialog}
        isAdmin={!!isAdmin}
        onAddProduct={() => setIsProductDialogOpen(true)}
      />

      {isAdmin && (
        <DamagedMovementsCard
          movements={damagedMovements}
          products={products.map((p) => ({ id: p.id, name: p.name }))}
          isLoading={isDamagedLoading}
        />
      )}
    </MainLayout>
  );
}
