import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { seedDefaultLoyaltyTiersV1 } from "@/lib/supabase-typed-rpc";
import {
  Gift,
  Loader2,
  Save,
  TrendingUp,
  Star,
  Award,
  Plus,
  Pencil,
  Trash2,
} from "lucide-react";

// ─── Tiers ────────────────────────────────────────────────────
interface Tier {
  id: string;
  name: string;
  min_points: number;
  discount_percent: number;
  color: string;
  icon: string;
  sort_order: number;
}

const defaultTierForm = {
  name: "",
  min_points: "",
  discount_percent: "",
  color: "#6b7280",
  icon: "🏅",
};

// ─── Component ────────────────────────────────────────────────
export default function FidelidadeCashbackAdmin() {
  const { tenant, refreshProfile } = useAuth();

  // ─── Cashback state ───────────────────────────────────────
  const [isSavingCashback, setIsSavingCashback] = useState(false);
  const [cashbackEnabled, setCashbackEnabled] = useState(false);
  const [cashbackPercent, setCashbackPercent] = useState("0");

  // ─── Points state ─────────────────────────────────────────
  const [isSavingPoints, setIsSavingPoints] = useState(false);
  const [pointsEnabled, setPointsEnabled] = useState(false);
  const [pointsPerReal, setPointsPerReal] = useState("1");

  // ─── Tiers state ──────────────────────────────────────────
  const [tiers, setTiers] = useState<Tier[]>([]);
  const [isLoadingTiers, setIsLoadingTiers] = useState(false);
  const [tierDialogOpen, setTierDialogOpen] = useState(false);
  const [editingTierId, setEditingTierId] = useState<string | null>(null);
  const [tierForm, setTierForm] = useState(defaultTierForm);
  const [isSavingTier, setIsSavingTier] = useState(false);

  const tenantId = tenant?.id;

  useEffect(() => {
    if (!tenant) return;
    setCashbackEnabled((tenant as any).cashback_enabled === true);
    setCashbackPercent(String((tenant as any).cashback_percent ?? 0));
    setPointsEnabled((tenant as any).points_enabled === true);
    setPointsPerReal(String((tenant as any).points_per_real ?? 1));
  }, [tenant]);

  useEffect(() => {
    if (tenantId) fetchTiers();
  }, [tenantId]);

  const fetchTiers = async () => {
    if (!tenantId) return;
    setIsLoadingTiers(true);
    try {
      const db = supabase as any;
      const { data, error } = await db
        .from("loyalty_tiers")
        .select("*")
        .eq("tenant_id", tenantId)
        .order("sort_order");
      if (error) throw error;
      setTiers(data || []);
    } catch (e) {
      logger.error("[FidelidadeAdmin] tiers fetch error", e);
    } finally {
      setIsLoadingTiers(false);
    }
  };

  const parsedCashbackPercent = useMemo(() => Number(cashbackPercent), [cashbackPercent]);
  const parsedPointsPerReal = useMemo(() => Number(pointsPerReal), [pointsPerReal]);

  // ─── Save Cashback ────────────────────────────────────────
  const handleSaveCashback = async () => {
    if (!tenantId) return;
    if (cashbackEnabled && (Number.isNaN(parsedCashbackPercent) || parsedCashbackPercent < 0 || parsedCashbackPercent > 100)) {
      toast.error("Percentual de cashback deve estar entre 0 e 100");
      return;
    }
    setIsSavingCashback(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          cashback_enabled: cashbackEnabled,
          cashback_percent: cashbackEnabled ? parsedCashbackPercent : 0,
        } as any)
        .eq("id", tenantId);
      if (error) throw error;
      toast.success("Cashback salvo!");
      refreshProfile();
    } catch (e) {
      logger.error("[FidelidadeAdmin] cashback save error", e);
      toast.error("Erro ao salvar cashback");
    } finally {
      setIsSavingCashback(false);
    }
  };

  // ─── Save Points ──────────────────────────────────────────
  const handleSavePoints = async () => {
    if (!tenantId) return;
    if (pointsEnabled && (Number.isNaN(parsedPointsPerReal) || parsedPointsPerReal <= 0)) {
      toast.error("Pontos por Real deve ser maior que 0.");
      return;
    }
    setIsSavingPoints(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          points_enabled: pointsEnabled,
          points_per_real: pointsEnabled ? parsedPointsPerReal : 0,
        } as any)
        .eq("id", tenantId);
      if (error) throw error;
      toast.success("Programa de pontos salvo!");
      refreshProfile();
    } catch (e) {
      logger.error("[FidelidadeAdmin] points save error", e);
      toast.error("Erro ao salvar pontos");
    } finally {
      setIsSavingPoints(false);
    }
  };

  // ─── Seed default tiers ───────────────────────────────────
  const handleSeedTiers = async () => {
    if (!tenantId) return;
    const { error } = await seedDefaultLoyaltyTiersV1({ p_tenant_id: tenantId });
    if (error) { toast.error("Erro ao criar tiers padrão."); return; }
    toast.success("Tiers Bronze / Prata / Ouro criados!");
    fetchTiers();
  };

  // ─── Tier CRUD ────────────────────────────────────────────
  const handleOpenCreateTier = () => {
    setEditingTierId(null);
    setTierForm(defaultTierForm);
    setTierDialogOpen(true);
  };

  const handleOpenEditTier = (t: Tier) => {
    setEditingTierId(t.id);
    setTierForm({
      name: t.name,
      min_points: String(t.min_points),
      discount_percent: String(t.discount_percent),
      color: t.color,
      icon: t.icon,
    });
    setTierDialogOpen(true);
  };

  const handleSaveTier = async () => {
    if (!tenantId) return;
    if (!tierForm.name.trim()) { toast.error("Informe o nome do tier."); return; }
    setIsSavingTier(true);
    try {
      const db = supabase as any;
      const payload = {
        tenant_id: tenantId,
        name: tierForm.name.trim(),
        min_points: Number(tierForm.min_points) || 0,
        discount_percent: Number(tierForm.discount_percent) || 0,
        color: tierForm.color,
        icon: tierForm.icon,
        sort_order: tiers.length,
      };
      let error;
      if (editingTierId) {
        ({ error } = await db
          .from("loyalty_tiers")
          .update(payload)
          .eq("id", editingTierId)
          .eq("tenant_id", tenantId));
      } else {
        ({ error } = await db.from("loyalty_tiers").insert(payload));
      }
      if (error) throw error;
      toast.success(editingTierId ? "Tier atualizado!" : "Tier criado!");
      setTierDialogOpen(false);
      fetchTiers();
    } catch (e) {
      logger.error("[FidelidadeAdmin] tier save error", e);
      toast.error("Erro ao salvar tier.");
    } finally {
      setIsSavingTier(false);
    }
  };

  const handleDeleteTier = async (id: string) => {
    if (!tenantId) return;
    try {
      const db = supabase as any;
      const { error } = await db
        .from("loyalty_tiers")
        .delete()
        .eq("id", id)
        .eq("tenant_id", tenantId);
      if (error) throw error;
      toast.success("Tier removido.");
      fetchTiers();
    } catch {
      toast.error("Erro ao remover tier.");
    }
  };

  return (
    <MainLayout
      title="Fidelidade & Recompensas"
      subtitle="Configure cashback, programa de pontos e tiers de fidelidade"
    >
      <Tabs defaultValue="cashback" className="space-y-6">
        <TabsList>
          <TabsTrigger value="cashback">
            <Gift className="h-4 w-4 mr-2" />Cashback
          </TabsTrigger>
          <TabsTrigger value="pontos">
            <Star className="h-4 w-4 mr-2" />Pontos
          </TabsTrigger>
          <TabsTrigger value="tiers">
            <Award className="h-4 w-4 mr-2" />Tiers
          </TabsTrigger>
        </TabsList>

        {/* ── Cashback ── */}
        <TabsContent value="cashback">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Gift className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Cashback</CardTitle>
                    <CardDescription>Crédito automático após comandas finalizadas</CardDescription>
                  </div>
                </div>
                <Badge variant={cashbackEnabled ? "default" : "secondary"}>
                  {cashbackEnabled ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-4">
                <div>
                  <Label htmlFor="cashback-enabled" className="cursor-pointer">Cashback habilitado</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Ao finalizar uma comanda, o sistema credita automaticamente um percentual para o paciente.
                  </p>
                </div>
                <Switch id="cashback-enabled" checked={cashbackEnabled} onCheckedChange={setCashbackEnabled} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Percentual de cashback (%)</Label>
                  <Input
                    type="number" min={0} max={100} step={0.1}
                    value={cashbackPercent}
                    onChange={(e) => setCashbackPercent(e.target.value)}
                    placeholder="Ex: 5"
                    disabled={!cashbackEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: 5 significa 5% do valor do atendimento em crédito para o paciente.
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <p className="text-sm font-medium text-foreground">Sugestão prática</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Comece com 3% a 5% para estimular recorrência, e aumente em campanhas.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gradient-primary text-primary-foreground"
                  onClick={handleSaveCashback}
                  disabled={!tenantId || isSavingCashback}
                >
                  {isSavingCashback ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Salvar configurações</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Pontos ── */}
        <TabsContent value="pontos">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-yellow-500/10 text-yellow-600">
                    <Star className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Programa de Pontos</CardTitle>
                    <CardDescription>Pacientes acumulam pontos a cada real gasto</CardDescription>
                  </div>
                </div>
                <Badge variant={pointsEnabled ? "default" : "secondary"}>
                  {pointsEnabled ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-4">
                <div>
                  <Label htmlFor="points-enabled" className="cursor-pointer">Programa de pontos habilitado</Label>
                  <p className="text-xs text-muted-foreground mt-1">
                    Pontos são creditados automaticamente ao finalizar uma comanda paga.
                  </p>
                </div>
                <Switch id="points-enabled" checked={pointsEnabled} onCheckedChange={setPointsEnabled} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Pontos por R$ 1,00 gasto</Label>
                  <Input
                    type="number" min={0.01} step={0.01}
                    value={pointsPerReal}
                    onChange={(e) => setPointsPerReal(e.target.value)}
                    placeholder="Ex: 1"
                    disabled={!pointsEnabled}
                  />
                  <p className="text-xs text-muted-foreground">
                    Exemplo: 1 ponto por real. Uma comanda de R$ 50 = 50 pontos.
                  </p>
                </div>
                <div className="rounded-lg border border-border/70 p-4">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-yellow-600" />
                    <p className="text-sm font-medium text-foreground">Dica de uso</p>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Configure tiers na aba "Tiers" para que pacientes com mais pontos recebam descontos automáticos.
                  </p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gradient-primary text-primary-foreground"
                  onClick={handleSavePoints}
                  disabled={!tenantId || isSavingPoints}
                >
                  {isSavingPoints ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                  ) : (
                    <><Save className="mr-2 h-4 w-4" />Salvar configurações</>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Tiers ── */}
        <TabsContent value="tiers">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                    <Award className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Tiers de Fidelidade</CardTitle>
                    <CardDescription>Defina níveis de benefícios por pontos acumulados</CardDescription>
                  </div>
                </div>
                <div className="flex gap-2">
                  {tiers.length === 0 && (
                    <Button variant="outline" size="sm" onClick={handleSeedTiers}>
                      🥉 Criar Bronze/Prata/Ouro
                    </Button>
                  )}
                  <Button
                    size="sm"
                    className="gradient-primary text-primary-foreground"
                    onClick={handleOpenCreateTier}
                  >
                    <Plus className="h-4 w-4 mr-1" />Novo Tier
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoadingTiers ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : tiers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <Award className="h-10 w-10 text-muted-foreground mb-3" />
                  <p className="text-sm text-muted-foreground">Nenhum tier criado.</p>
                  <Button variant="link" className="mt-2" onClick={handleSeedTiers}>
                    Criar Bronze / Prata / Ouro automaticamente
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tiers.map((t) => (
                    <div
                      key={t.id}
                      className="flex items-center gap-4 rounded-xl border p-4"
                      style={{ borderLeftColor: t.color, borderLeftWidth: 4 }}
                    >
                      <span className="text-2xl">{t.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold">{t.name}</p>
                        <p className="text-xs text-muted-foreground">
                          A partir de {t.min_points.toLocaleString("pt-BR")} pontos
                          {t.discount_percent > 0
                            ? ` · ${t.discount_percent}% de desconto`
                            : ""}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleOpenEditTier(t)}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => handleDeleteTier(t.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Tier Create/Edit Dialog */}
      <Dialog open={tierDialogOpen} onOpenChange={setTierDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingTierId ? "Editar Tier" : "Novo Tier"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-2">
                <Label>Nome</Label>
                <Input
                  value={tierForm.name}
                  onChange={(e) => setTierForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Ex: Prata"
                />
              </div>
              <div className="space-y-2">
                <Label>Ícone</Label>
                <Input
                  value={tierForm.icon}
                  onChange={(e) => setTierForm((f) => ({ ...f, icon: e.target.value }))}
                  placeholder="🥈"
                  className="text-center text-lg"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Pontos mínimos</Label>
                <Input
                  type="number"
                  min="0"
                  value={tierForm.min_points}
                  onChange={(e) => setTierForm((f) => ({ ...f, min_points: e.target.value }))}
                  placeholder="500"
                />
              </div>
              <div className="space-y-2">
                <Label>Desconto (%)</Label>
                <Input
                  type="number"
                  min="0"
                  max="100"
                  step="0.5"
                  value={tierForm.discount_percent}
                  onChange={(e) => setTierForm((f) => ({ ...f, discount_percent: e.target.value }))}
                  placeholder="5"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>Cor</Label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={tierForm.color}
                  onChange={(e) => setTierForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded border"
                />
                <Input
                  value={tierForm.color}
                  onChange={(e) => setTierForm((f) => ({ ...f, color: e.target.value }))}
                  placeholder="#6b7280"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTierDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleSaveTier}
              disabled={isSavingTier}
              className="gradient-primary text-primary-foreground"
            >
              {isSavingTier ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
              ) : (
                editingTierId ? "Salvar" : "Criar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
