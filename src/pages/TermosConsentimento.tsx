import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { upsertConsentTemplate } from "@/lib/supabase-typed-rpc";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import type { ConsentTemplate } from "@/types/database";
import {
  FileText,
  Plus,
  Pencil,
  Loader2,
  GripVertical,
  Eye,
  ShieldCheck,
  Camera,
  Copy,
  Info,
} from "lucide-react";
import { CONSENT_TEMPLATES } from "@/lib/consent-templates-default";
import { getAvailableVariables, replaceVariables } from "@/lib/consent-variables";

const AVAILABLE_VARS = getAvailableVariables();

export default function TermosConsentimento() {
  const { profile, isAdmin } = useAuth();
  const [templates, setTemplates] = useState<ConsentTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Dialog state
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ConsentTemplate | null>(null);
  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    body_html: "",
    is_required: true,
    is_active: true,
    sort_order: 0,
  });

  // Preview dialog
  const [previewTemplate, setPreviewTemplate] = useState<ConsentTemplate | null>(null);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<ConsentTemplate | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("consent_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("sort_order", { ascending: true })
        .order("created_at", { ascending: true });

      if (error) throw error;
      setTemplates((data as unknown as ConsentTemplate[]) ?? []);
    } catch (err) {
      logger.error("[TermosConsentimento] fetch error", err);
      toast.error("Erro ao carregar termos");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleOpenDialog = (template?: ConsentTemplate) => {
    if (template) {
      setEditingTemplate(template);
      setFormData({
        title: template.title,
        slug: template.slug,
        body_html: template.body_html,
        is_required: template.is_required,
        is_active: template.is_active,
        sort_order: template.sort_order,
      });
    } else {
      setEditingTemplate(null);
      setFormData({
        title: "",
        slug: "",
        body_html: "",
        is_required: true,
        is_active: true,
        sort_order: templates.length,
      });
    }
    setIsDialogOpen(true);
  };

  const handleUseSuggestion = (suggestion: typeof CONSENT_TEMPLATES[number]) => {
    setFormData((prev) => ({
      ...prev,
      title: suggestion.title,
      slug: suggestion.slug,
      body_html: suggestion.body_html,
    }));
  };

  const insertVariable = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      body_html: prev.body_html + `{{${key}}}`,
    }));
    toast.success(`Variável {{${key}}} inserida`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast.error("Título e identificador são obrigatórios");
      return;
    }
    if (!formData.body_html.trim()) {
      toast.error("O conteúdo do termo é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const { data, error } = await upsertConsentTemplate({
        p_title: formData.title.trim(),
        p_slug: formData.slug.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        p_body_html: formData.body_html,
        p_is_required: formData.is_required,
        p_is_active: formData.is_active,
        p_sort_order: formData.sort_order,
        p_template_id: editingTemplate?.id ?? null,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao salvar termo");
        return;
      }

      toast.success(editingTemplate ? "Termo atualizado" : "Termo criado com sucesso");
      setIsDialogOpen(false);
      fetchTemplates();
    } catch (err) {
      logger.error("[TermosConsentimento] save error", err);
      toast.error("Erro ao salvar termo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleActive = async (template: ConsentTemplate) => {
    if (template.is_active) {
      setDeactivateTarget(template);
      return;
    }
    await doToggleActive(template, true);
  };

  const doToggleActive = async (template: ConsentTemplate, newActive: boolean) => {
    try {
      const { error } = await upsertConsentTemplate({
        p_title: template.title,
        p_slug: template.slug,
        p_body_html: template.body_html,
        p_is_required: template.is_required,
        p_is_active: newActive,
        p_sort_order: template.sort_order,
        p_template_id: template.id,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao atualizar termo");
        return;
      }
      toast.success(newActive ? "Termo ativado" : "Termo desativado");
      fetchTemplates();
    } catch (err) {
      logger.error("[TermosConsentimento] toggle error", err);
    }
  };

  // Count signed consents per template
  const [signedCounts, setSignedCounts] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!profile?.tenant_id || templates.length === 0) return;
    const fetchCounts = async () => {
      try {
        const { data, error } = await supabase
          .from("patient_consents")
          .select("template_id")
          .eq("tenant_id", profile.tenant_id);
        if (error) throw error;
        const counts: Record<string, number> = {};
        (data ?? []).forEach((row: any) => {
          counts[row.template_id] = (counts[row.template_id] || 0) + 1;
        });
        setSignedCounts(counts);
      } catch {
        // silent
      }
    };
    fetchCounts();
  }, [profile?.tenant_id, templates]);

  return (
    <MainLayout title="Termos e Consentimentos" subtitle="Gerencie os termos que o paciente deve assinar com reconhecimento facial ao acessar o portal">
      <div className="space-y-6">
        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0 mt-0.5">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground mb-1">
                  Proteção jurídica da clínica
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Os termos criados aqui serão exibidos obrigatoriamente ao paciente no primeiro acesso ao portal.
                  O paciente <strong>não poderá navegar</strong> até assinar todos os termos obrigatórios com <strong>captura facial via webcam</strong>.
                  Cada assinatura fica registrada com foto, data/hora, IP e versão exata do termo — servindo como prova jurídica para a clínica.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-sm text-muted-foreground">{templates.length} termo(s) cadastrado(s)</span>
          </div>
          {isAdmin && (
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Termo
            </Button>
          )}
        </div>

        {/* List */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-24 w-full" />
            ))}
          </div>
        ) : templates.length === 0 ? (
          <EmptyState
            icon={FileText}
            title="Nenhum termo cadastrado"
            description="Crie termos de consentimento para que seus pacientes assinem ao acessar o portal."
            action={
              isAdmin ? (
                <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Criar Primeiro Termo
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {templates.map((t) => (
              <Card key={t.id} className={!t.is_active ? "opacity-60" : undefined}>
                <CardContent className="py-4 px-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted flex-shrink-0 mt-0.5">
                        <GripVertical className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{t.title}</h3>
                          <Badge variant="outline" className="text-[10px]">{t.slug}</Badge>
                          {t.is_required && <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">Obrigatório</Badge>}
                          {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {t.body_html.replace(/<[^>]*>/g, "").slice(0, 150)}...
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                            <Camera className="h-3 w-3" />
                            {signedCounts[t.id] || 0} assinatura(s)
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setPreviewTemplate(t)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleOpenDialog(t)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Switch
                            checked={t.is_active}
                            onCheckedChange={() => handleToggleActive(t)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingTemplate ? "Editar Termo" : "Novo Termo de Consentimento"}</DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Atualize o conteúdo do termo. Assinaturas já feitas mantêm o snapshot da versão anterior."
                : "Crie um novo termo que será exibido ao paciente no portal. Use HTML para formatação."}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit}>
            <div className="space-y-5 py-4">
              {/* Suggestions */}
              {!editingTemplate && (
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">Modelos prontos (clique para usar o conteúdo completo)</Label>
                  <div className="flex flex-wrap gap-2">
                    {CONSENT_TEMPLATES.map((s) => (
                      <Button
                        key={s.slug}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-xs"
                        onClick={() => handleUseSuggestion(s)}
                      >
                        {s.title}
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Título *</Label>
                  <Input
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    placeholder="Ex: Termo de Uso de Imagem"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Identificador (slug) *</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })}
                    placeholder="Ex: uso_imagem"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">Identificador único, sem espaços ou acentos</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label>Conteúdo do Termo (HTML) *</Label>
                <Textarea
                  value={formData.body_html}
                  onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                  placeholder="<h2>Termo de Uso de Imagem</h2>&#10;<p>Eu, paciente abaixo identificado...</p>"
                  rows={12}
                  className="font-mono text-xs"
                  required
                />
                <p className="text-[11px] text-muted-foreground">
                  Use tags HTML para formatação: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, etc.
                </p>

                <details className="mt-2">
                  <summary className="text-xs font-medium text-primary cursor-pointer flex items-center gap-1">
                    <Info className="h-3 w-3" /> Variáveis dinâmicas disponíveis (clique para inserir)
                  </summary>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {AVAILABLE_VARS.map((v) => (
                      <Button
                        key={v.key}
                        type="button"
                        variant="outline"
                        size="sm"
                        className="text-[10px] h-6 px-2 gap-1 font-mono"
                        onClick={() => insertVariable(v.key)}
                        title={`${v.label} — ex: ${v.example}`}
                      >
                        <Copy className="h-2.5 w-2.5" />
                        {`{{${v.key}}}`}
                      </Button>
                    ))}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1.5">
                    Estas variáveis são substituídas automaticamente pelos dados reais do paciente no momento da assinatura.
                  </p>
                </details>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_required"
                    checked={formData.is_required}
                    onCheckedChange={(v) => setFormData({ ...formData, is_required: v })}
                  />
                  <Label htmlFor="is_required" className="cursor-pointer text-sm">Obrigatório para acessar o portal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer text-sm">Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-sm">Ordem</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editingTemplate ? "Atualizar Termo" : "Criar Termo"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewTemplate} onOpenChange={() => setPreviewTemplate(null)}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-4 w-4" />
              {previewTemplate?.title}
            </DialogTitle>
            <DialogDescription>
              Pré-visualização do termo como o paciente verá no portal
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="py-4">
              <div className="mb-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
                <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                  <Info className="h-3 w-3" />
                  Variáveis como {"{{nome_paciente}}"} serão preenchidas com dados reais do paciente na assinatura. Abaixo estão com dados de exemplo.
                </p>
              </div>
              <div
                className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card"
                dangerouslySetInnerHTML={{
                  __html: replaceVariables(previewTemplate.body_html, {
                    nome_paciente: "Maria da Silva Santos",
                    cpf: "123.456.789-00",
                    data_nascimento: "15/03/1990",
                    email: "maria@email.com",
                    telefone: "(11) 99999-0000",
                    endereco_completo: "Rua das Flores, 123 - Jardim Primavera - São Paulo/SP",
                    nome_clinica: "Clínica Exemplo",
                    cnpj_clinica: "12.345.678/0001-00",
                    endereco_clinica: "Av. Brasil, 500 - Centro - São Paulo/SP",
                    responsavel_tecnico: "Dr. João da Silva",
                    crm_responsavel: "CRM/SP 123456",
                    data_hoje: new Date().toLocaleDateString("pt-BR"),
                    cidade: "São Paulo",
                    estado: "SP",
                  }),
                }}
              />
              <div className="mt-4 p-4 rounded-lg bg-muted/50 border border-dashed">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Camera className="h-4 w-4" />
                  <span>Aqui o paciente verá a captura facial via webcam para assinar o termo</span>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Deactivate Confirm */}
      <AlertDialog open={!!deactivateTarget} onOpenChange={() => setDeactivateTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desativar termo?</AlertDialogTitle>
            <AlertDialogDescription>
              O termo "{deactivateTarget?.title}" não será mais exibido para novos pacientes.
              Assinaturas já realizadas continuam válidas e acessíveis.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deactivateTarget) {
                  doToggleActive(deactivateTarget, false);
                  setDeactivateTarget(null);
                }
              }}
            >
              Desativar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
