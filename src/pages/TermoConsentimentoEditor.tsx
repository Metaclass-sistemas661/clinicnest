import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { upsertConsentTemplate } from "@/lib/supabase-typed-rpc";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Eye, Copy, Info } from "lucide-react";
import { CONSENT_TEMPLATES } from "@/lib/consent-templates-default";
import { getAvailableVariables, replaceVariables } from "@/lib/consent-variables";
import type { ConsentTemplate } from "@/types/database";

const AVAILABLE_VARS = getAvailableVariables();

export default function TermoConsentimentoEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const isNew = id === "novo";

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    slug: "",
    body_html: "",
    is_required: true,
    is_active: true,
    sort_order: 0,
  });

  useEffect(() => {
    if (profile?.tenant_id && !isNew && id) {
      fetchTemplate();
    }
  }, [profile?.tenant_id, id, isNew]);

  const fetchTemplate = async () => {
    if (!profile?.tenant_id || !id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("consent_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("id", id)
        .single();
      if (error) throw error;
      const t = data as unknown as ConsentTemplate;
      setFormData({
        title: t.title,
        slug: t.slug,
        body_html: t.body_html,
        is_required: t.is_required,
        is_active: t.is_active,
        sort_order: t.sort_order,
      });
    } catch (err) {
      logger.error(err);
      toast.error("Termo não encontrado");
      navigate("/termos-consentimento");
    } finally {
      setIsLoading(false);
    }
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
      const { error } = await upsertConsentTemplate({
        p_title: formData.title.trim(),
        p_slug: formData.slug.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        p_body_html: formData.body_html,
        p_is_required: formData.is_required,
        p_is_active: formData.is_active,
        p_sort_order: formData.sort_order,
        p_template_id: isNew ? null : id ?? null,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao salvar termo");
        return;
      }

      toast.success(isNew ? "Termo criado com sucesso!" : "Termo atualizado!");
      navigate("/termos-consentimento");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao salvar termo");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <Skeleton className="h-64 w-full" />
      </MainLayout>
    );
  }

  const previewHtml = replaceVariables(formData.body_html, {
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
  });

  return (
    <MainLayout
      title={isNew ? "Novo Termo de Consentimento" : "Editar Termo"}
      subtitle="Configure o conteúdo do termo que o paciente assinará"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/termos-consentimento")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          <Button variant="outline" onClick={() => setShowPreview(!showPreview)}>
            <Eye className="mr-2 h-4 w-4" />
            {showPreview ? "Editar" : "Preview"}
          </Button>
        </div>
      }
    >
      {showPreview ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="h-4 w-4" />
              Preview: {formData.title}
            </CardTitle>
            <CardDescription>
              Variáveis estão preenchidas com dados de exemplo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card"
              dangerouslySetInnerHTML={{ __html: previewHtml }}
            />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          {/* Modelos prontos */}
          {isNew && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-base">Modelos Prontos</CardTitle>
                <CardDescription>Clique para usar o conteúdo completo</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-2">
                  {CONSENT_TEMPLATES.map((s) => (
                    <Button key={s.slug} type="button" variant="outline" size="sm" onClick={() => handleUseSuggestion(s)}>
                      {s.title}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Informações do Termo</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
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
                  <p className="text-xs text-muted-foreground">Identificador único, sem espaços ou acentos</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_required}
                    onCheckedChange={(v) => setFormData({ ...formData, is_required: v })}
                  />
                  <Label className="cursor-pointer">Obrigatório para acessar o portal</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label className="cursor-pointer">Ativo</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Label>Ordem</Label>
                  <Input
                    type="number"
                    min={0}
                    className="w-20"
                    value={formData.sort_order}
                    onChange={(e) => setFormData({ ...formData, sort_order: Number(e.target.value) || 0 })}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo do Termo (HTML)</CardTitle>
              <CardDescription>
                Use tags HTML para formatação: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                placeholder="<h2>Termo de Uso de Imagem</h2>&#10;<p>Eu, paciente abaixo identificado...</p>"
                rows={16}
                className="font-mono text-xs"
                required
              />

              <details>
                <summary className="text-sm font-medium text-primary cursor-pointer flex items-center gap-1">
                  <Info className="h-4 w-4" /> Variáveis dinâmicas disponíveis (clique para inserir)
                </summary>
                <div className="mt-3 flex flex-wrap gap-2">
                  {AVAILABLE_VARS.map((v) => (
                    <Button
                      key={v.key}
                      type="button"
                      variant="outline"
                      size="sm"
                      className="text-xs h-7 px-2 gap-1 font-mono"
                      onClick={() => insertVariable(v.key)}
                      title={`${v.label} — ex: ${v.example}`}
                    >
                      <Copy className="h-3 w-3" />
                      {`{{${v.key}}}`}
                    </Button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  Estas variáveis são substituídas automaticamente pelos dados reais do paciente no momento da assinatura.
                </p>
              </details>
            </CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={isSaving} variant="gradient">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />{isNew ? "Criar Termo" : "Salvar Alterações"}</>}
            </Button>
          </div>
        </form>
      )}
    </MainLayout>
  );
}
