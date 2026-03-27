import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { createPurchaseV1 } from "@/lib/supabase-typed-rpc";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Plus, Trash2, Truck, Package } from "lucide-react";

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; cost: number; quantity: number };
type ItemForm = { product_id: string; quantity: string; unit_cost: string };

const STEPS = [
  { id: 1, title: "Fornecedor", description: "Selecione o fornecedor" },
  { id: 2, title: "Itens", description: "Adicione os produtos" },
  { id: 3, title: "Totais", description: "Revise os valores" },
  { id: 4, title: "Confirmar", description: "Finalize a compra" },
];

export default function NovaCompra() {
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const [step, setStep] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  const [supplierId, setSupplierId] = useState("");
  const [purchasedAt, setPurchasedAt] = useState("");
  const [invoiceNumber, setInvoiceNumber] = useState("");
  const [notes, setNotes] = useState("");
  const [purchasedWithCompanyCash, setPurchasedWithCompanyCash] = useState(false);
  const [items, setItems] = useState<ItemForm[]>([{ product_id: "", quantity: "1", unit_cost: "" }]);

  useEffect(() => {
    if (!profile?.tenant_id || !isAdmin) return;
    const load = async () => {
      setIsLoading(true);
      try {
        const [supRes, prodRes] = await Promise.all([
          supabase.from("suppliers").select("id,name").eq("tenant_id", profile.tenant_id).order("name").limit(200),
          supabase.from("products").select("id,name,cost,quantity").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("name").limit(500),
        ]);
        setSuppliers((supRes.data ?? []) as Supplier[]);
        setProducts((prodRes.data ?? []) as Product[]);
      } catch (err) {
        logger.error(err);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [profile?.tenant_id, isAdmin]);

  const totalPreview = useMemo(() => {
    let total = 0;
    for (const it of items) {
      const qty = Number(it.quantity || 0);
      const unit = Number(it.unit_cost || 0);
      if (Number.isFinite(qty) && Number.isFinite(unit)) total += qty * unit;
    }
    return Math.round(total * 100) / 100;
  }, [items]);

  const addItem = () => setItems((prev) => [...prev, { product_id: "", quantity: "1", unit_cost: "" }]);
  const removeItem = (idx: number) => setItems((prev) => prev.filter((_, i) => i !== idx));
  const updateItem = (idx: number, patch: Partial<ItemForm>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  const canProceed = () => {
    if (step === 2) {
      return items.some((it) => it.product_id && Number(it.quantity) > 0);
    }
    return true;
  };

  const handleSubmit = async () => {
    const parsedItems = items
      .map((it) => ({
        product_id: it.product_id,
        quantity: Number(it.quantity),
        unit_cost: Number(it.unit_cost || 0),
      }))
      .filter((it) => it.product_id && it.quantity > 0);

    if (parsedItems.length === 0) {
      toast.error("Adicione ao menos 1 item válido");
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

      toast.success(`Compra registrada! Total: R$ ${data?.total_amount?.toFixed(2) ?? "0.00"}`);
      navigate("/compras");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao registrar compra");
    } finally {
      setIsSaving(false);
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Nova Compra" subtitle="Acesso restrito">
        <p className="text-muted-foreground">Apenas administradores podem registrar compras.</p>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Nova Compra"
      subtitle="Registre uma entrada de estoque"
      actions={
        <Button variant="outline" onClick={() => navigate("/compras")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step > s.id ? "bg-primary border-primary text-primary-foreground" :
                step === s.id ? "border-primary text-primary" : "border-muted text-muted-foreground"
              }`}>
                {step > s.id ? <Check className="h-5 w-5" /> : s.id}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${step >= s.id ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 sm:w-24 h-0.5 mx-4 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <Card>
          <CardContent className="pt-6">
            {/* Step 1: Fornecedor */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="space-y-2">
                  <Label>Fornecedor</Label>
                  <Select value={supplierId} onValueChange={setSupplierId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((s) => (
                        <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Data da compra</Label>
                  <Input type="datetime-local" value={purchasedAt} onChange={(e) => setPurchasedAt(e.target.value)} />
                  <p className="text-xs text-muted-foreground">Se vazio, usa a data/hora atual.</p>
                </div>
                <div className="space-y-2">
                  <Label>Nota fiscal / Documento</Label>
                  <Input value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} placeholder="Número da NF (opcional)" />
                </div>
              </div>
            )}

            {/* Step 2: Itens */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">Itens da compra</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addItem}>
                    <Plus className="h-4 w-4 mr-1" />
                    Adicionar item
                  </Button>
                </div>
                <div className="space-y-3">
                  {items.map((it, idx) => {
                    const prod = products.find((p) => p.id === it.product_id);
                    return (
                      <div key={idx} className="rounded-lg border p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-muted-foreground">Item {idx + 1}</span>
                          <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => removeItem(idx)} disabled={items.length <= 1}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                        <div className="space-y-2">
                          <Label className="text-xs">Produto</Label>
                          <Select value={it.product_id} onValueChange={(v) => {
                            const p = products.find((x) => x.id === v);
                            updateItem(idx, { product_id: v, unit_cost: p ? String(p.cost ?? "") : it.unit_cost });
                          }}>
                            <SelectTrigger><SelectValue placeholder="Selecione o produto" /></SelectTrigger>
                            <SelectContent>
                              {products.map((p) => (
                                <SelectItem key={p.id} value={p.id}>{p.name} (estoque: {p.quantity})</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Quantidade</Label>
                            <Input inputMode="numeric" value={it.quantity} onChange={(e) => updateItem(idx, { quantity: e.target.value })} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Custo unitário</Label>
                            <Input inputMode="decimal" value={it.unit_cost} onChange={(e) => updateItem(idx, { unit_cost: e.target.value })} placeholder={prod ? String(prod.cost) : "0.00"} />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 3: Totais */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="rounded-lg bg-muted/50 p-6 text-center">
                  <p className="text-sm text-muted-foreground mb-2">Total estimado</p>
                  <p className="text-4xl font-bold">R$ {totalPreview.toFixed(2)}</p>
                </div>
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label className="cursor-pointer" htmlFor="company-cash-switch">Pago com caixa da empresa</Label>
                    <p className="text-xs text-muted-foreground">Registra uma despesa automática no Financeiro.</p>
                  </div>
                  <Switch id="company-cash-switch" checked={purchasedWithCompanyCash} onCheckedChange={setPurchasedWithCompanyCash} />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Anotações sobre a compra (opcional)" />
                </div>
              </div>
            )}

            {/* Step 4: Confirmar */}
            {step === 4 && (
              <div className="space-y-6">
                <div className="rounded-lg border p-6 space-y-4">
                  <h3 className="font-semibold">Resumo da Compra</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Fornecedor</p>
                      <p className="font-medium">{suppliers.find((s) => s.id === supplierId)?.name || "Não informado"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Nota Fiscal</p>
                      <p className="font-medium">{invoiceNumber || "—"}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Itens</p>
                      <p className="font-medium">{items.filter((it) => it.product_id).length} produto(s)</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Total</p>
                      <p className="font-medium text-lg">R$ {totalPreview.toFixed(2)}</p>
                    </div>
                  </div>
                  {purchasedWithCompanyCash && (
                    <p className="text-sm text-blue-600">Será registrada despesa no Financeiro.</p>
                  )}
                </div>
              </div>
            )}

            {/* Navigation */}
            <div className="flex justify-between mt-8 pt-6 border-t">
              <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Voltar
              </Button>
              {step < 4 ? (
                <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                  Próximo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              ) : (
                <Button onClick={handleSubmit} disabled={isSaving} variant="gradient">
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Registrando...</> : <><Package className="mr-2 h-4 w-4" />Registrar Compra</>}
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </MainLayout>
  );
}
