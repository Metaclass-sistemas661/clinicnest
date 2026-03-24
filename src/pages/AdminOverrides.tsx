import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { normalizeError } from "@/utils/errorMessages";
import { 
  Plus, 
  Loader2, 
  Settings2, 
  Trash2, 
  Clock, 
  Gift,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { ptBR } from "date-fns/locale";
import { FEATURE_LABELS, LIMIT_LABELS, FeatureKey, LimitKey } from "@/types/subscription-plans";

interface Tenant {
  id: string;
  name: string;
}

interface FeatureOverride {
  id: string;
  tenant_id: string;
  tenant_name: string;
  feature_key: string;
  is_enabled: boolean;
  reason: string | null;
  enabled_by: string | null;
  enabled_by_name: string | null;
  expires_at: string | null;
  created_at: string;
  is_expired: boolean;
}

interface LimitOverride {
  id: string;
  tenant_id: string;
  tenant_name: string;
  limit_key: string;
  custom_value: number;
  reason: string | null;
  enabled_by: string | null;
  enabled_by_name: string | null;
  expires_at: string | null;
  created_at: string;
  is_expired: boolean;
}

interface OverridesData {
  features: FeatureOverride[];
  limits: LimitOverride[];
}

const FEATURE_KEYS = Object.keys(FEATURE_LABELS) as FeatureKey[];
const LIMIT_KEYS = Object.keys(LIMIT_LABELS) as LimitKey[];

export default function AdminOverrides() {
  const { profile, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [overrides, setOverrides] = useState<OverridesData>({ features: [], limits: [] });
  const [showExpired, setShowExpired] = useState(false);
  const [filterTenant, setFilterTenant] = useState<string>("all");

  // Feature override form
  const [isFeatureDialogOpen, setIsFeatureDialogOpen] = useState(false);
  const [featureForm, setFeatureForm] = useState({
    tenant_id: "",
    feature_key: "" as FeatureKey | "",
    is_enabled: true,
    reason: "",
    expires_at: "",
  });

  // Limit override form
  const [isLimitDialogOpen, setIsLimitDialogOpen] = useState(false);
  const [limitForm, setLimitForm] = useState({
    tenant_id: "",
    limit_key: "" as LimitKey | "",
    custom_value: "",
    reason: "",
    expires_at: "",
  });

  const [isSaving, setIsSaving] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ type: 'feature' | 'limit'; tenantId: string; key: string } | null>(null);

  useEffect(() => {
    if (isAdmin) {
      fetchData();
    }
  }, [isAdmin, showExpired, filterTenant]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Buscar tenants
      const { data: tenantsData, error: tenantsError } = await supabase
        .from("tenants")
        .select("id, name")
        .order("name");

      if (tenantsError) throw tenantsError;
      setTenants(tenantsData || []);

      // Buscar overrides
      const { data: overridesData, error: overridesError } = await (supabase as any).rpc(
        "get_all_overrides",
        {
          p_tenant_id: filterTenant === "all" ? null : filterTenant,
          p_include_expired: showExpired,
        }
      );

      if (overridesError) throw overridesError;
      setOverrides(overridesData || { features: [], limits: [] });
    } catch (err) {
      logger.error("[AdminOverrides] fetch error", err);
      toast.error("Erro ao carregar dados", { description: normalizeError(err, "Não foi possível carregar os overrides. Tente novamente.") });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateFeatureOverride = async () => {
    if (!featureForm.tenant_id || !featureForm.feature_key) {
      toast.error("Selecione o tenant e a funcionalidade");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase as any).rpc("create_feature_override", {
        p_tenant_id: featureForm.tenant_id,
        p_feature_key: featureForm.feature_key,
        p_is_enabled: featureForm.is_enabled,
        p_reason: featureForm.reason || null,
        p_expires_at: featureForm.expires_at ? new Date(featureForm.expires_at).toISOString() : null,
      });

      if (error) throw error;

      toast.success("Override de funcionalidade criado!");
      setIsFeatureDialogOpen(false);
      setFeatureForm({ tenant_id: "", feature_key: "", is_enabled: true, reason: "", expires_at: "" });
      fetchData();
    } catch (err: any) {
      logger.error("[AdminOverrides] create feature error", err);
      toast.error("Erro ao criar override de funcionalidade", { description: normalizeError(err, "Não foi possível criar o override. Tente novamente.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLimitOverride = async () => {
    if (!limitForm.tenant_id || !limitForm.limit_key || !limitForm.custom_value) {
      toast.error("Preencha todos os campos obrigatórios");
      return;
    }

    const customValue = parseInt(limitForm.custom_value);
    if (isNaN(customValue) || customValue < 0) {
      toast.error("Valor deve ser um número positivo");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await (supabase as any).rpc("create_limit_override", {
        p_tenant_id: limitForm.tenant_id,
        p_limit_key: limitForm.limit_key,
        p_custom_value: customValue,
        p_reason: limitForm.reason || null,
        p_expires_at: limitForm.expires_at ? new Date(limitForm.expires_at).toISOString() : null,
      });

      if (error) throw error;

      toast.success("Override de limite criado!");
      setIsLimitDialogOpen(false);
      setLimitForm({ tenant_id: "", limit_key: "", custom_value: "", reason: "", expires_at: "" });
      fetchData();
    } catch (err: any) {
      logger.error("[AdminOverrides] create limit error", err);
      toast.error("Erro ao criar override de limite", { description: normalizeError(err, "Não foi possível criar o override. Tente novamente.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;

    setIsSaving(true);
    try {
      const rpcName = deleteTarget.type === 'feature' ? 'delete_feature_override' : 'delete_limit_override';
      const params = deleteTarget.type === 'feature'
        ? { p_tenant_id: deleteTarget.tenantId, p_feature_key: deleteTarget.key }
        : { p_tenant_id: deleteTarget.tenantId, p_limit_key: deleteTarget.key };

      const { error } = await (supabase as any).rpc(rpcName, params);

      if (error) throw error;

      toast.success("Override removido!");
      setDeleteTarget(null);
      fetchData();
    } catch (err: any) {
      logger.error("[AdminOverrides] delete error", err);
      toast.error("Erro ao remover override", { description: normalizeError(err, "Não foi possível remover o override. Tente novamente.") });
    } finally {
      setIsSaving(false);
    }
  };

  const formatExpiration = (expiresAt: string | null, isExpired: boolean) => {
    if (!expiresAt) {
      return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Permanente</Badge>;
    }

    const date = new Date(expiresAt);
    if (isExpired) {
      return (
        <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Expirado {formatDistanceToNow(date, { locale: ptBR, addSuffix: true })}
        </Badge>
      );
    }

    return (
      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
        <Clock className="h-3 w-3 mr-1" />
        Expira {formatDistanceToNow(date, { locale: ptBR, addSuffix: true })}
      </Badge>
    );
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Overrides" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertTriangle className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem gerenciar overrides
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Overrides Administrativos"
      subtitle="Libere funcionalidades e ajuste limites para tenants específicos"
    >
      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex-1 min-w-[200px]">
              <Label className="text-xs text-muted-foreground mb-1 block">Filtrar por Tenant</Label>
              <Select value={filterTenant} onValueChange={setFilterTenant}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos os tenants" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os tenants</SelectItem>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="show-expired"
                checked={showExpired}
                onCheckedChange={setShowExpired}
              />
              <Label htmlFor="show-expired" className="text-sm">Mostrar expirados</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      <Tabs defaultValue="features" className="space-y-4">
        <TabsList>
          <TabsTrigger value="features" className="gap-2">
            <Gift className="h-4 w-4" />
            Funcionalidades ({overrides.features.length})
          </TabsTrigger>
          <TabsTrigger value="limits" className="gap-2">
            <Settings2 className="h-4 w-4" />
            Limites ({overrides.limits.length})
          </TabsTrigger>
        </TabsList>

        {/* Tab: Funcionalidades */}
        <TabsContent value="features">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Overrides de Funcionalidades</CardTitle>
                <CardDescription>Libere ou bloqueie funcionalidades para tenants específicos</CardDescription>
              </div>
              <Button onClick={() => setIsFeatureDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Override
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : overrides.features.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum override de funcionalidade encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Funcionalidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead>Criado por</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.features.map((fo) => (
                      <TableRow key={fo.id} className={fo.is_expired ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{fo.tenant_name}</TableCell>
                        <TableCell>{FEATURE_LABELS[fo.feature_key as FeatureKey] || fo.feature_key}</TableCell>
                        <TableCell>
                          {fo.is_enabled ? (
                            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-200">
                              <CheckCircle2 className="h-3 w-3 mr-1" />
                              Liberado
                            </Badge>
                          ) : (
                            <Badge variant="destructive">
                              <XCircle className="h-3 w-3 mr-1" />
                              Bloqueado
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={fo.reason || ""}>
                          {fo.reason || "—"}
                        </TableCell>
                        <TableCell>{formatExpiration(fo.expires_at, fo.is_expired)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {fo.enabled_by_name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: 'feature', tenantId: fo.tenant_id, key: fo.feature_key })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab: Limites */}
        <TabsContent value="limits">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
              <div>
                <CardTitle>Overrides de Limites</CardTitle>
                <CardDescription>Ajuste limites de volume para tenants específicos</CardDescription>
              </div>
              <Button onClick={() => setIsLimitDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Novo Override
              </Button>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground py-8 justify-center">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Carregando...
                </div>
              ) : overrides.limits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  Nenhum override de limite encontrado
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Tenant</TableHead>
                      <TableHead>Limite</TableHead>
                      <TableHead>Valor</TableHead>
                      <TableHead>Motivo</TableHead>
                      <TableHead>Expiração</TableHead>
                      <TableHead>Criado por</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {overrides.limits.map((lo) => (
                      <TableRow key={lo.id} className={lo.is_expired ? "opacity-50" : ""}>
                        <TableCell className="font-medium">{lo.tenant_name}</TableCell>
                        <TableCell>{LIMIT_LABELS[lo.limit_key as LimitKey] || lo.limit_key}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {lo.custom_value === -1 ? "Ilimitado" : lo.custom_value.toLocaleString("pt-BR")}
                          </Badge>
                        </TableCell>
                        <TableCell className="max-w-[200px] truncate" title={lo.reason || ""}>
                          {lo.reason || "—"}
                        </TableCell>
                        <TableCell>{formatExpiration(lo.expires_at, lo.is_expired)}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {lo.enabled_by_name || "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setDeleteTarget({ type: 'limit', tenantId: lo.tenant_id, key: lo.limit_key })}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog: Novo Override de Funcionalidade */}
      <FormDrawer
        open={isFeatureDialogOpen}
        onOpenChange={setIsFeatureDialogOpen}
        title="Novo Override de Funcionalidade"
        description="Libere ou bloqueie uma funcionalidade para um tenant específico"
        onSubmit={handleCreateFeatureOverride}
        isSubmitting={isSaving}
        submitLabel="Criar Override"
      >
        <FormDrawerSection title="Configuração">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant *</Label>
              <Select
                value={featureForm.tenant_id}
                onValueChange={(v) => setFeatureForm({ ...featureForm, tenant_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Funcionalidade *</Label>
              <Select
                value={featureForm.feature_key}
                onValueChange={(v) => setFeatureForm({ ...featureForm, feature_key: v as FeatureKey })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a funcionalidade" />
                </SelectTrigger>
                <SelectContent>
                  {FEATURE_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>{FEATURE_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label>Liberar funcionalidade</Label>
                <p className="text-xs text-muted-foreground">
                  {featureForm.is_enabled ? "A funcionalidade será liberada" : "A funcionalidade será bloqueada"}
                </p>
              </div>
              <Switch
                checked={featureForm.is_enabled}
                onCheckedChange={(checked) => setFeatureForm({ ...featureForm, is_enabled: checked })}
              />
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={featureForm.reason}
                onChange={(e) => setFeatureForm({ ...featureForm, reason: e.target.value })}
                placeholder="Ex: Parceiro estratégico, piloto de funcionalidade..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data de expiração (opcional)</Label>
              <Input
                type="datetime-local"
                value={featureForm.expires_at}
                onChange={(e) => setFeatureForm({ ...featureForm, expires_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para override permanente
              </p>
            </div>
          </div>
        </FormDrawerSection>
      </FormDrawer>

      {/* Dialog: Novo Override de Limite */}
      <FormDrawer
        open={isLimitDialogOpen}
        onOpenChange={setIsLimitDialogOpen}
        title="Novo Override de Limite"
        description="Ajuste um limite de volume para um tenant específico"
        onSubmit={handleCreateLimitOverride}
        isSubmitting={isSaving}
        submitLabel="Criar Override"
      >
        <FormDrawerSection title="Configuração">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Tenant *</Label>
              <Select
                value={limitForm.tenant_id}
                onValueChange={(v) => setLimitForm({ ...limitForm, tenant_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tenant" />
                </SelectTrigger>
                <SelectContent>
                  {tenants.map((t) => (
                    <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Limite *</Label>
              <Select
                value={limitForm.limit_key}
                onValueChange={(v) => setLimitForm({ ...limitForm, limit_key: v as LimitKey })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o limite" />
                </SelectTrigger>
                <SelectContent>
                  {LIMIT_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>{LIMIT_LABELS[key]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Valor personalizado *</Label>
              <Input
                type="number"
                value={limitForm.custom_value}
                onChange={(e) => setLimitForm({ ...limitForm, custom_value: e.target.value })}
                placeholder="Ex: 1000"
                min={-1}
              />
              <p className="text-xs text-muted-foreground">
                Use -1 para ilimitado
              </p>
            </div>

            <div className="space-y-2">
              <Label>Motivo</Label>
              <Textarea
                value={limitForm.reason}
                onChange={(e) => setLimitForm({ ...limitForm, reason: e.target.value })}
                placeholder="Ex: Compensação por problema, negociação comercial..."
              />
            </div>

            <div className="space-y-2">
              <Label>Data de expiração (opcional)</Label>
              <Input
                type="datetime-local"
                value={limitForm.expires_at}
                onChange={(e) => setLimitForm({ ...limitForm, expires_at: e.target.value })}
              />
              <p className="text-xs text-muted-foreground">
                Deixe em branco para override permanente
              </p>
            </div>
          </div>
        </FormDrawerSection>
      </FormDrawer>

      {/* Dialog: Confirmar exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover override?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O tenant voltará a usar as configurações padrão do plano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
