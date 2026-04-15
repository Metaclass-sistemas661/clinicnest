import { useEffect, useState, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import { api } from "@/integrations/gcp/client";
import { useAuth } from "@/contexts/AuthContext";
import { upsertConsentTemplate } from "@/lib/typed-rpc";
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
  Info,
  Sparkles,
  Library,
  Upload,
  FileUp,
  File,
  X,
  Download,
} from "lucide-react";
import { ConsentRichTextEditor } from "@/components/consent/ConsentRichTextEditor";
import { CONSENT_TEMPLATES_LIBRARY, TEMPLATE_CATEGORIES, type TemplateCategory } from "@/lib/consent-templates-library";
import { replaceVariables } from "@/lib/consent-variables";
import { sanitizeHtml } from "@/lib/sanitize-html";

const MAX_PDF_SIZE = 10 * 1024 * 1024; // 10MB

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
    template_type: "html" as "html" | "pdf",
    pdf_file: null as File | null,
    pdf_storage_path: null as string | null,
    pdf_original_filename: null as string | null,
    pdf_file_size: null as number | null,
  });

  // Preview dialog
  const [previewTemplate, setPreviewTemplate] = useState<ConsentTemplate | null>(null);

  // Deactivate confirm
  const [deactivateTarget, setDeactivateTarget] = useState<ConsentTemplate | null>(null);

  // Library filter
  const [libraryCategory, setLibraryCategory] = useState<TemplateCategory | "all">("all");

  const fetchTemplates = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
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
        template_type: template.template_type || "html",
        pdf_file: null,
        pdf_storage_path: template.pdf_storage_path,
        pdf_original_filename: template.pdf_original_filename,
        pdf_file_size: template.pdf_file_size,
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
        template_type: "html",
        pdf_file: null,
        pdf_storage_path: null,
        pdf_original_filename: null,
        pdf_file_size: null,
      });
    }
    setIsDialogOpen(true);
  };

  const handleUseSuggestion = (template: typeof CONSENT_TEMPLATES_LIBRARY[number]) => {
    setFormData((prev) => ({
      ...prev,
      title: template.title,
      slug: template.slug,
      body_html: template.body_html,
      is_required: template.is_required_default,
    }));
    toast.success(`Modelo "${template.title}" carregado!`);
  };

  const filteredLibrary = libraryCategory === "all" 
    ? CONSENT_TEMPLATES_LIBRARY 
    : CONSENT_TEMPLATES_LIBRARY.filter(t => t.category === libraryCategory);

  // Handle PDF file selection
  const handlePdfSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/pdf") {
      toast.error("Apenas arquivos PDF são permitidos");
      return;
    }

    if (file.size > MAX_PDF_SIZE) {
      toast.error("O arquivo PDF deve ter no máximo 10MB");
      return;
    }

    setFormData((prev) => ({
      ...prev,
      pdf_file: file,
      pdf_original_filename: file.name,
      pdf_file_size: file.size,
      template_type: "pdf",
    }));

    // Auto-fill title from filename if empty
    if (!formData.title) {
      const nameWithoutExt = file.name.replace(/\.pdf$/i, "").replace(/[-_]/g, " ");
      const capitalizedName = nameWithoutExt.charAt(0).toUpperCase() + nameWithoutExt.slice(1);
      setFormData((prev) => ({
        ...prev,
        title: capitalizedName,
        slug: file.name.replace(/\.pdf$/i, "").toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
      }));
    }

    toast.success(`PDF "${file.name}" selecionado`);
  };

  const handleRemovePdf = () => {
    setFormData((prev) => ({
      ...prev,
      pdf_file: null,
      pdf_storage_path: null,
      pdf_original_filename: null,
      pdf_file_size: null,
      template_type: "html",
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim() || !formData.slug.trim()) {
      toast.error("Título e identificador são obrigatórios");
      return;
    }

    // Validate based on type
    if (formData.template_type === "html" && !formData.body_html.trim()) {
      toast.error("O conteúdo do termo é obrigatório");
      return;
    }

    if (formData.template_type === "pdf" && !formData.pdf_file && !formData.pdf_storage_path) {
      toast.error("Selecione um arquivo PDF");
      return;
    }

    setIsSaving(true);
    try {
      let pdfStoragePath = formData.pdf_storage_path;

      // Upload PDF if new file selected
      if (formData.template_type === "pdf" && formData.pdf_file && profile?.tenant_id) {
        const fileExt = formData.pdf_file.name.split(".").pop();
        const fileName = `${profile.tenant_id}/${Date.now()}_${formData.slug}.${fileExt}`;

        const { error: uploadError } = await api.storage
          .from("consent-pdfs")
          .upload(fileName, formData.pdf_file);

        if (uploadError) {
          logger.error("[TermosConsentimento] PDF upload error", uploadError);
          toast.error("Erro ao fazer upload do PDF");
          return;
        }

        pdfStoragePath = fileName;

        // Delete old PDF if replacing
        if (editingTemplate?.pdf_storage_path && editingTemplate.pdf_storage_path !== pdfStoragePath) {
          await api.storage.from("consent-pdfs").remove([editingTemplate.pdf_storage_path]);
        }
      }

      const { data, error } = await upsertConsentTemplate({
        p_title: formData.title.trim(),
        p_slug: formData.slug.trim().toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        p_body_html: formData.template_type === "html" ? formData.body_html : "",
        p_is_required: formData.is_required,
        p_is_active: formData.is_active,
        p_sort_order: formData.sort_order,
        p_template_id: editingTemplate?.id ?? null,
        p_template_type: formData.template_type,
        p_pdf_storage_path: formData.template_type === "pdf" ? pdfStoragePath : null,
        p_pdf_original_filename: formData.template_type === "pdf" ? formData.pdf_original_filename : null,
        p_pdf_file_size: formData.template_type === "pdf" ? formData.pdf_file_size : null,
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
        const { data, error } = await api
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
            <Button variant="gradient" onClick={() => handleOpenDialog()}>
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
                <Button variant="gradient" onClick={() => handleOpenDialog()}>
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
                      <div className={`flex h-9 w-9 items-center justify-center rounded-lg flex-shrink-0 mt-0.5 ${t.template_type === "pdf" ? "bg-red-100 dark:bg-red-950" : "bg-muted"}`}>
                        {t.template_type === "pdf" ? (
                          <File className="h-4 w-4 text-red-600 dark:text-red-400" />
                        ) : (
                          <GripVertical className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-semibold text-sm">{t.title}</h3>
                          <Badge variant="outline" className="text-[10px]">{t.slug}</Badge>
                          {t.template_type === "pdf" && (
                            <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">PDF</Badge>
                          )}
                          {t.is_required && <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-400">Obrigatório</Badge>}
                          {!t.is_active && <Badge variant="secondary" className="text-[10px]">Inativo</Badge>}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                          {t.template_type === "pdf" 
                            ? `Arquivo: ${t.pdf_original_filename || "PDF"}`
                            : `${t.body_html.replace(/<[^>]*>/g, "").slice(0, 150)}...`
                          }
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
        <DialogContent className="max-w-[95vw] w-full lg:max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              {editingTemplate ? "Editar Termo" : "Novo Termo de Consentimento"}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate
                ? "Atualize o conteúdo do termo. Assinaturas já feitas mantêm o snapshot da versão anterior."
                : "Crie um novo termo de consentimento ou contrato. Termos marcados como obrigatórios serão exibidos para o paciente assinar antes de acessar o portal."}
            </DialogDescription>
            <div className="flex items-start gap-2 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-2.5 text-xs text-amber-800 dark:text-amber-300">
              <Info className="h-4 w-4 flex-shrink-0 mt-0.5" />
              <span>
                <strong>Atenção:</strong> Cadastre aqui apenas termos de consentimento, contratos e documentos que necessitam de assinatura do paciente. Não utilize esta área para relatórios ou outros documentos internos da clínica.
              </span>
            </div>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="flex-1 overflow-hidden flex flex-col">
            <Tabs defaultValue={editingTemplate?.template_type === "pdf" ? "upload" : editingTemplate ? "editor" : "library"} className="flex-1 flex flex-col overflow-hidden">
              <TabsList className="grid w-full grid-cols-3 mb-4">
                <TabsTrigger value="library" className="gap-2">
                  <Library className="h-4 w-4" />
                  <span className="hidden sm:inline">Biblioteca</span>
                </TabsTrigger>
                <TabsTrigger value="editor" className="gap-2">
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Editor Visual</span>
                </TabsTrigger>
                <TabsTrigger value="upload" className="gap-2">
                  <Upload className="h-4 w-4" />
                  <span className="hidden sm:inline">Upload PDF</span>
                </TabsTrigger>
              </TabsList>

              {/* Library Tab */}
              <TabsContent value="library" className="flex-1 overflow-hidden mt-0">
                <div className="space-y-3 h-full flex flex-col">
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant={libraryCategory === "all" ? "default" : "outline"}
                      size="sm"
                      onClick={() => setLibraryCategory("all")}
                      className="text-xs"
                    >
                      Todos ({CONSENT_TEMPLATES_LIBRARY.length})
                    </Button>
                    {(Object.keys(TEMPLATE_CATEGORIES) as TemplateCategory[]).map((cat) => (
                      <Button
                        key={cat}
                        type="button"
                        variant={libraryCategory === cat ? "default" : "outline"}
                        size="sm"
                        onClick={() => setLibraryCategory(cat)}
                        className="text-xs"
                      >
                        {TEMPLATE_CATEGORIES[cat].label}
                      </Button>
                    ))}
                  </div>
                  <div className="flex-1 overflow-y-auto pr-2" style={{ maxHeight: "calc(60vh - 120px)", minHeight: "300px" }}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
                      {filteredLibrary.map((template) => (
                        <Card 
                          key={template.id} 
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          onClick={() => handleUseSuggestion(template)}
                        >
                          <CardContent className="p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 mb-1">
                                  <Badge variant="secondary" className={`text-[10px] ${TEMPLATE_CATEGORIES[template.category].color}`}>
                                    {TEMPLATE_CATEGORIES[template.category].label}
                                  </Badge>
                                  {template.is_required_default && (
                                    <Badge variant="outline" className="text-[10px]">Obrigatório</Badge>
                                  )}
                                </div>
                                <h4 className="font-medium text-sm truncate">{template.title}</h4>
                                <p className="text-xs text-muted-foreground mt-0.5">{template.description}</p>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center flex-shrink-0">
                    Clique em um modelo para carregar no editor
                  </p>
                </div>
              </TabsContent>

              {/* Editor Tab */}
              <TabsContent value="editor" className="flex-1 overflow-auto mt-0">
                <div className="space-y-4">
                  {/* Aviso quando é um PDF */}
                  {formData.template_type === "pdf" && formData.pdf_storage_path && (
                    <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                      <div className="flex gap-3">
                        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                        <div className="text-sm text-amber-800 dark:text-amber-200">
                          <p className="font-medium mb-1">Este termo usa um arquivo PDF</p>
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            O conteúdo do PDF não pode ser editado aqui. Para modificar, vá na aba <strong>Upload PDF</strong> e envie uma nova versão, 
                            ou remova o PDF para usar o Editor Visual.
                          </p>
                        </div>
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
                    <Label>Conteúdo do Termo {formData.template_type !== "pdf" && "*"}</Label>
                    <ConsentRichTextEditor
                      value={formData.body_html}
                      onChange={(html) => setFormData({ ...formData, body_html: html, template_type: "html" })}
                      placeholder="Comece a escrever seu termo ou selecione um modelo da biblioteca..."
                      minHeight="280px"
                    />
                    {formData.template_type === "pdf" && (
                      <p className="text-[11px] text-muted-foreground">
                        Se você escrever aqui, o PDF será substituído pelo conteúdo do editor.
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
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
              </TabsContent>

              {/* Upload PDF Tab */}
              <TabsContent value="upload" className="flex-1 overflow-auto mt-0">
                <div className="space-y-4">
                  <div className="rounded-lg border-2 border-dashed border-border p-6 text-center">
                    {formData.pdf_file || formData.pdf_storage_path ? (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center">
                          <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950">
                            <File className="h-8 w-8 text-red-600 dark:text-red-400" />
                          </div>
                        </div>
                        <div>
                          <p className="font-medium">{formData.pdf_original_filename}</p>
                          <p className="text-sm text-muted-foreground">
                            {formData.pdf_file_size ? `${(formData.pdf_file_size / 1024 / 1024).toFixed(2)} MB` : "PDF carregado"}
                          </p>
                        </div>
                        <div className="flex items-center justify-center gap-2">
                          {formData.pdf_storage_path && !formData.pdf_file && (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={async () => {
                                const { data } = await api.storage
                                  .from("consent-pdfs")
                                  .createSignedUrl(formData.pdf_storage_path!, 60);
                                if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                              }}
                            >
                              <Download className="h-4 w-4 mr-2" />
                              Visualizar
                            </Button>
                          )}
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={handleRemovePdf}
                          >
                            <X className="h-4 w-4 mr-2" />
                            Remover
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <label className="cursor-pointer block" aria-label="Selecionar arquivo PDF">
                        <input
                          type="file"
                          accept="application/pdf"
                          className="sr-only"
                          onChange={handlePdfSelect}
                        />
                        <div className="space-y-4">
                          <div className="flex items-center justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-muted">
                              <FileUp className="h-8 w-8 text-muted-foreground" />
                            </div>
                          </div>
                          <div>
                            <p className="font-medium">Clique para selecionar um PDF</p>
                            <p className="text-sm text-muted-foreground">ou arraste e solte aqui</p>
                            <p className="text-xs text-muted-foreground mt-2">Máximo 10MB</p>
                          </div>
                        </div>
                      </label>
                    )}
                  </div>

                  <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 p-4">
                    <div className="flex gap-3">
                      <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                      <div className="text-sm text-amber-800 dark:text-amber-200">
                        <p className="font-medium mb-1">Sobre upload de PDF</p>
                        <ul className="text-xs space-y-1 text-amber-700 dark:text-amber-300">
                          <li>• O PDF será exibido diretamente ao paciente para assinatura</li>
                          <li>• Ideal para contratos já existentes da sua clínica</li>
                          <li>• As variáveis dinâmicas (nome, CPF) não são substituídas em PDFs</li>
                          <li>• Para documentos com dados automáticos, use o Editor Visual</li>
                        </ul>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Título *</Label>
                      <Input
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
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
                    </div>
                  </div>

                  <div className="flex items-center gap-6 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_required_pdf"
                        checked={formData.is_required}
                        onCheckedChange={(v) => setFormData({ ...formData, is_required: v })}
                      />
                      <Label htmlFor="is_required_pdf" className="cursor-pointer text-sm">Obrigatório para acessar o portal</Label>
                    </div>
                    <div className="flex items-center gap-2">
                      <Switch
                        id="is_active_pdf"
                        checked={formData.is_active}
                        onCheckedChange={(v) => setFormData({ ...formData, is_active: v })}
                      />
                      <Label htmlFor="is_active_pdf" className="cursor-pointer text-sm">Ativo</Label>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>

            <DialogFooter className="mt-4 pt-4 border-t">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} variant="gradient">
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
              {previewTemplate?.template_type === "pdf" && (
                <Badge className="text-[10px] bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400">PDF</Badge>
              )}
            </DialogTitle>
            <DialogDescription>
              Pré-visualização do termo como o paciente verá no portal
            </DialogDescription>
          </DialogHeader>
          {previewTemplate && (
            <div className="py-4">
              {previewTemplate.template_type === "pdf" ? (
                <>
                  <div className="mb-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2">
                    <p className="text-xs text-amber-700 dark:text-amber-300 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Este é um documento PDF. O paciente visualizará o PDF completo antes de assinar.
                    </p>
                  </div>
                  <div className="border rounded-lg p-8 bg-card text-center">
                    <div className="flex flex-col items-center gap-4">
                      <div className="flex h-20 w-20 items-center justify-center rounded-xl bg-red-100 dark:bg-red-950">
                        <File className="h-10 w-10 text-red-600 dark:text-red-400" />
                      </div>
                      <div>
                        <p className="font-medium">{previewTemplate.pdf_original_filename}</p>
                        <p className="text-sm text-muted-foreground">
                          {previewTemplate.pdf_file_size ? `${(previewTemplate.pdf_file_size / 1024 / 1024).toFixed(2)} MB` : "Documento PDF"}
                        </p>
                      </div>
                      {previewTemplate.pdf_storage_path && (
                        <Button
                          variant="outline"
                          onClick={async () => {
                            const { data } = await api.storage
                              .from("consent-pdfs")
                              .createSignedUrl(previewTemplate.pdf_storage_path!, 60);
                            if (data?.signedUrl) window.open(data.signedUrl, "_blank");
                          }}
                        >
                          <Download className="h-4 w-4 mr-2" />
                          Abrir PDF
                        </Button>
                      )}
                    </div>
                  </div>
                </>
              ) : (
                <>
                  <div className="mb-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 px-3 py-2">
                    <p className="text-xs text-blue-700 dark:text-blue-300 flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Variáveis como {"{{nome_paciente}}"} serão preenchidas com dados reais do paciente na assinatura. Abaixo estão com dados de exemplo.
                    </p>
                  </div>
                  <div
                    className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card"
                    dangerouslySetInnerHTML={{
                      __html: sanitizeHtml(replaceVariables(previewTemplate.body_html, {
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
                      })),
                    }}
                  />
                </>
              )}
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
