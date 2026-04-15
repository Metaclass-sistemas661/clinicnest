import { useState, useEffect, useCallback } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Settings2,
  Users,
  Wallet,
  Info,
} from "lucide-react";
import { CommissionRuleCard, type CommissionRule } from "@/components/commission/CommissionRuleCard";
import { CommissionRuleForm } from "@/components/commission/CommissionRuleForm";
import { CommissionSimulator } from "@/components/commission/CommissionSimulator";

interface Professional {
  user_id: string;
  full_name: string;
  email: string;
  professional_type: string;
}

export default function ConfigurarRegras() {
  const { profile, isAdmin } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [rules, setRules] = useState<CommissionRule[]>([]);
  const [activeTab, setActiveTab] = useState("rules");

  // Form state
  const [formOpen, setFormOpen] = useState(false);
  const [editingRule, setEditingRule] = useState<CommissionRule | null>(null);

  // Delete confirmation
  const [deleteRule, setDeleteRule] = useState<CommissionRule | null>(null);

  // Load professionals
  useEffect(() => {
    if (!profile?.tenant_id || !isAdmin) return;

    const loadProfessionals = async () => {
      try {
        const { data, error } = await api
          .from("profiles")
          .select("user_id, full_name, email, professional_type")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name");

        if (error) throw error;
        setProfessionals(data || []);

        // Check URL param for pre-selected professional
        const urlProfId = searchParams.get("professional");
        if (urlProfId && data?.some((p) => p.user_id === urlProfId)) {
          setSelectedProfessionalId(urlProfId);
        } else if (data && data.length > 0) {
          setSelectedProfessionalId(data[0].user_id);
        }
      } catch (error) {
        logger.error("Error loading professionals:", error);
        toast.error("Erro ao carregar profissionais");
      } finally {
        setIsLoading(false);
      }
    };

    loadProfessionals();
  }, [profile?.tenant_id, isAdmin, searchParams]);

  // Load rules for selected professional
  const loadRules = useCallback(async () => {
    if (!profile?.tenant_id || !selectedProfessionalId) return;

    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("commission_rules")
        .select(`
          *,
          procedure:procedures(name),
          insurance:insurance_plans(name)
        `)
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", selectedProfessionalId)
        .order("priority", { ascending: false });

      if (error) throw error;
      setRules((data as CommissionRule[]) || []);
    } catch (error) {
      logger.error("Error loading commission rules:", error);
      toast.error("Erro ao carregar regras de comissão");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, selectedProfessionalId]);

  useEffect(() => {
    loadRules();
  }, [loadRules]);

  // Update URL when professional changes
  useEffect(() => {
    if (selectedProfessionalId) {
      setSearchParams({ professional: selectedProfessionalId });
    }
  }, [selectedProfessionalId, setSearchParams]);

  const handleEdit = (rule: CommissionRule) => {
    setEditingRule(rule);
    setFormOpen(true);
  };

  const handleDelete = async () => {
    if (!deleteRule) return;

    try {
      const { error } = await api
        .from("commission_rules")
        .delete()
        .eq("id", deleteRule.id);

      if (error) throw error;
      toast.success("Regra excluída com sucesso!");
      loadRules();
    } catch (error) {
      logger.error("Error deleting rule:", error);
      toast.error("Erro ao excluir regra");
    } finally {
      setDeleteRule(null);
    }
  };

  const handleToggleActive = async (rule: CommissionRule, active: boolean) => {
    try {
      const { error } = await api
        .from("commission_rules")
        .update({ is_active: active })
        .eq("id", rule.id);

      if (error) throw error;
      toast.success(active ? "Regra ativada" : "Regra desativada");
      loadRules();
    } catch (error) {
      logger.error("Error toggling rule:", error);
      toast.error("Erro ao atualizar regra");
    }
  };

  const handleNewRule = () => {
    setEditingRule(null);
    setFormOpen(true);
  };

  const selectedProfessional = professionals.find((p) => p.user_id === selectedProfessionalId);

  const activeRulesCount = rules.filter((r) => r.is_active).length;
  const hasDefaultRule = rules.some((r) => r.rule_type === "default" && r.is_active);

  if (!isAdmin) {
    return (
      <MainLayout title="Configurar Regras" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings2 className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem configurar regras de comissão
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Configurar Regras de Comissão"
      subtitle="Defina regras granulares por convênio ou procedimento"
      actions={
        <Button variant="outline" asChild>
          <Link to="/repasses" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar para Repasses
          </Link>
        </Button>
      }
    >
      <div className="space-y-6">
        {/* Professional Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Users className="h-5 w-5" />
              Selecionar Profissional
            </CardTitle>
            <CardDescription>
              Escolha o profissional para configurar suas regras de comissão
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select
              value={selectedProfessionalId}
              onValueChange={setSelectedProfessionalId}
            >
              <SelectTrigger className="w-full sm:w-80">
                <SelectValue placeholder="Selecione um profissional" />
              </SelectTrigger>
              <SelectContent>
                {professionals.map((prof) => (
                  <SelectItem key={prof.user_id} value={prof.user_id}>
                    <div className="flex items-center gap-2">
                      <span>{prof.full_name || prof.email}</span>
                      {prof.professional_type && (
                        <Badge variant="outline" className="text-xs">
                          {prof.professional_type}
                        </Badge>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        {selectedProfessionalId && (
          <>
            {/* Stats */}
            <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Wallet className="h-4 w-4" />
                    Regras Ativas
                  </div>
                  <p className="text-2xl font-bold">{activeRulesCount}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Settings2 className="h-4 w-4" />
                    Total de Regras
                  </div>
                  <p className="text-2xl font-bold">{rules.length}</p>
                </CardContent>
              </Card>
              <Card className="col-span-2">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                    <Info className="h-4 w-4" />
                    Status
                  </div>
                  {hasDefaultRule ? (
                    <Badge variant="outline" className="bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300">
                      Regra padrão configurada
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300">
                      Sem regra padrão - configure uma!
                    </Badge>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Tabs */}
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList>
                <TabsTrigger value="rules" className="gap-2">
                  <Settings2 className="h-4 w-4" />
                  Regras
                </TabsTrigger>
                <TabsTrigger value="simulator" className="gap-2">
                  <Wallet className="h-4 w-4" />
                  Simulador
                </TabsTrigger>
              </TabsList>

              <TabsContent value="rules" className="mt-6 space-y-4">
                {/* Add Rule Button */}
                <div className="flex justify-end">
                  <Button onClick={handleNewRule} className="gap-2">
                    <Plus className="h-4 w-4" />
                    Adicionar Regra
                  </Button>
                </div>

                {/* Rules List */}
                {isLoading ? (
                  <div className="space-y-3">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : rules.length === 0 ? (
                  <EmptyState
                    icon={Settings2}
                    title="Nenhuma regra configurada"
                    description="Adicione regras de comissão para este profissional"
                    action={
                      <Button onClick={handleNewRule} className="gap-2">
                        <Plus className="h-4 w-4" />
                        Adicionar Primeira Regra
                      </Button>
                    }
                  />
                ) : (
                  <div className="space-y-3">
                    {rules.map((rule) => (
                      <CommissionRuleCard
                        key={rule.id}
                        rule={rule}
                        onEdit={handleEdit}
                        onDelete={setDeleteRule}
                        onToggleActive={handleToggleActive}
                      />
                    ))}
                  </div>
                )}

                {/* Info about priority */}
                {rules.length > 0 && (
                  <Card className="border-blue-200 bg-blue-50/50 dark:border-blue-800 dark:bg-blue-950/30">
                    <CardContent className="flex items-start gap-3 p-4">
                      <Info className="h-5 w-5 text-blue-600 mt-0.5 shrink-0" />
                      <div className="text-sm text-blue-700 dark:text-blue-300">
                        <p className="font-medium mb-1">Como funciona a prioridade?</p>
                        <p>
                          Quando um atendimento é concluído, o sistema busca a regra mais específica:
                        </p>
                        <ol className="list-decimal list-inside mt-2 space-y-1">
                          <li><strong>Procedimento TUSS</strong> (prioridade 30) - mais específica</li>
                          <li><strong>Procedimento</strong> (prioridade 20)</li>
                          <li><strong>Convênio</strong> (prioridade 10)</li>
                          <li><strong>Padrão</strong> (prioridade 0) - fallback</li>
                        </ol>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </TabsContent>

              <TabsContent value="simulator" className="mt-6">
                <CommissionSimulator
                  professionalId={selectedProfessionalId}
                  rules={rules}
                />
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>

      {/* Rule Form Sheet */}
      {selectedProfessional && (
        <CommissionRuleForm
          open={formOpen}
          onOpenChange={setFormOpen}
          professionalId={selectedProfessionalId}
          professionalName={selectedProfessional.full_name || selectedProfessional.email}
          rule={editingRule}
          onSave={loadRules}
        />
      )}

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteRule} onOpenChange={(open) => !open && setDeleteRule(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir Regra</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta regra de comissão?
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
