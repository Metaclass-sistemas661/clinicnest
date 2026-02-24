import { useState, useEffect, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { Save, RotateCcw, Shield, Check, X } from "lucide-react";
import { PROFESSIONAL_TYPE_LABELS, type ProfessionalType } from "@/types/database";

type PermissionAction = "view" | "create" | "edit" | "delete";

interface ResourcePermission {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
}

interface RoleTemplate {
  id: string;
  professional_type: ProfessionalType;
  name: string;
  permissions: Record<string, ResourcePermission>;
  is_system: boolean;
}

const RESOURCE_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  agenda: "Agenda",
  clientes: "Pacientes (cadastro)",
  clientes_clinico: "Pacientes (clínico)",
  prontuarios: "Prontuários",
  receituarios: "Receituários",
  laudos: "Laudos & Exames",
  atestados: "Atestados",
  encaminhamentos: "Encaminhamentos",
  triagem: "Triagem",
  evolucao_enfermagem: "Evol. Enfermagem",
  evolucao_clinica: "Evol. Clínica SOAP",
  odontograma: "Odontograma",
  teleconsulta: "Teleconsulta",
  lista_espera: "Lista de Espera",
  gestao_salas: "Gestão de Salas",
  chat: "Chat Interno",
  financeiro: "Financeiro",
  faturamento_tiss: "Faturamento TISS",
  convenios: "Convênios",
  relatorios: "Relatórios",
  compras: "Compras",
  fornecedores: "Fornecedores",
  produtos: "Produtos",
  campanhas: "Campanhas",
  automacoes: "Automações",
  equipe: "Equipe",
  configuracoes: "Configurações",
  auditoria: "Auditoria",
};

const RESOURCE_ORDER = Object.keys(RESOURCE_LABELS);

const PROFESSIONAL_TYPES: ProfessionalType[] = [
  "medico", "dentista", "enfermeiro", "tec_enfermagem",
  "fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo",
  "secretaria", "faturista",
];

const ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Ver",
  create: "Criar",
  edit: "Editar",
  delete: "Excluir",
};

export default function GerenciarPermissoes() {
  const { profile, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<RoleTemplate[]>([]);
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Record<string, ResourcePermission>>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [activeType, setActiveType] = useState<ProfessionalType>("medico");

  const fetchTemplates = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("role_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      const loaded = (data ?? []) as RoleTemplate[];
      setTemplates(loaded);
      const edited: Record<string, Record<string, ResourcePermission>> = {};
      loaded.forEach((t) => {
        edited[t.professional_type] = { ...t.permissions };
      });
      setEditedTemplates(edited);
    } catch (err) {
      logger.error("Fetch role templates:", err);
      toast.error("Erro ao carregar templates");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleToggle = (type: ProfessionalType, resource: string, action: PermissionAction) => {
    setEditedTemplates((prev) => {
      const typeCopy = { ...prev[type] };
      const resCopy = { ...(typeCopy[resource] ?? { view: false, create: false, edit: false, delete: false }) };
      resCopy[action] = !resCopy[action];
      typeCopy[resource] = resCopy;
      return { ...prev, [type]: typeCopy };
    });
  };

  const handleSave = async (type: ProfessionalType) => {
    setIsSaving(true);
    try {
      const perms = editedTemplates[type];
      const { error } = await (supabase as any).rpc("update_role_template_permissions", {
        p_professional_type: type,
        p_permissions: perms,
      });
      if (error) throw error;
      toast.success(`Permissões de ${PROFESSIONAL_TYPE_LABELS[type]} salvas`);
      fetchTemplates();
    } catch (err) {
      logger.error("Save template:", err);
      toast.error("Erro ao salvar permissões");
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = (type: ProfessionalType) => {
    const original = templates.find((t) => t.professional_type === type);
    if (original) {
      setEditedTemplates((prev) => ({ ...prev, [type]: { ...original.permissions } }));
      toast.info("Alterações descartadas");
    }
  };

  const hasChanges = (type: ProfessionalType) => {
    const original = templates.find((t) => t.professional_type === type);
    if (!original) return false;
    return JSON.stringify(original.permissions) !== JSON.stringify(editedTemplates[type]);
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Gerenciar Permissões" subtitle="Acesso restrito">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Apenas administradores podem gerenciar permissões.
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Gerenciar Permissões"
      subtitle="Configure os acessos padrão de cada tipo profissional"
    >
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      ) : (
        <Tabs value={activeType} onValueChange={(v) => setActiveType(v as ProfessionalType)}>
          <TabsList className="flex flex-wrap h-auto gap-1 mb-4">
            {PROFESSIONAL_TYPES.map((type) => (
              <TabsTrigger key={type} value={type} className="text-xs px-3 py-1.5">
                {PROFESSIONAL_TYPE_LABELS[type]}
                {hasChanges(type) && <span className="ml-1 text-amber-500">*</span>}
              </TabsTrigger>
            ))}
          </TabsList>

          {PROFESSIONAL_TYPES.map((type) => (
            <TabsContent key={type} value={type}>
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-primary" />
                      {PROFESSIONAL_TYPE_LABELS[type]}
                    </CardTitle>
                    <CardDescription>
                      Defina quais recursos este perfil pode acessar por padrão
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleReset(type)}
                      disabled={!hasChanges(type)}
                    >
                      <RotateCcw className="mr-2 h-4 w-4" />
                      Descartar
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => handleSave(type)}
                      disabled={!hasChanges(type) || isSaving}
                    >
                      <Save className="mr-2 h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-3 font-medium">Recurso</th>
                          {(["view", "create", "edit", "delete"] as PermissionAction[]).map((action) => (
                            <th key={action} className="text-center py-2 px-2 font-medium w-20">
                              {ACTION_LABELS[action]}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {RESOURCE_ORDER.map((resource) => {
                          const perm = editedTemplates[type]?.[resource] ?? {
                            view: false, create: false, edit: false, delete: false,
                          };
                          return (
                            <tr key={resource} className="border-b hover:bg-muted/30">
                              <td className="py-2 px-3">{RESOURCE_LABELS[resource]}</td>
                              {(["view", "create", "edit", "delete"] as PermissionAction[]).map((action) => (
                                <td key={action} className="text-center py-2 px-2">
                                  <Checkbox
                                    checked={perm[action]}
                                    onCheckedChange={() => handleToggle(type, resource, action)}
                                  />
                                </td>
                              ))}
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          ))}
        </Tabs>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle className="text-base">Legenda</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-4 text-sm">
          <div className="flex items-center gap-2">
            <Check className="h-4 w-4 text-success" />
            <span>Permitido por padrão</span>
          </div>
          <div className="flex items-center gap-2">
            <X className="h-4 w-4 text-muted-foreground" />
            <span>Bloqueado por padrão</span>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-amber-500">*</Badge>
            <span>Alterações não salvas</span>
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
