import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import { cancelPurchaseV1, createPurchaseV1 } from "@/lib/supabase-typed-rpc";
import {
  Plus,
  Trash2,
  Truck,
  Loader2,
  ShoppingCart,
  Eye,
  RefreshCw,
  Package,
  Ban,
  DollarSign,
  FileText,
  Calendar,
  AlertTriangle,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
};

type ProductRow = {
  id: string;
  name: string;
  cost: number;
  quantity: number;
};

type PurchaseItemForm = {
  product_id: string;
  quantity: string;
  unit_cost: string;
};

type PurchaseListRow = {
  id: string;
  purchased_at: string;
  status: "draft" | "received" | "cancelled";
  total_amount: number;
  invoice_number: string | null;
  purchased_with_company_cash: boolean;
  supplier: { name: string | null } | null;
};

type PurchaseItemRow = {
  id: string;
  quantity: number;
  unit_cost: number;
  line_total: number;
  product: { name: string } | null;
};

const statusConfig: Record<string, { label: string; variant: "default" | "secondary" | "destructive" }> = {
  received: { label: "Recebida", variant: "default" },
  draft: { label: "Rascunho", variant: "secondary" },
  cancelled: { label: "Cancelada", variant: "destructive" },
};

const fmt = (v: number) => `R$ ${Number(v || 0).toFixed(2)}`;

/* ── Component ─────────────────────────────────────── */

export default function Compras() {
  const { profile, isAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [suppliers, setSuppliers] = useState<SupplierRow[]>([]);
  const [products, setProducts] = useState<ProductRow[]>([]);

  const [purchases, setPurchases] = useState<PurchaseListRow[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseListRow | null>(null);
  const [selectedPurchaseItems, setSelectedPurchaseItems] = useState<PurchaseItemRow[]>([]);
  const [isPurchaseDetailOpen, setIsPurchaseDetailOpen] = useState(false);
  const [isLoadingItems, setIsLoadingItems] = useState(false);
  const [isPurchasesLoading, setIsPurchasesLoading] = useState(false);

  const [isCancelOpen, setIsCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  const [isSaving, setIsSaving] = useState(false);

  // Purchase form
  const [supplierId, setSupplierId] = useState<string>("");
  const [purchasedAt, setPurchasedAt] = useState<string>("");
  const [invoiceNumber, setInvoiceNumber] = useState<string>("");
  const [notes, setNotes] = useState<string>("");
  const [purchasedWithCompanyCash, setPurchasedWithCompanyCash] = useState(false);
  const [items, setItems] = useState<PurchaseItemForm[]>([
    { product_id: "", quantity: "1", unit_cost: "" },
  ]);

  // Inline supplier creation
  const [supplierDialogOpen, setSupplierDialogOpen] = useState(false);
  const [supplierForm, setSupplierForm] = useState({ name: "", phone: "", email: "" });

  /* ── Data loading ── */

  useEffect(() => {
    if (!profile?.tenant_id || !isAdmin) return;

    const load = async () => {
      setIsLoading(true);
      try {
        const [supRes, prodRes, purchaseRes] = await Promise.all([
          supabase
            .from("suppliers")
            .select("id,name,phone,email")
            .eq("tenant_id", profile.tenant_id)
            .order("name", { ascending: true }),
          supabase
            .from("products")
            .select("id,name,cost,quantity")
            .eq("tenant_id", profile.tenant_id)
            .eq("is_active", true)
            .order("name", { ascending: true }),
          supabase
            .from("purchases")
            .select(
              "id,purchased_at,status,total_amount,invoice_number,purchased_with_company_cash,supplier:suppliers(name)"
            )
            .eq("tenant_id", profile.tenant_id)
            .order("purchased_at", { ascending: false })
            .limit(50),
        ]);

        if (supRes.error) throw supRes.error;
        if (prodRes.error) throw prodRes.error;
        if (purchaseRes.error) throw purchaseRes.error;

        setSuppliers((supRes.data || []) as SupplierRow[]);
        setProducts((prodRes.data || []) as ProductRow[]);
        setPurchases((purchaseRes.data || []) as unknown as PurchaseListRow[]);
      } catch (e) {
        logger.error(e);
        toast.error("Erro ao carregar dados");
      } finally {
        setIsLoading(false);
      }
    };

    load().catch(() => {});
  }, [profile?.tenant_id, isAdmin]);

  const fetchPurchases = async () => {
    if (!profile?.tenant_id) return;
    setIsPurchasesLoading(true);
    try {
      const { data, error } = await supabase
        .from("purchases")
        .select(
          "id,purchased_at,status,total_amount,invoice_number,purchased_with_company_cash,supplier:suppliers(name)"
        )
        .eq("tenant_id", profile.tenant_id)
        .order("purchased_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setPurchases((data || []) as unknown as PurchaseListRow[]);
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao carregar compras");
    } finally {
      setIsPurchasesLoading(false);
    }
  };

  /* ── Purchase detail ── */

  const openPurchaseDetail = async (purchase: PurchaseListRow) => {
    if (!profile?.tenant_id) return;
    setSelectedPurchase(purchase);
    setSelectedPurchaseItems([]);
    setCancelReason("");
    setIsPurchaseDetailOpen(true);
    setIsLoadingItems(true);
    try {
      const { data, error } = await supabase
        .from("purchase_items")
        .select("id,quantity,unit_cost,line_total,product:products(name)")
        .eq("tenant_id", profile.tenant_id)
        .eq("purchase_id", purchase.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      setSelectedPurchaseItems((data || []) as unknown as PurchaseItemRow[]);
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao carregar itens da compra");
    } finally {
      setIsLoadingItems(false);
    }
  };

  /* ── Cancel purchase ── */

  const submitCancelPurchase = async () => {
    if (!selectedPurchase?.id) return;

    setIsSaving(true);
    try {
      const { data, error } = await cancelPurchaseV1({
        p_purchase_id: selectedPurchase.id,
        p_reason: cancelReason.trim() || null,
      });

      if (error) {
        toastRpcError(toast, error, "Erro ao cancelar compra");
        return;
      }

      if (!data?.success) {
        toast.error("Erro ao cancelar compra");
        return;
      }

      toast.success(data.already_cancelled ? "Compra já estava cancelada" : "Compra cancelada e estoque estornado!");
      setIsCancelOpen(false);
      setIsPurchaseDetailOpen(false);
      setSelectedPurchase(null);
      setSelectedPurchaseItems([]);
      await fetchPurchases();
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao cancelar compra");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Items management ── */

  const totalPreview = useMemo(() => {
    let total = 0;
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.unit_cost || 0);
      if (Number.isFinite(qty) && Number.isFinite(unit)) {
        total += qty * unit;
      }
    }
    return Math.round(total * 100) / 100;
  }, [items]);

  const addItem = () => {
    setItems((prev) => [...prev, { product_id: "", quantity: "1", unit_cost: "" }]);
  };

  const removeItem = (idx: number) => {
    setItems((prev) => prev.filter((_, i) => i !== idx));
  };

  const updateItem = (idx: number, patch: Partial<PurchaseItemForm>) => {
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));
  };

  /* ── Submit purchase ── */

  const submitPurchase = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    const parsedItems = items
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost || 0),
      }))
      .filter((it) => it.product_id && Number.isFinite(it.quantity) && it.quantity > 0);

    if (parsedItems.length === 0) {
      toast.error("Adicione ao menos 1 item com produto e quantidade válida");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await createPurchaseV1({
        p_supplier_id: supplierId || null,
        p_purchased_at: purchasedAt ? new Date(purchasedAt).toISOString() : null,
        p_invoice_number: invoiceNumber || null,
        p_notes: notes || null,
        p_purchased_with_company_cash: purchasedWithCompanyCash,
        p_items: parsedItems,
      });

      if (error) {
        toastRpcError(toast, error, "Erro ao registrar compra");
        return;
      }

      if (!data?.success) {
        toast.error("Erro ao registrar compra");
        return;
      }

      toast.success(`Compra registrada! Total: ${fmt(data.total_amount)}`);
      setSupplierId("");
      setPurchasedAt("");
      setInvoiceNumber("");
      setNotes("");
      setPurchasedWithCompanyCash(false);
      setItems([{ product_id: "", quantity: "1", unit_cost: "" }]);

      await fetchPurchases();
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao registrar compra");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Inline supplier creation ── */

  const submitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    const name = supplierForm.name.trim();
    if (!name) {
      toast.error("Nome do fornecedor é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .insert({
          tenant_id: profile.tenant_id,
          name,
          phone: supplierForm.phone.trim() || null,
          email: supplierForm.email.trim() || null,
        })
        .select("id,name,phone,email")
        .maybeSingle();

      if (error) {
        toast.error(error.message || "Erro ao criar fornecedor");
        return;
      }

      if (data) {
        setSuppliers((prev) => [...prev, data as SupplierRow].sort((a, b) => a.name.localeCompare(b.name)));
        setSupplierId(String((data as any).id));
      }

      toast.success("Fornecedor criado!");
      setSupplierDialogOpen(false);
      setSupplierForm({ name: "", phone: "", email: "" });
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao criar fornecedor");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Guard ── */

  if (!isAdmin) {
    return (
      <MainLayout title="Compras" subtitle="Acesso restrito">
        <EmptyState
          icon={ShoppingCart}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar compras."
        />
      </MainLayout>
    );
  }

  /* ── Render ── */

  return (
    <MainLayout
      title="Compras"
      subtitle="Registre entradas de estoque e acompanhe o histórico"
    >
      <div className="grid gap-6">
        {/* ── Purchase Form Card ── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="h-5 w-5" />
                  Registrar Compra
                </CardTitle>
                <CardDescription>
                  O estoque é atualizado automaticamente e o custo do produto é recalculado por média ponderada.
                </CardDescription>
              </div>
              <Button
                variant="outline"
                onClick={() => setSupplierDialogOpen(true)}
                className="shrink-0"
              >
                <Truck className="h-4 w-4 mr-2" />
                Novo Fornecedor
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-12 w-full" />
                ))}
              </div>
            ) : (
              <form className="space-y-6" onSubmit={submitPurchase}>
                {/* Row 1: Supplier + Date */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Fornecedor</Label>
                    <Select value={supplierId} onValueChange={setSupplierId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione (opcional)" />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((s) => (
                          <SelectItem key={s.id} value={s.id}>
                            {s.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Data da compra</Label>
                    <Input
                      type="datetime-local"
                      value={purchasedAt}
                      onChange={(e) => setPurchasedAt(e.target.value)}
                    />
                    <p className="text-xs text-muted-foreground">Se vazio, usa a data/hora atual.</p>
                  </div>
                </div>

                {/* Row 2: Invoice + Company Cash */}
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Nota fiscal / Documento</Label>
                    <Input
                      value={invoiceNumber}
                      onChange={(e) => setInvoiceNumber(e.target.value)}
                      placeholder="Número da NF (opcional)"
                    />
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                    <div>
                      <Label className="cursor-pointer" htmlFor="company-cash">
                        Pago com caixa da empresa
                      </Label>
                      <p className="text-xs text-muted-foreground">
                        Registra uma despesa automática no Financeiro.
                      </p>
                    </div>
                    <Switch
                      id="company-cash"
                      checked={purchasedWithCompanyCash}
                      onCheckedChange={setPurchasedWithCompanyCash}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={2}
                    placeholder="Anotações sobre a compra (opcional)"
                  />
                </div>

                {/* Items */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-semibold">Itens da compra</Label>
                    <Button type="button" variant="outline" size="sm" onClick={addItem}>
                      <Plus className="h-4 w-4 mr-1" />
                      Adicionar item
                    </Button>
                  </div>

                  {/* Mobile: stacked cards */}
                  <div className="block md:hidden space-y-3">
                    {items.map((it, idx) => {
                      const prod = products.find((p) => p.id === it.product_id);
                      const lineTotal = Number(it.quantity || 0) * Number(it.unit_cost || 0);
                      return (
                        <div key={idx} className="rounded-lg border p-3 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-muted-foreground">
                              Item {idx + 1}
                            </span>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => removeItem(idx)}
                              disabled={items.length <= 1}
                              aria-label="Remover item"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs">Produto</Label>
                            <Select
                              value={it.product_id}
                              onValueChange={(v) => {
                                const p = products.find((x) => x.id === v);
                                updateItem(idx, {
                                  product_id: v,
                                  unit_cost: p ? String(p.cost ?? "") : it.unit_cost,
                                });
                              }}
                            >
                              <SelectTrigger>
                                <SelectValue placeholder="Selecione o produto" />
                              </SelectTrigger>
                              <SelectContent>
                                {products.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>
                                    {p.name} (estoque: {p.quantity})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="space-y-1">
                              <Label className="text-xs">Quantidade</Label>
                              <Input
                                inputMode="numeric"
                                value={it.quantity}
                                onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-xs">Custo unitário</Label>
                              <Input
                                inputMode="decimal"
                                value={it.unit_cost}
                                onChange={(e) => updateItem(idx, { unit_cost: e.target.value })}
                                placeholder={prod ? String(prod.cost) : "0.00"}
                              />
                            </div>
                          </div>
                          {lineTotal > 0 && (
                            <p className="text-xs text-right text-muted-foreground">
                              Subtotal: <span className="font-medium text-foreground">{fmt(lineTotal)}</span>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Desktop: Table */}
                  <div className="hidden md:block rounded-lg border overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Produto</TableHead>
                          <TableHead className="w-28">Quantidade</TableHead>
                          <TableHead className="w-36">Custo unitário</TableHead>
                          <TableHead className="w-28 text-right">Subtotal</TableHead>
                          <TableHead className="w-16 text-right" />
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {items.map((it, idx) => {
                          const lineTotal = Number(it.quantity || 0) * Number(it.unit_cost || 0);
                          return (
                            <TableRow key={idx}>
                              <TableCell>
                                <Select
                                  value={it.product_id}
                                  onValueChange={(v) => {
                                    const p = products.find((x) => x.id === v);
                                    updateItem(idx, {
                                      product_id: v,
                                      unit_cost: p ? String(p.cost ?? "") : it.unit_cost,
                                    });
                                  }}
                                >
                                  <SelectTrigger>
                                    <SelectValue placeholder="Selecione" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {products.map((p) => (
                                      <SelectItem key={p.id} value={p.id}>
                                        {p.name} (estoque: {p.quantity})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </TableCell>
                              <TableCell>
                                <Input
                                  inputMode="numeric"
                                  value={it.quantity}
                                  onChange={(e) => updateItem(idx, { quantity: e.target.value })}
                                />
                              </TableCell>
                              <TableCell>
                                <Input
                                  inputMode="decimal"
                                  value={it.unit_cost}
                                  onChange={(e) => updateItem(idx, { unit_cost: e.target.value })}
                                  placeholder="0.00"
                                />
                              </TableCell>
                              <TableCell className="text-right text-muted-foreground">
                                {lineTotal > 0 ? fmt(lineTotal) : "—"}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => removeItem(idx)}
                                  disabled={items.length <= 1}
                                  aria-label="Remover item"
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>

                  {/* Total preview */}
                  <div className="flex items-center justify-between rounded-lg bg-muted/50 px-4 py-3">
                    <span className="text-sm text-muted-foreground">Total estimado</span>
                    <span className="text-lg font-bold">{fmt(totalPreview)}</span>
                  </div>
                </div>

                <Button
                  type="submit"
                  disabled={isSaving}
                  className="gradient-primary text-primary-foreground w-full sm:w-auto"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Registrando...
                    </>
                  ) : (
                    <>
                      <Package className="h-4 w-4 mr-2" />
                      Registrar Compra
                    </>
                  )}
                </Button>
              </form>
            )}
          </CardContent>
        </Card>

        {/* ── Purchase History Card ── */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Histórico de Compras ({purchases.length})</CardTitle>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchPurchases}
                disabled={isPurchasesLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isPurchasesLoading ? "animate-spin" : ""}`} />
                Atualizar
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-14 w-full" />
                ))}
              </div>
            ) : purchases.length === 0 ? (
              <EmptyState
                icon={ShoppingCart}
                title="Nenhuma compra registrada"
                description="Registre sua primeira compra no formulário acima para dar entrada no estoque."
              />
            ) : (
              <>
                {/* Mobile: Card Layout */}
                <div className="block md:hidden space-y-3">
                  {purchases.map((p) => {
                    const cfg = statusConfig[p.status] || statusConfig.received;
                    return (
                      <div
                        key={p.id}
                        className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors cursor-pointer"
                        onClick={() => openPurchaseDetail(p)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => e.key === "Enter" && openPurchaseDetail(p)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2 min-w-0">
                            <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm">
                              {new Date(p.purchased_at).toLocaleDateString("pt-BR")}
                            </span>
                          </div>
                          <Badge variant={cfg.variant}>{cfg.label}</Badge>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="text-sm text-muted-foreground truncate">
                            <Truck className="inline h-3 w-3 mr-1" />
                            {p.supplier?.name || "Sem fornecedor"}
                          </p>
                          <span className="font-semibold text-sm">{fmt(p.total_amount)}</span>
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          {p.invoice_number && (
                            <span className="flex items-center gap-1">
                              <FileText className="h-3 w-3" />
                              NF {p.invoice_number}
                            </span>
                          )}
                          {p.purchased_with_company_cash && (
                            <span className="flex items-center gap-1">
                              <DollarSign className="h-3 w-3" />
                              Caixa empresa
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Desktop: Table */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Fornecedor</TableHead>
                        <TableHead>NF</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Caixa</TableHead>
                        <TableHead className="text-right">Total</TableHead>
                        <TableHead className="w-20 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {purchases.map((p) => {
                        const cfg = statusConfig[p.status] || statusConfig.received;
                        return (
                          <TableRow key={p.id}>
                            <TableCell className="text-muted-foreground">
                              {new Date(p.purchased_at).toLocaleString("pt-BR", {
                                dateStyle: "short",
                                timeStyle: "short",
                              })}
                            </TableCell>
                            <TableCell className="font-medium">
                              {p.supplier?.name || "—"}
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[160px] truncate">
                              {p.invoice_number || "—"}
                            </TableCell>
                            <TableCell>
                              <Badge variant={cfg.variant}>{cfg.label}</Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {p.purchased_with_company_cash ? "Sim" : "Não"}
                            </TableCell>
                            <TableCell className="text-right font-medium">
                              {fmt(p.total_amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => openPurchaseDetail(p)}
                                aria-label="Ver detalhes"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Dialog: Inline Supplier Creation ── */}
      <Dialog open={supplierDialogOpen} onOpenChange={setSupplierDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Fornecedor</DialogTitle>
            <DialogDescription>
              Cadastro rápido para vincular na compra.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={submitSupplier}>
            <div className="space-y-2">
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                value={supplierForm.name}
                onChange={(e) => setSupplierForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Nome do fornecedor"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={supplierForm.phone}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={supplierForm.email}
                  onChange={(e) => setSupplierForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="email@fornecedor.com"
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setSupplierDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="gradient-primary text-primary-foreground"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Criando...
                  </>
                ) : (
                  "Cadastrar"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* ── Dialog: Purchase Detail ── */}
      {selectedPurchase && (
        <Dialog open={isPurchaseDetailOpen} onOpenChange={setIsPurchaseDetailOpen}>
          <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Detalhes da Compra</DialogTitle>
              <DialogDescription>
                {new Date(selectedPurchase.purchased_at).toLocaleString("pt-BR", {
                  dateStyle: "long",
                  timeStyle: "short",
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Fornecedor</p>
                  <p className="font-medium">{selectedPurchase.supplier?.name || "Não informado"}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Status</p>
                  <Badge variant={statusConfig[selectedPurchase.status]?.variant || "secondary"}>
                    {statusConfig[selectedPurchase.status]?.label || selectedPurchase.status}
                  </Badge>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Nota Fiscal</p>
                  <p className="font-medium">{selectedPurchase.invoice_number || "—"}</p>
                </div>
                <div className="rounded-lg border p-3 space-y-1">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-lg">{fmt(selectedPurchase.total_amount)}</p>
                </div>
              </div>

              {selectedPurchase.purchased_with_company_cash && (
                <div className="flex items-center gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 px-3 py-2 text-sm text-blue-700 dark:text-blue-300">
                  <DollarSign className="h-4 w-4 shrink-0" />
                  Compra paga com caixa da empresa — despesa registrada no Financeiro.
                </div>
              )}

              {/* Items */}
              <div>
                <p className="font-semibold mb-2">Itens ({selectedPurchaseItems.length})</p>
                {isLoadingItems ? (
                  <div className="space-y-2">
                    {Array.from({ length: 3 }).map((_, i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : selectedPurchaseItems.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum item encontrado.</p>
                ) : (
                  <div className="rounded-lg border divide-y text-sm">
                    {selectedPurchaseItems.map((it) => (
                      <div key={it.id} className="flex items-center justify-between px-3 py-2 gap-3">
                        <div className="min-w-0">
                          <p className="font-medium truncate">{it.product?.name || "Produto removido"}</p>
                          <p className="text-xs text-muted-foreground">
                            {it.quantity}x {fmt(it.unit_cost)}
                          </p>
                        </div>
                        <span className="font-medium shrink-0">{fmt(it.line_total)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <div className="flex w-full items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setIsPurchaseDetailOpen(false)}>
                  Fechar
                </Button>
                {selectedPurchase.status !== "cancelled" && (
                  <Button
                    variant="destructive"
                    onClick={() => setIsCancelOpen(true)}
                    disabled={isSaving}
                  >
                    <Ban className="h-4 w-4 mr-2" />
                    Cancelar Compra
                  </Button>
                )}
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {/* ── AlertDialog: Cancel Purchase ── */}
      <AlertDialog open={isCancelOpen} onOpenChange={setIsCancelOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-destructive" />
              Cancelar compra
            </AlertDialogTitle>
            <AlertDialogDescription>
              O estoque será revertido aos valores anteriores à compra. Se a compra foi paga com caixa da
              empresa, um estorno será registrado no Financeiro. Esta ação só é possível se não houve
              movimentações de estoque após esta compra.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2 py-2">
            <Label>Motivo do cancelamento (opcional)</Label>
            <Textarea
              value={cancelReason}
              onChange={(e) => setCancelReason(e.target.value)}
              rows={3}
              placeholder="Descreva o motivo do cancelamento..."
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={submitCancelPurchase}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Cancelando...
                </>
              ) : (
                "Confirmar Cancelamento"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
