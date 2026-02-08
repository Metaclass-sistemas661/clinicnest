import { useState, useEffect } from "react";
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
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const fetchData = async (includeArchived = false) => {
    if (!profile?.tenant_id || !isAdmin) return;

    try {
      const [goalsRes, profilesRes, productsRes, templatesRes] = await Promise.all([
        supabase.rpc("get_goals_with_progress", {
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
      console.error(e);
      toast.error("Erro ao carregar metas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchData(showArchived);
    }
  }, [profile?.tenant_id, isAdmin, showArchived]);

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
      const { error } = await supabase.from("goals").insert({
        tenant_id: profile.tenant_id,
        name: formData.name.trim() || `Meta ${goalTypeLabels[formData.goal_type]}`,
        goal_type: formData.goal_type,
        target_value: target,
        period: formData.period,
        professional_id: formData.professional_id || null,
        product_id: formData.product_id || null,
        show_in_header: formData.show_in_header,
      });

      if (error) throw error;
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
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || "Erro ao criar meta");
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = async (goal: GoalWithProgress, data: EditData) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from("goals")
        .update({
          name: data.name,
          target_value: data.target_value,
          period: data.period,
          professional_id: data.professional_id || null,
          product_id: data.product_id || null,
          show_in_header: data.show_in_header,
          updated_at: new Date().toISOString(),
        })
        .eq("id", goal.id);

      if (error) throw error;
      toast.success("Meta atualizada!");
      fetchData(showArchived);
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || "Erro ao atualizar meta");
      throw e;
    }
  };

  const handleArchive = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from("goals")
        .update({ archived_at: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("id", goal.id);

      if (error) throw error;
      toast.success("Meta arquivada");
      fetchData(showArchived);
    } catch (e: unknown) {
      toast.error("Erro ao arquivar meta");
    }
  };

  const handleDuplicate = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase.from("goals").insert({
        tenant_id: profile.tenant_id,
        name: `${goal.name} (cópia)`,
        goal_type: goal.goal_type,
        target_value: goal.target_value,
        period: goal.period,
        professional_id: goal.professional_id,
        product_id: goal.product_id,
        show_in_header: false,
      });

      if (error) throw error;
      toast.success("Meta duplicada!");
      fetchData(showArchived);
    } catch (e: unknown) {
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
      const inserts = params.professionalIds.map((profId) => {
        const prof = professionals.find((p) => p.id === profId);
        return {
          tenant_id: profile.tenant_id,
          name: `Meta ${goalTypeLabels[params.goal_type]} - ${prof?.full_name || "Profissional"}`,
          goal_type: params.goal_type,
          target_value: params.target_value,
          period: params.period,
          professional_id: profId,
          product_id: null,
          show_in_header: false,
        };
      });
      const { error } = await supabase.from("goals").insert(inserts);
      if (error) throw error;
      toast.success(`${inserts.length} meta(s) criada(s)!`);
      fetchData(showArchived);
    } catch (e: unknown) {
      toast.error((e as { message?: string })?.message || "Erro ao criar metas");
      throw e;
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
      const { error } = await supabase.from("goal_templates").insert({
        tenant_id: profile.tenant_id,
        name: formData.name.trim() || `Template ${goalTypeLabels[formData.goal_type]}`,
        goal_type: formData.goal_type,
        target_value: target,
        period: formData.period,
      });
      if (error) throw error;
      toast.success("Template salvo!");
      fetchData(showArchived);
    } catch (e: unknown) {
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
        const { error } = await supabase
          .from("goals")
          .update({ show_in_header: true, header_priority: maxPriority + 1 })
          .eq("id", goal.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("goals")
          .update({ show_in_header: false, header_priority: 0 })
          .eq("id", goal.id);
        if (error) throw error;
      }
      toast.success(newVal ? "Meta exibida no cabeçalho" : "Meta removida do cabeçalho");
      fetchData(showArchived);
    } catch (e: unknown) {
      toast.error("Erro ao atualizar");
    }
  };

  const activeGoals = goals.filter((g) => !g.archived_at);
  const archivedGoals = goals.filter((g) => g.archived_at);

  const goalsToShow = showArchived ? archivedGoals : activeGoals;

  const generalGoals = goalsToShow.filter((g) => !g.professional_id && !g.product_id);
  const productGoals = goalsToShow.filter(
    (g) => g.product_id || g.goal_type === "product_quantity" || g.goal_type === "product_revenue"
  );
  const professionalGoals = goalsToShow.filter((g) => g.professional_id);

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

  return (
    <MainLayout
      title="Metas"
      subtitle="Defina metas, aprove sugestões dos profissionais e acompanhe o desempenho"
      actions={
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportCsv}
            disabled={isLoading || activeGoals.length === 0}
          >
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Button variant="outline" size="sm" onClick={() => setBulkCreateOpen(true)}>
            <CopyPlus className="mr-2 h-4 w-4" />
            Criar em lote
          </Button>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground">
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
              <TabsList className="grid w-full grid-cols-2 mb-4">
                <TabsTrigger value="quick">Rápido</TabsTrigger>
                <TabsTrigger value="wizard">Assistente</TabsTrigger>
              </TabsList>
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
              {templates.length > 0 && (
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleSaveAsTemplate}
                    disabled={isSaving || !formData.target_value}
                  >
                    <FileText className="h-4 w-4 mr-2" />
                    Salvar como template
                  </Button>
                </div>
                <div className="flex gap-2">
                  <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    disabled={isSaving}
                    className="gradient-primary text-primary-foreground"
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

      {!isLoading && profile?.tenant_id && (
        <div className="mb-6">
          <GoalSuggestionsAdminSection
            tenantId={profile.tenant_id}
            professionals={professionals}
            onApprovedOrRejected={() => fetchData(showArchived)}
            showEmptyState
          />
        </div>
      )}

      {!isLoading && kpiCompleted > 0 && (
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

      <Tabs value={tabValue} onValueChange={setTabValue} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            Todas
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Gerais
          </TabsTrigger>
          <TabsTrigger value="products" className="gap-2">
            <Package className="h-4 w-4" />
            Produtos
          </TabsTrigger>
          <TabsTrigger value="professionals" className="gap-2">
            <Users className="h-4 w-4" />
            Profissionais
          </TabsTrigger>
        </TabsList>

        {/* Conteúdo renderizado condicionalmente (evita problema do Radix TabsContent não exibir ao trocar) */}
        <div className="mt-4">
          {tabValue === "all" &&
            (isLoading ? (
              <div className="grid gap-4 md:grid-cols-2">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-32" />
                ))}
              </div>
            ) : goalsToShow.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16">
                  <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-2">
                    {showArchived
                      ? "Nenhuma meta arquivada"
                      : "Nenhuma meta criada"}
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
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filterAndSort(goalsToShow).map(renderGoalCard)}
              </div>
            ))}

          {tabValue === "general" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {generalGoals.length === 0 && !isLoading && (
                <p className="col-span-full text-muted-foreground">Nenhuma meta geral</p>
              )}
              {filterAndSort(generalGoals).map(renderGoalCard)}
            </div>
          )}

          {tabValue === "products" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {productGoals.length === 0 && !isLoading && (
                <p className="col-span-full text-muted-foreground">Nenhuma meta de produtos</p>
              )}
              {filterAndSort(productGoals).map(renderGoalCard)}
            </div>
          )}

          {tabValue === "professionals" && (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {professionalGoals.length === 0 && !isLoading && (
                <p className="col-span-full text-muted-foreground">
                  Nenhuma meta por profissional
                </p>
              )}
              {filterAndSort(professionalGoals).map(renderGoalCard)}
            </div>
          )}
        </div>
      </Tabs>

      {detailGoal && profile?.tenant_id && (
        <GoalDetailDialog
          goal={detailGoal}
          tenantId={profile.tenant_id}
          formatValue={formatValue}
          onClose={() => setDetailGoal(null)}
        />
      )}

      <BulkCreateGoalsDialog
        open={bulkCreateOpen}
        onOpenChange={setBulkCreateOpen}
        professionals={professionals}
        onConfirm={handleBulkCreate}
      />
    </MainLayout>
  );
}
