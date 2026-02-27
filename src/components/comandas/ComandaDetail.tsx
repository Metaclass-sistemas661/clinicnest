import { useState, useEffect } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Loader2, Plus, Trash2, CreditCard, Package, Stethoscope } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import {
  addOrderItemV1,
  removeOrderItemV1,
  setOrderDiscountV1,
  finalizeOrderV1,
} from "@/lib/supabase-typed-rpc";
import type { Order, OrderItem, Service, Product, PaymentMethod } from "@/types/database";

interface ComandaDetailProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string | null;
  onUpdated: () => void;
}

interface PaymentLine {
  payment_method_id: string;
  amount: string;
}

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  open: "Aberta",
  paid: "Paga",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  refunded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

export function ComandaDetail({ open, onOpenChange, orderId, onUpdated }: ComandaDetailProps) {
  const { profile } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [services, setServices] = useState<Service[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);

  // Add item state
  const [addItemOpen, setAddItemOpen] = useState(false);
  const [itemKind, setItemKind] = useState<"service" | "product">("product");
  const [selectedItemId, setSelectedItemId] = useState("");
  const [itemQty, setItemQty] = useState("1");
  const [itemPrice, setItemPrice] = useState("");
  const [isAddingItem, setIsAddingItem] = useState(false);

  // Discount state
  const [discountInput, setDiscountInput] = useState("");
  const [isSavingDiscount, setIsSavingDiscount] = useState(false);

  // Finalize state
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [paymentLines, setPaymentLines] = useState<PaymentLine[]>([]);
  const [isFinalizing, setIsFinalizing] = useState(false);

  const isEditable = order?.status === "draft" || order?.status === "open";

  useEffect(() => {
    if (open && orderId && profile?.tenant_id) {
      fetchOrder();
      fetchReferenceData();
    }
  }, [open, orderId, profile?.tenant_id]);

  const fetchOrder = async () => {
    if (!orderId || !profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data: orderData, error: orderError } = await supabase
        .from("orders")
        .select("*, client:clients(*), professional:profiles!orders_professional_id_fkey(*)")
        .eq("id", orderId)
        .eq("tenant_id", profile.tenant_id)
        .single();
      if (orderError) throw orderError;
      const { data: paymentsData, error: paymentsError } = await supabase
        .from("payments")
        .select("*, payment_method:payment_methods(*)")
        .eq("order_id", orderId)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at");
      if (paymentsError) throw paymentsError;

      setOrder({
        ...(orderData as unknown as Order),
        payments: (paymentsData as any[]) as any,
      });
      setDiscountInput(String(orderData?.discount_amount ?? 0));

      const { data: itemsData, error: itemsError } = await supabase
        .from("order_items")
        .select("*, service:services(*), product:products(*)")
        .eq("order_id", orderId)
        .eq("tenant_id", profile.tenant_id)
        .order("created_at");
      if (itemsError) throw itemsError;
      setItems((itemsData as unknown as OrderItem[]) || []);
    } catch (error) {
      logger.error("Error fetching order:", error);
      toast.error("Erro ao carregar conta do paciente.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    if (!profile?.tenant_id) return;
    try {
      const [sRes, pRes, pmRes] = await Promise.all([
        supabase.from("procedures").select("*").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("name"),
        supabase.from("products").select("*").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("name"),
        supabase.from("payment_methods").select("*").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("sort_order"),
      ]);
      setServices((sRes.data as unknown as Service[]) || []);
      setProducts((pRes.data as unknown as Product[]) || []);
      setPaymentMethods((pmRes.data as unknown as PaymentMethod[]) || []);
    } catch (error) {
      logger.error("Error fetching reference data:", error);
    }
  };

  // ── Add item ──
  const handleOpenAddItem = () => {
    setItemKind("product");
    setSelectedItemId("");
    setItemQty("1");
    setItemPrice("");
    setAddItemOpen(true);
  };

  const handleItemKindChange = (kind: "service" | "product") => {
    setItemKind(kind);
    setSelectedItemId("");
    setItemPrice("");
  };

  const handleSelectItem = (id: string) => {
    setSelectedItemId(id);
    if (itemKind === "service") {
      const svc = services.find((s) => s.id === id);
      if (svc) setItemPrice(String(svc.price));
    } else {
      const prod = products.find((p) => p.id === id);
      if (prod) setItemPrice(String((prod as any).sale_price ?? prod.cost));
    }
  };

  const handleAddItem = async () => {
    if (!orderId || !selectedItemId || !itemPrice) return;
    setIsAddingItem(true);
    try {
      const { error } = await addOrderItemV1({
        p_order_id: orderId,
        p_kind: itemKind,
        p_service_id: itemKind === "service" ? selectedItemId : null,
        p_product_id: itemKind === "product" ? selectedItemId : null,
        p_quantity: Number(itemQty) || 1,
        p_unit_price: Number(itemPrice),
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao adicionar item");
        return;
      }
      toast.success("Item adicionado!");
      setAddItemOpen(false);
      fetchOrder();
      onUpdated();
    } catch (error) {
      toast.error("Erro ao adicionar item");
    } finally {
      setIsAddingItem(false);
    }
  };

  // ── Remove item ──
  const handleRemoveItem = async (itemId: string) => {
    try {
      const { error } = await removeOrderItemV1({ p_order_item_id: itemId });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao remover item");
        return;
      }
      toast.success("Item removido!");
      fetchOrder();
      onUpdated();
    } catch {
      toast.error("Erro ao remover item");
    }
  };

  // ── Discount ──
  const handleSaveDiscount = async () => {
    if (!orderId) return;
    setIsSavingDiscount(true);
    try {
      const { error } = await setOrderDiscountV1({
        p_order_id: orderId,
        p_discount_amount: Number(discountInput) || 0,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao salvar desconto");
        return;
      }
      toast.success("Desconto atualizado!");
      fetchOrder();
      onUpdated();
    } catch {
      toast.error("Erro ao salvar desconto");
    } finally {
      setIsSavingDiscount(false);
    }
  };

  // ── Finalize ──
  const handleOpenFinalize = () => {
    if (paymentMethods.length > 0) {
      setPaymentLines([{ payment_method_id: paymentMethods[0].id, amount: String(order?.total_amount ?? 0) }]);
    } else {
      setPaymentLines([{ payment_method_id: "", amount: String(order?.total_amount ?? 0) }]);
    }
    setFinalizeOpen(true);
  };

  const addPaymentLine = () => {
    setPaymentLines((prev) => [
      ...prev,
      { payment_method_id: paymentMethods[0]?.id ?? "", amount: "0" },
    ]);
  };

  const removePaymentLine = (idx: number) => {
    setPaymentLines((prev) => prev.filter((_, i) => i !== idx));
  };

  const updatePaymentLine = (idx: number, field: keyof PaymentLine, value: string) => {
    setPaymentLines((prev) => prev.map((l, i) => (i === idx ? { ...l, [field]: value } : l)));
  };

  const paymentSum = paymentLines.reduce((acc, l) => acc + (Number(l.amount) || 0), 0);

  const handleFinalize = async () => {
    if (!orderId) return;
    const total = order?.total_amount ?? 0;
    if (Math.abs(paymentSum - total) > 0.01) {
      toast.error(`A soma dos pagamentos (R$ ${paymentSum.toFixed(2)}) deve ser igual ao total (R$ ${total.toFixed(2)}).`);
      return;
    }
    setIsFinalizing(true);
    try {
      const { error } = await finalizeOrderV1({
        p_order_id: orderId,
        p_payments: paymentLines.map((l) => ({
          payment_method_id: l.payment_method_id,
          amount: Number(l.amount),
        })),
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao finalizar conta");
        return;
      }
      toast.success("Conta finalizada com sucesso!");
      setFinalizeOpen(false);
      fetchOrder();
      onUpdated();
    } catch {
      toast.error("Erro ao finalizar conta");
    } finally {
      setIsFinalizing(false);
    }
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              Conta do Paciente
              {order && (
                <Badge className={statusColors[order.status] ?? ""}>
                  {statusLabels[order.status] ?? order.status}
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>

          {isLoading ? (
            <div className="space-y-4 mt-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-12 rounded bg-muted animate-pulse" />
              ))}
            </div>
          ) : order ? (
            <div className="mt-6 space-y-6">
              {/* Client / Professional info */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Paciente</span>
                  <p className="font-medium">{(order.client as any)?.name ?? "Walk-in"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">Profissional</span>
                  <p className="font-medium">{(order.professional as any)?.full_name ?? "-"}</p>
                </div>
              </div>

              <Separator />

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold text-sm">Itens</h3>
                  {isEditable && (
                    <Button variant="outline" size="sm" onClick={handleOpenAddItem}>
                      <Plus className="h-4 w-4 mr-1" /> Adicionar
                    </Button>
                  )}
                </div>
                {items.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-4 text-center">Nenhum item adicionado.</p>
                ) : (
                  <div className="space-y-2">
                    {items.map((item) => (
                      <div key={item.id} className="flex items-center justify-between rounded-lg border p-3">
                        <div className="flex items-center gap-2 min-w-0">
                          {item.kind === "service" ? (
                            <Stethoscope className="h-4 w-4 text-primary shrink-0" />
                          ) : (
                            <Package className="h-4 w-4 text-orange-500 shrink-0" />
                          )}
                          <div className="min-w-0">
                            <p className="text-sm font-medium truncate">
                              {item.service?.name ?? item.product?.name ?? "Item"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.quantity}x {formatCurrency(item.unit_price)}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-sm font-semibold">
                            {formatCurrency(item.total_price)}
                          </span>
                          {isEditable && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => handleRemoveItem(item.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Totals */}
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span>{formatCurrency(order.subtotal_amount)}</span>
                </div>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground">Desconto</span>
                  {isEditable ? (
                    <div className="flex items-center gap-1">
                      <span className="text-muted-foreground">R$</span>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={discountInput}
                        onChange={(e) => setDiscountInput(e.target.value)}
                        className="w-24 h-8 text-right text-sm"
                      />
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8"
                        onClick={handleSaveDiscount}
                        disabled={isSavingDiscount}
                      >
                        {isSavingDiscount ? <Loader2 className="h-3 w-3 animate-spin" /> : "OK"}
                      </Button>
                    </div>
                  ) : (
                    <span>-{formatCurrency(order.discount_amount)}</span>
                  )}
                </div>
                <Separator />
                <div className="flex justify-between font-bold text-base">
                  <span>Total</span>
                  <span>{formatCurrency(order.total_amount)}</span>
                </div>
              </div>

              {/* Finalize button */}
              {isEditable && items.length > 0 && (
                <Button
                  className="w-full gradient-primary text-primary-foreground"
                  onClick={handleOpenFinalize}
                >
                  <CreditCard className="mr-2 h-4 w-4" />
                  Finalizar Conta
                </Button>
              )}

              {/* Payments (if paid) */}
              {order.status === "paid" && order.payments && order.payments.length > 0 && (
                <div>
                  <h3 className="font-semibold text-sm mb-2">Pagamentos</h3>
                  <div className="space-y-1">
                    {order.payments.map((p) => (
                      <div key={p.id} className="flex justify-between text-sm">
                        <span>{p.payment_method?.name ?? "Pagamento"}</span>
                        <span className="font-medium">{formatCurrency(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : null}
        </SheetContent>
      </Sheet>

      {/* Add Item Dialog */}
      <Dialog open={addItemOpen} onOpenChange={setAddItemOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Adicionar Item</DialogTitle>
            <DialogDescription>Selecione um procedimento ou produto para adicionar à conta.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={itemKind} onValueChange={(v) => handleItemKindChange(v as "service" | "product")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="service">Servi&ccedil;o</SelectItem>
                  <SelectItem value="product">Produto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{itemKind === "service" ? "Servi\u00e7o" : "Produto"}</Label>
              <Select value={selectedItemId} onValueChange={handleSelectItem}>
                <SelectTrigger><SelectValue placeholder="Selecione..." /></SelectTrigger>
                <SelectContent>
                  {(itemKind === "service" ? services : products).map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {item.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {itemKind === "product" && (
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={itemQty} onChange={(e) => setItemQty(e.target.value)} />
              </div>
            )}
            <div className="space-y-2">
              <Label>Pre&ccedil;o unit&aacute;rio (R$)</Label>
              <Input type="number" min="0" step="0.01" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddItemOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleAddItem}
              disabled={isAddingItem || !selectedItemId || !itemPrice}
              className="gradient-primary text-primary-foreground"
            >
              {isAddingItem ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Adicionando...</> : "Adicionar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Finalize Dialog */}
      <Dialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Finalizar Conta</DialogTitle>
            <DialogDescription>
              Total: <strong>{formatCurrency(order?.total_amount ?? 0)}</strong>. Informe os pagamentos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-4">
            {paymentLines.map((line, idx) => (
              <div key={idx} className="flex items-end gap-2">
                <div className="flex-1 space-y-1">
                  <Label className="text-xs">M&eacute;todo</Label>
                  <Select value={line.payment_method_id} onValueChange={(v) => updatePaymentLine(idx, "payment_method_id", v)}>
                    <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {paymentMethods.map((pm) => (
                        <SelectItem key={pm.id} value={pm.id}>{pm.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-28 space-y-1">
                  <Label className="text-xs">Valor (R$)</Label>
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    className="h-9"
                    value={line.amount}
                    onChange={(e) => updatePaymentLine(idx, "amount", e.target.value)}
                  />
                </div>
                {paymentLines.length > 1 && (
                  <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive" onClick={() => removePaymentLine(idx)}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
            <Button variant="outline" size="sm" onClick={addPaymentLine} className="w-full">
              <Plus className="h-4 w-4 mr-1" /> Dividir pagamento
            </Button>
            {Math.abs(paymentSum - (order?.total_amount ?? 0)) > 0.01 && (
              <p className="text-xs text-destructive text-center">
                Diferen&ccedil;a: {formatCurrency(paymentSum - (order?.total_amount ?? 0))}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFinalizeOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleFinalize}
              disabled={isFinalizing || Math.abs(paymentSum - (order?.total_amount ?? 0)) > 0.01}
              className="gradient-primary text-primary-foreground"
            >
              {isFinalizing ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Finalizando...</> : "Confirmar Pagamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
