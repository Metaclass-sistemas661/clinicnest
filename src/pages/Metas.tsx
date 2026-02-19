import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  archiveGoalV2,
  createGoalTemplateV2,
  createGoalV2,
  getGoalsWithProgress,
  updateGoalV2,
} from "@/lib/supabase-typed-rpc";
import { useNavigate } from "react-router-dom";
import {
  Target,
  Plus,
  Loader2,
  TrendingUp,
  Package,
  Users,
  BarChart3,
  Search,
  Archive,
  ArrowUpDown,
  Sparkles,
  Download,
  CopyPlus,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSimpleMode } from "@/lib/simple-mode";
import { isAdvancedReportsAllowed, useSubscription } from "@/hooks/useSubscription";
import {
  goalTypeLabels,
  periodLabels,
  type GoalWithProgress,
  type GoalType,
  type GoalPeriod,
} from "@/lib/goals";
import { GoalCard, type EditData } from "@/components/goals/GoalCard";
import { GoalDetailDialog } from "@/components/goals/GoalDetailDialog";
import { BulkCreateGoalsDialog } from "@/components/goals/BulkCreateGoalsDialog";
import { GoalCreateWizard } from "@/components/goals/GoalCreateWizard";
import { GoalAchievementsSection } from "@/components/goals/GoalAchievementsSection";
import { GoalSuggestionsAdminSection } from "@/components/goals/GoalSuggestionsAdminSection";

interface Profile {
  id: string;
  full_name: string;
  user_id?: string;
}

interface Product {
  id: string;
  name: string;
}

interface GoalTemplate {
  id: string;
  name: string;
  goal_type: string;
  target_value: number;
  period: string;
}

type SortOption = "progress_desc" | "progress_asc" | "name" | "days_remaining";

export default function Metas() {
  const { profile, isAdmin } = useAuth();
  const navigate = useNavigate();
  const { enabled: simpleModeEnabled } = useSimpleMode(profile?.tenant_id);
  const { status: subscription } = useSubscription();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAdvancedBlocked, setIsAdvancedBlocked] = useState(false);
  const [advancedBlockedMessage, setAdvancedBlockedMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("progress_desc");
  const [detailGoal, setDetailGoal] = useState<GoalWithProgress | null>(null);
  const [bulkCreateOpen, setBulkCreateOpen] = useState(false);
  const [templates, setTemplates] = useState<GoalTemplate[]>([]);
  const [createMode, setCreateMode] = useState<"quick" | "wizard">("quick");
  const [formData, setFormData] = useState({
    name: "",
    goal_type: "revenue" as GoalType,
    target_value: "",
    period: "monthly" as GoalPeriod,
    professional_id: "" as string | null,
    product_id: "" as string | null,
    show_in_header: false,
  });
  const [tabValue, setTabValue] = useState("all");

  const fetchData = async (includeArchived = false) => {
    if (!profile?.tenant_id || !isAdmin) return;

    try {
      setIsAdvancedBlocked(false);
      setAdvancedBlockedMessage(null);

      if (!isAdvancedReportsAllowed(subscription.plan)) {
        setIsAdvancedBlocked(true);
        setAdvancedBlockedMessage(
          "Relatórios avançados disponíveis apenas nos planos Pro e Premium. Faça upgrade em Assinatura para liberar."
        );
        setGoals([]);
        setProfessionals([]);
        setProducts([]);
        setTemplates([]);
        return;
      }

      const [goalsRes, profilesRes, productsRes, templatesRes] = await Promise.all([
        getGoalsWithProgress({
          p_tenant_id: profile.tenant_id,
          p_include_archived: includeArchived,
        }),
        supabase
          .from("profiles")
          .select("id, full_name, user_id")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("products")
          .select("id, name")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
        supabase.from("goal_templates").select("id, name, goal_type, target_value, period").eq("tenant_id", profile.tenant_id),
      ]);

      if (goalsRes.error) throw goalsRes.error;
      setGoals((goalsRes.data as GoalWithProgress[]) || []);
      setProfessionals((profilesRes.data as Profile[]) || []);
      setProducts((productsRes.data as Product[]) || []);
      setTemplates((templatesRes.data as GoalTemplate[]) || []);
    } catch (e: unknown) {
      const msg = (e as { message?: string })?.message;
      if (typeof msg === "string" && msg.toLowerCase().includes("relatórios avançados")) {
        setIsAdvancedBlocked(true);
        setAdvancedBlockedMessage(msg);
        setGoals([]);
        setProfessionals([]);
        setProducts([]);
        setTemplates([]);
        return;
      }
      logger.error("Error fetching metas:", e);
      toast.error("Erro ao carregar metas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchData(showArchived);
    }
  }, [profile?.tenant_id, isAdmin, showArchived, subscription.plan]);

  useEffect(() => {
    if (simpleModeEnabled) {
      setCreateMode("quick");
      setBulkCreateOpen(false);
    }
  }, [simpleModeEnabled]);


  const formatValue = (g: GoalWithProgress) => {
    if (g.goal_type === "revenue" || g.goal_type === "product_revenue" || g.goal_type === "ticket_medio")
      return `${formatCurrency(g.current_value)} / ${formatCurrency(g.target_value)}`;
    return `${Math.round(g.current_value)} / ${g.target_value}`;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    const target = parseFloat(formData.target_value);
    if (isNaN(target) || target <= 0) {
      toast.error("Informe um valor de meta válido");
      return;
    }

    setIsSaving(true);
    try {
      const { error } = await createGoalV2({
        p_name: formData.name.trim() || `Meta ${goalTypeLabels[formData.goal_type]}`,
        p_goal_type: formData.goal_type,
        p_target_value: target,
        p_period: formData.period,
        p_professional_id: formData.professional_id || null,
        p_product_id: formData.product_id || null,
        p_show_in_header: formData.show_in_header,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao criar meta");
        return;
      }
      toast.success("Meta criada!");
      setIsDialogOpen(false);
      setFormData({
        name: "",
        goal_type: "revenue",
        target_value: "",
        period: "monthly",
        professional_id: "",
        product_id: "",
        show_in_header: false,
      });
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error((_e as { message?: string })?.message || "Erro ao criar meta");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (goal: GoalWithProgress, data: EditData) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await updateGoalV2({
        p_goal_id: goal.id,
        p_name: data.name,
        p_target_value: data.target_value,
        p_period: data.period,
        p_professional_id: data.professional_id || null,
        p_product_id: data.product_id || null,
        p_show_in_header: data.show_in_header,
        p_header_priority: goal.header_priority ?? null,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao atualizar meta");
        throw error;
      }
      toast.success("Meta atualizada!");
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error((_e as { message?: string })?.message || "Erro ao atualizar meta");
      throw _e;
    }
  };

  const handleArchive = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await archiveGoalV2({
        p_goal_id: goal.id,
        p_archived: true,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao arquivar meta");
        return;
      }
      toast.success("Meta arquivada");
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error("Erro ao arquivar meta");
    }
  };

  const handleDuplicate = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await createGoalV2({
        p_name: `${goal.name} (cópia)`,
        p_goal_type: String(goal.goal_type),
        p_target_value: goal.target_value,
        p_period: String(goal.period),
        p_professional_id: goal.professional_id,
        p_product_id: goal.product_id,
        p_show_in_header: false,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao duplicar meta");
        return;
      }
      toast.success("Meta duplicada!");
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error("Erro ao duplicar meta");
    }
  };

  const handleBulkCreate = async (params: {
    goal_type: GoalType;
    target_value: number;
    period: GoalPeriod;
    professionalIds: string[];
  }) => {
    if (!profile?.tenant_id) return;

    try {
      for (const profId of params.professionalIds) {
        const prof = professionals.find((p) => p.id === profId);
        const { error } = await createGoalV2({
          p_name: `Meta ${goalTypeLabels[params.goal_type]} - ${prof?.full_name || "Profissional"}`,
          p_goal_type: params.goal_type,
          p_target_value: params.target_value,
          p_period: params.period,
          p_professional_id: profId,
          p_product_id: null,
          p_show_in_header: false,
        });
        if (error) {
          toastRpcError(toast, error as any, "Erro ao criar metas");
          throw error;
        }
      }
      toast.success(`${params.professionalIds.length} meta(s) criada(s)!`);
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error((_e as { message?: string })?.message || "Erro ao criar metas");
      throw _e;
    }
  };

  const handleExportCsv = () => {
    const headers = [
      "Nome",
      "Tipo",
      "Período",
      "Meta",
      "Atual",
      "Progresso %",
      "Dias restantes",
      "Projeção",
    ];
    const rows = activeGoals.map((g) => {
      const prof = professionals.find((p) => p.id === g.professional_id);
      const prod = products.find((p) => p.id === g.product_id);
      const name = [g.name, prof?.full_name, prod?.name].filter(Boolean).join(" · ");
      const type = goalTypeLabels[g.goal_type as GoalType];
      const period = periodLabels[g.period as GoalPeriod];
      const target = String(g.target_value).replace(".", ",");
      const current = String(g.current_value).replace(".", ",");
      const progress = String(Math.round(g.progress_pct)).replace(".", ",");
      const days = g.days_remaining != null ? String(g.days_remaining) : "";
      const projected = g.projected_reach || "";
      return [name, type, period, target, current, progress, days, projected].join(";");
    });
    const csvContent = [headers.join(";"), ...rows].join("\n");
    const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `metas-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("CSV exportado!");
  };

  const handleSaveAsTemplate = async () => {
    if (!profile?.tenant_id) return;
    const target = parseFloat(formData.target_value);
    if (isNaN(target) || target <= 0) {
      toast.error("Preencha o valor da meta antes de salvar como template");
      return;
    }
    try {
      const { error } = await createGoalTemplateV2({
        p_name: formData.name.trim() || `Template ${goalTypeLabels[formData.goal_type]}`,
        p_goal_type: formData.goal_type,
        p_target_value: target,
        p_period: formData.period,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao salvar template");
        return;
      }
      toast.success("Template salvo!");
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error("Erro ao salvar template");
    }
  };

  const handleLoadTemplate = (template: GoalTemplate) => {
    setFormData({
      name: template.name,
      goal_type: template.goal_type as GoalType,
      target_value: String(template.target_value),
      period: template.period as GoalPeriod,
      professional_id: null,
      product_id: null,
      show_in_header: false,
    });
  };

  const handleToggleHeader = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    const newVal = !goal.show_in_header;
    try {
      if (newVal) {
        const maxPriority = goals
          .filter((g) => g.show_in_header || (g.header_priority ?? 0) > 0)
          .reduce((max, g) => Math.max(max, g.header_priority ?? 0), 0);
        const { error } = await updateGoalV2({
          p_goal_id: goal.id,
          p_name: goal.name,
          p_target_value: goal.target_value,
          p_period: String(goal.period),
          p_professional_id: goal.professional_id,
          p_product_id: goal.product_id,
          p_show_in_header: true,
          p_header_priority: maxPriority + 1,
        });
        if (error) throw error;
      } else {
        const { error } = await updateGoalV2({
          p_goal_id: goal.id,
          p_name: goal.name,
          p_target_value: goal.target_value,
          p_period: String(goal.period),
          p_professional_id: goal.professional_id,
          p_product_id: goal.product_id,
          p_show_in_header: false,
          p_header_priority: 0,
        });
        if (error) throw error;
      }
      toast.success(newVal ? "Meta exibida no cabeçalho" : "Meta removida do cabeçalho");
      fetchData(showArchived);
    } catch (_e: unknown) {
      toast.error("Erro ao atualizar");
    }
  };

  // Memoizar filtros para evitar recálculos desnecessários
  const { activeGoals, archivedGoals, goalsToShow, generalGoals, productGoals, professionalGoals } = useMemo(() => {
    const active = goals.filter((g) => !g.archived_at);
    const archived = goals.filter((g) => g.archived_at);
    const toShow = showArchived ? archived : active;

    // Metas gerais: sem profissional E sem produto
    const general = toShow.filter((g) => !g.professional_id && !g.product_id);
    
    // Metas de produtos: tem product_id OU é tipo de meta de produto
    const products = toShow.filter(
      (g) => g.product_id || g.goal_type === "product_quantity" || g.goal_type === "product_revenue"
    );
    
    // Metas de profissionais: tem professional_id (mesmo que também tenha product_id)
    const professionals = toShow.filter((g) => g.professional_id);


    return {
      activeGoals: active,
      archivedGoals: archived,
      goalsToShow: toShow,
      generalGoals: general,
      productGoals: products,
      professionalGoals: professionals,
    };
  }, [goals, showArchived]);

  const filterAndSort = (list: GoalWithProgress[]) => {
    let filtered = list;
    if (search.trim()) {
      const q = search.toLowerCase().trim();
      filtered = filtered.filter(
        (g) =>
          g.name.toLowerCase().includes(q) ||
          (g.professional_id &&
            professionals.find((p) => p.id === g.professional_id)?.full_name.toLowerCase().includes(q)) ||
          (g.product_id &&
            products.find((p) => p.id === g.product_id)?.name.toLowerCase().includes(q))
      );
    }

    const sorted = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case "progress_desc":
          return b.progress_pct - a.progress_pct;
        case "progress_asc":
          return a.progress_pct - b.progress_pct;
        case "name":
          return a.name.localeCompare(b.name);
        case "days_remaining":
          return (a.days_remaining ?? 999) - (b.days_remaining ?? 999);
        default:
          return 0;
      }
    });
    return sorted;
  };

  const kpiCompleted = activeGoals.filter((g) => g.progress_pct >= 100).length;
  const kpiOnTrack = activeGoals.filter(
    (g) => g.progress_pct < 100 && g.projected_reach === "No prazo"
  ).length;
  const kpiAtRisk = activeGoals.filter(
    (g) => g.progress_pct < 100 && (g.projected_reach === "Atenção" || g.projected_reach === "Atrasado")
  ).length;

  const renderGoalCard = (g: GoalWithProgress) => (
    <GoalCard
      key={g.id}
      goal={g}
      professionals={professionals}
      products={products}
      formatCurrency={formatCurrency}
      formatValue={formatValue}
      onToggleHeader={handleToggleHeader}
      onArchive={handleArchive}
      onDuplicate={handleDuplicate}
      onEdit={handleEdit}
      onViewDetail={(goal) => setDetailGoal(goal)}
    />
  );

  if (!isAdmin) {
    return (
      <MainLayout title="Metas" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Target className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Apenas administradores podem gerenciar metas</p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  if (isAdvancedBlocked) {
    return (
      <MainLayout
        title="Metas"
        subtitle="Relatórios avançados"
      >
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <BarChart3 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="font-medium">Este recurso está disponível apenas nos planos Pro e Premium</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-[520px]">
              {advancedBlockedMessage || "Faça upgrade em Assinatura para liberar relatórios avançados."}
            </p>
            <div className="mt-6 flex flex-wrap gap-2 justify-center">
              <Button className="gradient-primary text-primary-foreground" onClick={() => navigate("/assinatura")} data-tour="goals-advanced-blocked-upgrade">
                Ver planos
              </Button>
              <Button variant="outline" onClick={() => fetchData(showArchived)} data-tour="goals-advanced-blocked-retry">
                Tentar novamente
              </Button>
            </div>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Metas"
      subtitle="Defina metas, aprove sugestões dos profissionais e acompanhe o desempenho"
      actions={
        <div className="flex flex-wrap gap-2 justify-end">
          {!simpleModeEnabled ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportCsv}
              disabled={isLoading || activeGoals.length === 0}
              data-tour="goals-export-csv"
            >
              <Download className="mr-2 h-4 w-4" />
              Exportar CSV
            </Button>
          ) : null}
          {!simpleModeEnabled ? (
            <Button variant="outline" size="sm" onClick={() => setBulkCreateOpen(true)} data-tour="goals-bulk-create">
              <CopyPlus className="mr-2 h-4 w-4" />
              Criar em lote
            </Button>
          ) : null}
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" data-tour="goals-new-goal">
              <Plus className="mr-2 h-4 w-4" />
              Nova Meta
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Nova meta</DialogTitle>
              <DialogDescription>
                Crie uma meta para o salão, produtos ou profissionais
              </DialogDescription>
            </DialogHeader>
            <Tabs
              value={createMode}
              onValueChange={(v) => setCreateMode(v as "quick" | "wizard")}
              className="w-full"
            >
              {!simpleModeEnabled ? (
                <TabsList className="grid w-full grid-cols-2 mb-4">
                  <TabsTrigger value="quick">Rápido</TabsTrigger>
                  <TabsTrigger value="wizard">Assistente</TabsTrigger>
                </TabsList>
              ) : null}
              {!simpleModeEnabled ? (
                <TabsContent value="wizard" className="mt-0">
                  <GoalCreateWizard
                    professionals={professionals}
                    products={products}
                    formData={formData}
                    onFormChange={(d) => setFormData((prev) => ({ ...prev, ...d }))}
                    onSubmit={handleCreate}
                    isSaving={isSaving}
                  />
                </TabsContent>
              ) : null}
              <TabsContent value="quick" className="mt-0">
            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <Label>Nome (opcional)</Label>
                <Input
                  placeholder="Ex: Receita do mês"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Tipo de meta</Label>
                <Select
                  value={formData.goal_type}
                  onValueChange={(v) => setFormData({ ...formData, goal_type: v as GoalType })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(goalTypeLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor da meta</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={
                    formData.goal_type.includes("revenue") || formData.goal_type === "ticket_medio"
                      ? "0,00"
                      : "0"
                  }
                  value={formData.target_value}
                  onChange={(e) => setFormData({ ...formData, target_value: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>Período</Label>
                <Select
                  value={formData.period}
                  onValueChange={(v) => setFormData({ ...formData, period: v as GoalPeriod })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(periodLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>
                        {v}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {(formData.goal_type === "revenue" ||
                formData.goal_type === "services_count" ||
                formData.goal_type === "clientes_novos" ||
                formData.goal_type === "ticket_medio") && (
                <div>
                  <Label>Direcionar para profissional (opcional)</Label>
                  <Select
                    value={formData.professional_id || "all"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, professional_id: v === "all" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Salão todo" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Salão todo</SelectItem>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {(formData.goal_type === "product_quantity" ||
                formData.goal_type === "product_revenue") && (
                <div>
                  <Label>Produto (opcional)</Label>
                  <Select
                    value={formData.product_id || "all"}
                    onValueChange={(v) =>
                      setFormData({ ...formData, product_id: v === "all" ? "" : v })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Todos os produtos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os produtos</SelectItem>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="show_in_header"
                  checked={formData.show_in_header}
                  onChange={(e) =>
                    setFormData({ ...formData, show_in_header: e.target.checked })
                  }
                  className="rounded"
                />
                <Label htmlFor="show_in_header" className="cursor-pointer">
                  Exibir barra de progresso no cabeçalho
                </Label>
              </div>
              {!simpleModeEnabled && templates.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Carregar de template</Label>
                  <div className="flex flex-wrap gap-2">
                    {templates.map((t) => (
                      <Button
                        key={t.id}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="gap-1"
                        onClick={() => handleLoadTemplate(t)}
                        data-tour="goals-load-template"
                      >
                        <FileText className="h-3 w-3" />
                        {t.name}
                      </Button>
                    ))}
                  </div>
                </div>
              )}
              <DialogFooter className="flex-col sm:flex-row gap-2">
                <div className="flex-1 flex justify-start">
                  {!simpleModeEnabled && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleSaveAsTemplate}
                      disabled={isSaving || !formData.target_value}
                      data-tour="goals-save-as-template"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Salvar como template
                    </Button>
                  )}
                </div>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsDialogOpen(false)}
                    data-tour="goals-create-cancel"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="gradient-primary text-primary-foreground"
                    data-tour="goals-create-submit"
                  >
                    {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar meta"}
                  </Button>
                </div>
              </DialogFooter>
            </form>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
        </div>
      }
    >
      {/* KPI Cards */}
      {!isLoading && activeGoals.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="border-green-500/30 bg-green-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Target className="h-5 w-5 text-green-600" />
                <span className="text-sm font-medium text-muted-foreground">
                  Metas concluídas
                </span>
              </div>
              <p className="text-2xl font-bold text-green-600 mt-1">{kpiCompleted}</p>
            </CardContent>
          </Card>
          <Card className="border-primary/30 bg-primary/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium text-muted-foreground">No prazo</span>
              </div>
              <p className="text-2xl font-bold text-primary mt-1">{kpiOnTrack}</p>
            </CardContent>
          </Card>
          <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-medium text-muted-foreground">Em risco</span>
              </div>
              <p className="text-2xl font-bold text-amber-600 mt-1">{kpiAtRisk}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-4">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-muted-foreground" />
                <span className="text-sm font-medium text-muted-foreground">Total ativas</span>
              </div>
              <p className="text-2xl font-bold mt-1">{activeGoals.length}</p>
            </CardContent>
          </Card>
        </div>
      )}

      {!simpleModeEnabled && !isLoading && profile?.tenant_id && (
        <div className="mb-6">
          <GoalSuggestionsAdminSection
            tenantId={profile.tenant_id}
            professionals={professionals}
            onApprovedOrRejected={() => fetchData(showArchived)}
            showEmptyState
          />
        </div>
      )}

      {!simpleModeEnabled && !isLoading && kpiCompleted > 0 && (
        <div className="mb-6">
          <GoalAchievementsSection
            completedGoals={activeGoals.filter((g) => g.progress_pct >= 100)}
            professionals={professionals}
            tenantId={profile!.tenant_id!}
          />
        </div>
      )}

      {/* Busca e ordenação */}
      {!isLoading && activeGoals.length > 0 && (
        <div className="flex flex-col sm:flex-row gap-4 mb-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, profissional ou produto..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <ArrowUpDown className="h-4 w-4 mr-2" />
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="progress_desc">Maior progresso</SelectItem>
              <SelectItem value="progress_asc">Menor progresso</SelectItem>
              <SelectItem value="name">Nome</SelectItem>
              <SelectItem value="days_remaining">Dias restantes</SelectItem>
            </SelectContent>
          </Select>
          <Button
            variant={showArchived ? "default" : "outline"}
            onClick={() => setShowArchived(!showArchived)}
            className="shrink-0"
          >
            <Archive className="h-4 w-4 mr-2" />
            Arquivadas ({archivedGoals.length})
          </Button>
        </div>
      )}

      {/* Abas de filtro: implementação customizada (sem Radix Tabs) para garantir troca de conteúdo */}
      <div className="space-y-4">
        <div
          role="tablist"
          className="inline-flex h-10 items-center justify-center rounded-md bg-muted p-1 text-muted-foreground w-full"
        >
          <button
            role="tab"
            aria-selected={tabValue === "all"}
            onClick={() => setTabValue("all")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2 flex-1 ${
              tabValue === "all" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            <BarChart3 className="h-4 w-4" />
            Todas
          </button>
          <button
            role="tab"
            aria-selected={tabValue === "general"}
            onClick={() => setTabValue("general")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2 flex-1 ${
              tabValue === "general" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            <TrendingUp className="h-4 w-4" />
            Gerais
          </button>
          <button
            role="tab"
            aria-selected={tabValue === "products"}
            onClick={() => setTabValue("products")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2 flex-1 ${
              tabValue === "products" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            <Package className="h-4 w-4" />
            Produtos
          </button>
          <button
            role="tab"
            aria-selected={tabValue === "professionals"}
            onClick={() => setTabValue("professionals")}
            className={`inline-flex items-center justify-center whitespace-nowrap rounded-sm px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 gap-2 flex-1 ${
              tabValue === "professionals" ? "bg-background text-foreground shadow-sm" : ""
            }`}
          >
            <Users className="h-4 w-4" />
            Profissionais
          </button>
        </div>

        {isLoading ? (
          <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        ) : (
          <div className="mt-4" role="tabpanel" key={`tabpanel-${tabValue}`}>
            {tabValue === "all" && (
              goalsToShow.length === 0 ? (
                <Card key="empty-all">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
                    <p className="text-muted-foreground mb-2">
                      {showArchived ? "Nenhuma meta arquivada" : "Nenhuma meta criada"}
                    </p>
                    {!showArchived && (
                      <Button
                        onClick={() => setIsDialogOpen(true)}
                        className="gradient-primary text-primary-foreground"
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Criar primeira meta
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <div key="content-all" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterAndSort(goalsToShow).map(renderGoalCard)}
                </div>
              )
            )}

            {tabValue === "general" && (
              generalGoals.length === 0 ? (
                <Card key="empty-general">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma meta geral</p>
                  </CardContent>
                </Card>
              ) : (
                <div key="content-general" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterAndSort(generalGoals).map(renderGoalCard)}
                </div>
              )
            )}

            {tabValue === "products" && (
              productGoals.length === 0 ? (
                <Card key="empty-products">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma meta de produtos</p>
                  </CardContent>
                </Card>
              ) : (
                <div key="content-products" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterAndSort(productGoals).map(renderGoalCard)}
                </div>
              )
            )}

            {tabValue === "professionals" && (
              professionalGoals.length === 0 ? (
                <Card key="empty-professionals">
                  <CardContent className="flex flex-col items-center justify-center py-16">
                    <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
                    <p className="text-muted-foreground">Nenhuma meta por profissional</p>
                  </CardContent>
                </Card>
              ) : (
                <div key="content-professionals" className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filterAndSort(professionalGoals).map(renderGoalCard)}
                </div>
              )
            )}
          </div>
        )}
      </div>

      {detailGoal && profile?.tenant_id && (
        <GoalDetailDialog
          goal={detailGoal}
          tenantId={profile.tenant_id}
          formatValue={formatValue}
          onClose={() => setDetailGoal(null)}
        />
      )}

      {!simpleModeEnabled ? (
        <BulkCreateGoalsDialog
          open={bulkCreateOpen}
          onOpenChange={setBulkCreateOpen}
          professionals={professionals}
          products={products}
          isSaving={isSaving}
          onCreate={handleBulkCreate}
        />
      ) : null}
    </MainLayout>
  );
}
