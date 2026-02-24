import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { Loader2, Plus, Tag, RefreshCw, Copy, Pencil } from "lucide-react";

interface Coupon {
  id: string;
  code: string;
  type: "percent" | "fixed";
  value: number;
  max_uses: number | null;
  used_count: number;
  valid_from: string | null;
  valid_until: string | null;
  service_id: string | null;
  is_active: boolean;
  created_at: string;
  service?: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
}

const defaultForm = {
  code: "",
  type: "percent" as "percent" | "fixed",
  value: "",
  max_uses: "",
  valid_from: "",
  valid_until: "",
  service_id: "",
  is_active: true,
};

export default function Cupons() {
  const { profile } = useAuth();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const tenantId = profile?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      fetchCoupons();
      fetchServices();
    }
  }, [tenantId]);

  const fetchCoupons = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const db = supabase as any;
      const { data, error } = await db
        .from("discount_coupons")
        .select("*, service:services(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCoupons(data || []);
    } catch (e) {
      logger.error("[Cupons] fetch error", e);
      toast.error("Erro ao carregar cupons.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    if (!tenantId) return;
    try {
      const { data } = await supabase
        .from("services")
        .select("id,name")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      setServices((data as unknown as Service[]) || []);
    } catch (e) {
      logger.error("[Cupons] services error", e);
    }
  };

  const handleOpenCreate = () => {
    setEditingId(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const handleOpenEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      type: c.type,
      value: String(c.value),
      max_uses: c.max_uses != null ? String(c.max_uses) : "",
      valid_from: c.valid_from ?? "",
      valid_until: c.valid_until ?? "",
      service_id: c.service_id ?? "",
      is_active: c.is_active,
    });
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!form.code.trim()) { toast.error("Informe o código do cupom."); return; }
    if (!form.value || Number(form.value) <= 0) { toast.error("Informe um valor válido."); return; }
    if (form.type === "percent" && Number(form.value) > 100) {
      toast.error("Percentual não pode ser maior que 100%."); return;
    }

    setIsSaving(true);
    try {
      const db = supabase as any;
      const payload = {
        tenant_id: tenantId,
        code: form.code.toUpperCase().trim(),
        type: form.type,
        value: Number(form.value),
        max_uses: form.max_uses ? Number(form.max_uses) : null,
        valid_from: form.valid_from || null,
        valid_until: form.valid_until || null,
        service_id: form.service_id || null,
        is_active: form.is_active,
      };

      let error;
      if (editingId) {
        ({ error } = await db
          .from("discount_coupons")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", tenantId));
      } else {
        ({ error } = await db.from("discount_coupons").insert(payload));
      }

      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um cupom com este código.");
        } else {
          throw error;
        }
        return;
      }
      toast.success(editingId ? "Cupom atualizado!" : "Cupom criado!");
      setDialogOpen(false);
      fetchCoupons();
    } catch (e) {
      logger.error("[Cupons] save error", e);
      toast.error("Erro ao salvar cupom.");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (c: Coupon) => {
    try {
      const db = supabase as any;
      const { error } = await db
        .from("discount_coupons")
        .update({ is_active: !c.is_active })
        .eq("id", c.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      fetchCoupons();
    } catch {
      toast.error("Erro ao alterar status.");
    }
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c).then(() => toast.success("Código copiado!"));
  };

  const formatValue = (c: Coupon) =>
    c.type === "percent"
      ? `${c.value}%`
      : c.value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <MainLayout title="Cupons de Desconto" subtitle="Crie e gerencie cupons promocionais para suas campanhas">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Tag className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">{coupons.length} cupom(ns)</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchCoupons} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleOpenCreate} className="gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" /> Novo Cupom
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lista de Cupons</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : coupons.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Tag className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum cupom criado ainda.</p>
                <Button variant="link" className="mt-2" onClick={handleOpenCreate}>
                  Criar primeiro cupom
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Desconto</TableHead>
                      <TableHead>Usos</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {coupons.map((c) => (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-semibold tracking-wider">{c.code}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(c.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          {c.service?.name && (
                            <p className="text-xs text-muted-foreground">Para: {c.service.name}</p>
                          )}
                        </TableCell>
                        <TableCell className="font-semibold">{formatValue(c)}</TableCell>
                        <TableCell className="text-sm">
                          {c.used_count}
                          {c.max_uses != null ? ` / ${c.max_uses}` : " / ∞"}
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {c.valid_from && c.valid_until
                            ? `${new Date(c.valid_from).toLocaleDateString("pt-BR")} – ${new Date(c.valid_until).toLocaleDateString("pt-BR")}`
                            : c.valid_until
                            ? `até ${new Date(c.valid_until).toLocaleDateString("pt-BR")}`
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Switch
                            checked={c.is_active}
                            onCheckedChange={() => toggleActive(c)}
                          />
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => handleOpenEdit(c)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create / Edit FormDrawer */}
      <FormDrawer
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingId ? "Editar Cupom" : "Novo Cupom"}
        description="Configure o código, desconto e regras de validade."
        width="md"
        onSubmit={handleSave}
        isSubmitting={isSaving}
        submitLabel={editingId ? "Salvar" : "Criar Cupom"}
      >
        <FormDrawerSection title="Código">
          <div className="space-y-2">
            <Label>Código</Label>
            <Input
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))}
              placeholder="EX: DESCONTO10"
              className="font-mono uppercase"
              disabled={!!editingId}
            />
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Tipo e Valor">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v as "percent" | "fixed" }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{form.type === "percent" ? "Percentual (%)" : "Valor (R$)"}</Label>
              <Input
                type="number"
                min="0"
                max={form.type === "percent" ? 100 : undefined}
                step={form.type === "percent" ? 1 : 0.01}
                value={form.value}
                onChange={(e) => setForm((f) => ({ ...f, value: e.target.value }))}
                placeholder={form.type === "percent" ? "10" : "25.00"}
              />
            </div>
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Limites de Uso">
          <div className="space-y-2">
            <Label>Máximo de usos (em branco = ilimitado)</Label>
            <Input
              type="number"
              min="1"
              value={form.max_uses}
              onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
              placeholder="Ex: 50"
            />
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Validade">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Válido a partir de</Label>
              <Input
                type="date"
                value={form.valid_from}
                onChange={(e) => setForm((f) => ({ ...f, valid_from: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Válido até</Label>
              <Input
                type="date"
                value={form.valid_until}
                onChange={(e) => setForm((f) => ({ ...f, valid_until: e.target.value }))}
              />
            </div>
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Serviço e Status">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Serviço específico (opcional)</Label>
              <Select
                value={form.service_id || "__all__"}
                onValueChange={(v) => setForm((f) => ({ ...f, service_id: v === "__all__" ? "" : v }))}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos os serviços</SelectItem>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="coupon-active" className="cursor-pointer">Cupom ativo</Label>
                <p className="text-xs text-muted-foreground">Desative para suspender o cupom sem excluir.</p>
              </div>
              <Switch
                id="coupon-active"
                checked={form.is_active}
                onCheckedChange={(v) => setForm((f) => ({ ...f, is_active: v }))}
              />
            </div>
          </div>
        </FormDrawerSection>
      </FormDrawer>
    </MainLayout>
  );
}
