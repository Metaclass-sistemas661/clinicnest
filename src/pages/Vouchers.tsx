import { useEffect, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
} from "@/components/ui/dialog";
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
import { Loader2, Plus, Gift, RefreshCw, Copy } from "lucide-react";

interface Voucher {
  id: string;
  code: string;
  type: "valor_fixo" | "servico";
  valor: number;
  service_id: string | null;
  status: "ativo" | "resgatado" | "expirado";
  expires_at: string | null;
  notes: string | null;
  created_at: string;
  service?: { name: string } | null;
}

interface Service {
  id: string;
  name: string;
  price: number;
}

const statusLabel: Record<string, string> = {
  ativo: "Ativo",
  resgatado: "Resgatado",
  expirado: "Expirado",
};

const statusVariant: Record<string, "default" | "secondary" | "destructive"> = {
  ativo: "default",
  resgatado: "secondary",
  expirado: "destructive",
};

function randomCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export default function Vouchers() {
  const { profile } = useAuth();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [code, setCode] = useState(randomCode());
  const [type, setType] = useState<"valor_fixo" | "servico">("valor_fixo");
  const [valor, setValor] = useState("");
  const [serviceId, setServiceId] = useState("");
  const [expiresAt, setExpiresAt] = useState("");
  const [notes, setNotes] = useState("");

  const tenantId = profile?.tenant_id;

  useEffect(() => {
    if (tenantId) {
      fetchVouchers();
      fetchServices();
    }
  }, [tenantId]);

  const fetchVouchers = async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const db = supabase as any;
      const { data, error } = await db
        .from("vouchers")
        .select("*, service:services(name)")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setVouchers(data || []);
    } catch (e) {
      logger.error("[Vouchers] fetch error", e);
      toast.error("Erro ao carregar vouchers.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchServices = async () => {
    if (!tenantId) return;
    try {
      const { data, error } = await supabase
        .from("services")
        .select("id,name,price")
        .eq("tenant_id", tenantId)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      setServices((data as unknown as Service[]) || []);
    } catch (e) {
      logger.error("[Vouchers] services fetch error", e);
    }
  };

  const handleOpenCreate = () => {
    setCode(randomCode());
    setType("valor_fixo");
    setValor("");
    setServiceId("");
    setExpiresAt("");
    setNotes("");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!tenantId) return;
    if (!code.trim()) { toast.error("Informe o código do voucher."); return; }
    if (type === "valor_fixo" && (!valor || Number(valor) <= 0)) {
      toast.error("Informe o valor do voucher."); return;
    }
    if (type === "servico" && !serviceId) {
      toast.error("Selecione um serviço."); return;
    }

    setIsSaving(true);
    try {
      const db = supabase as any;
      const selectedService = services.find((s) => s.id === serviceId);
      const { error } = await db.from("vouchers").insert({
        tenant_id: tenantId,
        code: code.toUpperCase().trim(),
        type,
        valor: type === "valor_fixo" ? Number(valor) : (selectedService?.price ?? 0),
        service_id: type === "servico" ? serviceId : null,
        expires_at: expiresAt || null,
        notes: notes || null,
        created_by: profile?.id,
      });
      if (error) {
        if (error.code === "23505") {
          toast.error("Já existe um voucher com este código.");
        } else {
          throw error;
        }
        return;
      }
      toast.success("Voucher criado com sucesso!");
      setDialogOpen(false);
      fetchVouchers();
    } catch (e) {
      logger.error("[Vouchers] save error", e);
      toast.error("Erro ao criar voucher.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleExpire = async (v: Voucher) => {
    if (v.status !== "ativo") return;
    try {
      const db = supabase as any;
      const { error } = await db
        .from("vouchers")
        .update({ status: "expirado" })
        .eq("id", v.id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Voucher expirado.");
      fetchVouchers();
    } catch (e) {
      toast.error("Erro ao expirar voucher.");
    }
  };

  const copyCode = (c: string) => {
    navigator.clipboard.writeText(c).then(() => toast.success("Código copiado!"));
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  return (
    <MainLayout title="Vouchers & Gift Cards" subtitle="Crie e gerencie vouchers de desconto para seus clientes">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Gift className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">{vouchers.length} voucher(s)</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={fetchVouchers} disabled={isLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? "animate-spin" : ""}`} />
              Atualizar
            </Button>
            <Button onClick={handleOpenCreate} className="gradient-primary text-primary-foreground">
              <Plus className="h-4 w-4 mr-2" /> Novo Voucher
            </Button>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Lista de Vouchers</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : vouchers.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Gift className="h-10 w-10 text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum voucher criado ainda.</p>
                <Button variant="link" className="mt-2" onClick={handleOpenCreate}>
                  Criar primeiro voucher
                </Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Código</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Validade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {vouchers.map((v) => (
                      <TableRow key={v.id}>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <span className="font-mono font-semibold tracking-wider">{v.code}</span>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6"
                              onClick={() => copyCode(v.code)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                        <TableCell>
                          {v.type === "valor_fixo" ? "Valor Fixo" : `Serviço — ${v.service?.name ?? "-"}`}
                        </TableCell>
                        <TableCell>{formatCurrency(v.valor)}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {v.expires_at
                            ? new Date(v.expires_at).toLocaleDateString("pt-BR")
                            : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge variant={statusVariant[v.status] ?? "secondary"}>
                            {statusLabel[v.status] ?? v.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {v.status === "ativo" && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => handleExpire(v)}
                            >
                              Expirar
                            </Button>
                          )}
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

      {/* Create Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Novo Voucher</DialogTitle>
            <DialogDescription>
              Crie um voucher de valor fixo ou serviço para presentear clientes.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Code */}
            <div className="space-y-2">
              <Label>Código</Label>
              <div className="flex gap-2">
                <Input
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  placeholder="EX: VOUCHER2026"
                  className="font-mono uppercase"
                />
                <Button
                  variant="outline"
                  size="icon"
                  type="button"
                  onClick={() => setCode(randomCode())}
                  title="Gerar código aleatório"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Type */}
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={type} onValueChange={(v) => setType(v as "valor_fixo" | "servico")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="valor_fixo">Valor Fixo (R$)</SelectItem>
                  <SelectItem value="servico">Serviço gratuito</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Valor ou Serviço */}
            {type === "valor_fixo" ? (
              <div className="space-y-2">
                <Label>Valor (R$)</Label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={valor}
                  onChange={(e) => setValor(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            ) : (
              <div className="space-y-2">
                <Label>Serviço</Label>
                <Select value={serviceId} onValueChange={setServiceId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um serviço..." /></SelectTrigger>
                  <SelectContent>
                    {services.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} — {formatCurrency(s.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Expiry */}
            <div className="space-y-2">
              <Label>Validade (opcional)</Label>
              <Input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Observações (opcional)</Label>
              <Input
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Presente de aniversário da Maria"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSave}
              disabled={isSaving}
              className="gradient-primary text-primary-foreground"
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
              ) : (
                "Criar Voucher"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
