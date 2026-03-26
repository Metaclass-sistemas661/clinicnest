import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { sanitizeHtml } from "@/lib/sanitize-html";
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
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Eye, Copy, Info } from "lucide-react";

const AVAILABLE_VARS = [
  { key: "nome_paciente", label: "Nome do paciente", example: "Maria da Silva" },
  { key: "cpf", label: "CPF do paciente", example: "123.456.789-00" },
  { key: "data_nascimento", label: "Data de nascimento", example: "15/03/1990" },
  { key: "endereco_completo", label: "Endereço completo", example: "Rua das Flores, 123" },
  { key: "nome_clinica", label: "Nome da clínica", example: "Clínica Exemplo" },
  { key: "cnpj_clinica", label: "CNPJ da clínica", example: "12.345.678/0001-00" },
  { key: "data_hoje", label: "Data atual", example: "23/02/2026" },
  { key: "servico", label: "Nome do procedimento", example: "Consulta Médica" },
  { key: "valor", label: "Valor do procedimento", example: "R$ 250,00" },
];

function replaceVariables(html: string, vars: Record<string, string>): string {
  let result = html;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export default function ContratoTermoEditor() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, isAdmin } = useAuth();
  const isNew = id === "novo";

  const [isLoading, setIsLoading] = useState(!isNew);
  const [isSaving, setIsSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    slug: "",
    content_html: "",
    is_active: true,
    requires_signature: true,
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
        .from("contract_templates")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("id", id)
        .single();
      if (error) throw error;
      setFormData({
        name: data.name,
        slug: data.slug,
        content_html: data.content_html,
        is_active: data.is_active,
        requires_signature: data.requires_signature ?? true,
      });
    } catch (err) {
      logger.error(err);
      toast.error("Contrato não encontrado");
      navigate("/contratos-termos");
    } finally {
      setIsLoading(false);
    }
  };

  const insertVariable = (key: string) => {
    setFormData((prev) => ({
      ...prev,
      content_html: prev.content_html + `{{${key}}}`,
    }));
    toast.success(`Variável {{${key}}} inserida`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim() || !formData.slug.trim()) {
      toast.error("Nome e identificador são obrigatórios");
      return;
    }
    if (!formData.content_html.trim()) {
      toast.error("O conteúdo do contrato é obrigatório");
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        tenant_id: profile!.tenant_id,
        name: formData.name.trim(),
        slug: formData.slug.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        content_html: formData.content_html,
        is_active: formData.is_active,
        requires_signature: formData.requires_signature,
      };

      if (isNew) {
        const { error } = await supabase.from("contract_templates").insert(payload);
        if (error) throw error;
        toast.success("Contrato criado com sucesso!");
      } else {
        const { error } = await supabase
          .from("contract_templates")
          .update(payload)
          .eq("id", id)
          .eq("tenant_id", profile!.tenant_id);
        if (error) throw error;
        toast.success("Contrato atualizado!");
      }
      navigate("/contratos-termos");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao salvar contrato");
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

  const previewHtml = replaceVariables(formData.content_html, {
    nome_paciente: "Maria da Silva Santos",
    cpf: "123.456.789-00",
    data_nascimento: "15/03/1990",
    endereco_completo: "Rua das Flores, 123 - Jardim Primavera - São Paulo/SP",
    nome_clinica: "Clínica Exemplo",
    cnpj_clinica: "12.345.678/0001-00",
    data_hoje: new Date().toLocaleDateString("pt-BR"),
    servico: "Consulta Médica",
    valor: "R$ 250,00",
  });

  return (
    <MainLayout
      title={isNew ? "Novo Contrato/Termo" : "Editar Contrato"}
      subtitle="Configure o modelo de contrato ou termo"
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/contratos-termos")}>
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
              Preview: {formData.name}
            </CardTitle>
            <CardDescription>
              Variáveis estão preenchidas com dados de exemplo
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div
              className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card"
              dangerouslySetInnerHTML={{ __html: sanitizeHtml(previewHtml) }}
            />
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit}>
          <Card className="mb-6">
            <CardHeader>
              <CardTitle className="text-base">Informações do Contrato</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome *</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Contrato de Prestação de Serviços"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Identificador (slug) *</Label>
                  <Input
                    value={formData.slug}
                    onChange={(e) => setFormData({ ...formData, slug: e.target.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, "") })}
                    placeholder="Ex: contrato_servicos"
                    required
                  />
                  <p className="text-xs text-muted-foreground">Identificador único, sem espaços ou acentos</p>
                </div>
              </div>

              <div className="flex items-center gap-6">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.requires_signature}
                    onCheckedChange={(v) => setFormData({ ...formData, requires_signature: v })}
                  />
                  <Label className="cursor-pointer">Requer assinatura do paciente</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                  />
                  <Label className="cursor-pointer">Ativo</Label>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Conteúdo do Contrato (HTML)</CardTitle>
              <CardDescription>
                Use tags HTML para formatação: &lt;h2&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;li&gt;, &lt;strong&gt;, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                value={formData.content_html}
                onChange={(e) => setFormData({ ...formData, content_html: e.target.value })}
                placeholder="<h2>Contrato de Prestação de Serviços</h2>&#10;<p>Pelo presente instrumento...</p>"
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
                  Estas variáveis são substituídas automaticamente pelos dados reais do paciente ao gerar o contrato.
                </p>
              </details>
            </CardContent>
          </Card>

          <div className="flex justify-end mt-6">
            <Button type="submit" disabled={isSaving} variant="gradient">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Save className="mr-2 h-4 w-4" />{isNew ? "Criar Contrato" : "Salvar Alterações"}</>}
            </Button>
          </div>
        </form>
      )}
    </MainLayout>
  );
}
