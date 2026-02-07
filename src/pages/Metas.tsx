import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  Star,
} from "lucide-react";
import { toast } from "sonner";

type GoalType = "revenue" | "services_count" | "product_quantity" | "product_revenue";
type GoalPeriod = "weekly" | "monthly" | "yearly";

interface GoalWithProgress {
  id: string;
  name: string;
  goal_type: GoalType;
  target_value: number;
  period: GoalPeriod;
  professional_id: string | null;
  product_id: string | null;
  show_in_header: boolean;
  current_value: number;
  progress_pct: number;
}

interface Profile {
  id: string;
  full_name: string;
}

interface Product {
  id: string;
  name: string;
}

const goalTypeLabels: Record<GoalType, string> = {
  revenue: "Receita",
  services_count: "Serviços concluídos",
  product_quantity: "Quantidade vendida (produtos)",
  product_revenue: "Receita de produtos",
};

const periodLabels: Record<GoalPeriod, string> = {
  weekly: "Semanal",
  monthly: "Mensal",
  yearly: "Anual",
};

export default function Metas() {
  const { profile, isAdmin } = useAuth();
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    goal_type: "revenue" as GoalType,
    target_value: "",
    period: "monthly" as GoalPeriod,
    professional_id: "" as string | null,
    product_id: "" as string | null,
    show_in_header: false,
  });

  const formatCurrency = (v: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(v);

  const fetchData = async () => {
    if (!profile?.tenant_id || !isAdmin) return;

    try {
      const [goalsRes, profilesRes, productsRes] = await Promise.all([
        supabase.rpc("get_goals_with_progress", { p_tenant_id: profile.tenant_id }),
        supabase
          .from("profiles")
          .select("id, full_name")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("products")
          .select("id, name")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
      ]);

      if (goalsRes.error) throw goalsRes.error;
      setGoals((goalsRes.data as GoalWithProgress[]) || []);
      setProfessionals((profilesRes.data as Profile[]) || []);
      setProducts((productsRes.data as Product[]) || []);
    } catch (e: any) {
      console.error(e);
      toast.error("Erro ao carregar metas");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) fetchData();
  }, [profile?.tenant_id, isAdmin]);

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
      fetchData();
    } catch (e: any) {
      toast.error(e?.message || "Erro ao criar meta");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleHeader = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    const newVal = !goal.show_in_header;
    try {
      if (newVal) {
        await supabase
          .from("goals")
          .update({ show_in_header: false })
          .eq("tenant_id", profile.tenant_id);
      }
      const { error } = await supabase
        .from("goals")
        .update({ show_in_header: newVal })
        .eq("id", goal.id);

      if (error) throw error;
      toast.success(newVal ? "Meta exibida no cabeçalho" : "Meta removida do cabeçalho");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao atualizar");
    }
  };

  const handleToggleActive = async (goal: GoalWithProgress) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from("goals")
        .update({ is_active: false })
        .eq("id", goal.id);

      if (error) throw error;
      toast.success("Meta desativada");
      fetchData();
    } catch (e: any) {
      toast.error("Erro ao desativar");
    }
  };

  const formatValue = (g: GoalWithProgress) => {
    if (g.goal_type === "revenue" || g.goal_type === "product_revenue")
      return `${formatCurrency(g.current_value)} / ${formatCurrency(g.target_value)}`;
    return `${g.current_value} / ${g.target_value}`;
  };

  const generalGoals = goals.filter((g) => !g.professional_id && !g.product_id);
  const productGoals = goals.filter((g) => g.product_id || g.goal_type === "product_quantity" || g.goal_type === "product_revenue");
  const professionalGoals = goals.filter((g) => g.professional_id);

  const renderGoalCard = (g: GoalWithProgress) => (
    <Card key={g.id} className="overflow-hidden">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              {g.name}
              {g.show_in_header && (
                <Star className="h-4 w-4 text-primary fill-primary" title="Exibida no cabeçalho" />
              )}
            </CardTitle>
            <CardDescription>
              {goalTypeLabels[g.goal_type]} · {periodLabels[g.period]}
              {g.professional_id && (
                <> · {professionals.find((p) => p.id === g.professional_id)?.full_name || "Profissional"}</>
              )}
              {g.product_id && (
                <> · {products.find((p) => p.id === g.product_id)?.name || "Produto"}</>
              )}
            </CardDescription>
          </div>
          <div className="flex gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => handleToggleHeader(g)}
              title={g.show_in_header ? "Remover do cabeçalho" : "Exibir no cabeçalho"}
            >
              <Star className={`h-4 w-4 ${g.show_in_header ? "fill-primary text-primary" : ""}`} />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground" onClick={() => handleToggleActive(g)} title="Desativar">
              ×
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm font-medium">{formatValue(g)}</p>
        <Progress value={Math.min(100, g.progress_pct)} className="h-2" />
        <p className="text-xs text-muted-foreground">
          {g.progress_pct >= 100 ? "Meta concluída!" : `${Math.round(g.progress_pct)}%`}
        </p>
      </CardContent>
    </Card>
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
      subtitle="Defina e acompanhe as metas do salão"
      actions={
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
              <DialogDescription>Crie uma meta para o salão, produtos ou profissionais</DialogDescription>
            </DialogHeader>
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
                    <SelectItem value="revenue">{goalTypeLabels.revenue}</SelectItem>
                    <SelectItem value="services_count">{goalTypeLabels.services_count}</SelectItem>
                    <SelectItem value="product_quantity">{goalTypeLabels.product_quantity}</SelectItem>
                    <SelectItem value="product_revenue">{goalTypeLabels.product_revenue}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Valor da meta</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={formData.goal_type.includes("revenue") ? "0,00" : "0"}
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
                    <SelectItem value="weekly">{periodLabels.weekly}</SelectItem>
                    <SelectItem value="monthly">{periodLabels.monthly}</SelectItem>
                    <SelectItem value="yearly">{periodLabels.yearly}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {(formData.goal_type === "revenue" || formData.goal_type === "services_count") && (
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
              {(formData.goal_type === "product_quantity" || formData.goal_type === "product_revenue") && (
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
                  onChange={(e) => setFormData({ ...formData, show_in_header: e.target.checked })}
                  className="rounded"
                />
                <Label htmlFor="show_in_header" className="cursor-pointer">
                  Exibir barra de progresso no cabeçalho
                </Label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                  {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Criar meta"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Tabs defaultValue="all" className="space-y-4">
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

        <TabsContent value="all">
          {isLoading ? (
            <div className="grid gap-4 md:grid-cols-2">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-32" />
              ))}
            </div>
          ) : goals.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16">
                <Target className="mb-4 h-14 w-14 text-muted-foreground/50" />
                <p className="text-muted-foreground mb-2">Nenhuma meta criada</p>
                <Button onClick={() => setIsDialogOpen(true)} className="gradient-primary text-primary-foreground">
                  <Plus className="mr-2 h-4 w-4" />
                  Criar primeira meta
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {goals.map(renderGoalCard)}
            </div>
          )}
        </TabsContent>

        <TabsContent value="general">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {generalGoals.length === 0 && !isLoading && (
              <p className="col-span-full text-muted-foreground">Nenhuma meta geral</p>
            )}
            {generalGoals.map(renderGoalCard)}
          </div>
        </TabsContent>

        <TabsContent value="products">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {productGoals.length === 0 && !isLoading && (
              <p className="col-span-full text-muted-foreground">Nenhuma meta de produtos</p>
            )}
            {productGoals.map(renderGoalCard)}
          </div>
        </TabsContent>

        <TabsContent value="professionals">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {professionalGoals.length === 0 && !isLoading && (
              <p className="col-span-full text-muted-foreground">Nenhuma meta por profissional</p>
            )}
            {professionalGoals.map(renderGoalCard)}
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
