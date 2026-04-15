import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import {
  Send,
  Loader2,
  FileSignature,
  Copy,
  Check,
  MessageCircle,
  Mail,
  Clock,
  Link2,
  AlertCircle,
} from "lucide-react";

interface Client {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
}

interface Template {
  id: string;
  title: string;
  is_required: boolean;
  is_active: boolean;
}

interface SendConsentLinkDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  client: Client | null;
}

export function SendConsentLinkDialog({
  open,
  onOpenChange,
  client,
}: SendConsentLinkDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedTemplates, setSelectedTemplates] = useState<string[]>([]);
  const [generatedLink, setGeneratedLink] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expiresHours, setExpiresHours] = useState(72);

  useEffect(() => {
    if (open && client) {
      fetchTemplates();
      setGeneratedLink(null);
      setCopied(false);
    }
  }, [open, client]);

  const fetchTemplates = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("consent_templates")
        .select("id, title, is_required, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });

      if (error) throw error;

      setTemplates(data || []);
      // Pre-select required templates
      const requiredIds = (data || [])
        .filter((t) => t.is_required)
        .map((t) => t.id);
      setSelectedTemplates(requiredIds);
    } catch (err) {
      logger.error("[SendConsentLink] fetchTemplates error", err);
      toast.error("Erro ao carregar templates");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleTemplate = (templateId: string) => {
    setSelectedTemplates((prev) =>
      prev.includes(templateId)
        ? prev.filter((id) => id !== templateId)
        : [...prev, templateId]
    );
    setGeneratedLink(null);
  };

  const handleSelectAll = () => {
    if (selectedTemplates.length === templates.length) {
      setSelectedTemplates([]);
    } else {
      setSelectedTemplates(templates.map((t) => t.id));
    }
    setGeneratedLink(null);
  };

  const handleGenerateLink = async () => {
    if (!client || selectedTemplates.length === 0) return;

    setIsGenerating(true);
    try {
      const { data, error } = await api.rpc("create_consent_signing_link", {
        p_client_id: client.id,
        p_template_ids: selectedTemplates,
        p_expires_hours: expiresHours,
      });

      if (error) throw error;

      const result = data as { success: boolean; token?: string; error?: string };

      if (!result.success) {
        toast.error(result.error || "Erro ao gerar link");
        return;
      }

      const baseUrl = window.location.origin;
      const link = `${baseUrl}/assinar-termos/${result.token}`;
      setGeneratedLink(link);
      toast.success("Link gerado com sucesso!");
    } catch (err) {
      logger.error("[SendConsentLink] generate error", err);
      toast.error("Erro ao gerar link de assinatura");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopyLink = async () => {
    if (!generatedLink) return;

    try {
      await navigator.clipboard.writeText(generatedLink);
      setCopied(true);
      toast.success("Link copiado!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Erro ao copiar link");
    }
  };

  const handleSendWhatsApp = () => {
    if (!generatedLink || !client?.phone) return;

    const phone = client.phone.replace(/\D/g, "");
    const phoneFormatted = phone.startsWith("55") ? phone : `55${phone}`;
    
    const message = encodeURIComponent(
      `Olá ${client.name}!\n\n` +
      `Você tem termos de consentimento pendentes para assinar.\n\n` +
      `Clique no link abaixo para assinar digitalmente:\n${generatedLink}\n\n` +
      `Este link expira em ${expiresHours} horas.`
    );

    window.open(`https://wa.me/${phoneFormatted}?text=${message}`, "_blank");
    toast.success("WhatsApp aberto!");
  };

  const handleSendEmail = () => {
    if (!generatedLink || !client?.email) return;

    const subject = encodeURIComponent("Assinatura de Termos de Consentimento");
    const body = encodeURIComponent(
      `Olá ${client.name},\n\n` +
      `Você tem termos de consentimento pendentes para assinar.\n\n` +
      `Clique no link abaixo para assinar digitalmente:\n${generatedLink}\n\n` +
      `Este link expira em ${expiresHours} horas.\n\n` +
      `Atenciosamente,\nEquipe da Clínica`
    );

    window.open(`mailto:${client.email}?subject=${subject}&body=${body}`, "_blank");
    toast.success("E-mail aberto!");
  };

  if (!client) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSignature className="h-5 w-5 text-teal-600" />
            Enviar Link de Assinatura
          </DialogTitle>
          <DialogDescription>
            Gere um link para <strong>{client.name}</strong> assinar os termos de consentimento pelo celular.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-teal-600" />
          </div>
        ) : templates.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <AlertCircle className="h-10 w-10 text-amber-500" />
            <p className="text-sm text-muted-foreground">
              Nenhum template de termo ativo encontrado.
            </p>
            <p className="text-xs text-muted-foreground">
              Crie templates em Administração → Templates de Termos.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Template selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">Termos a assinar</Label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAll}
                  className="h-auto py-1 px-2 text-xs"
                >
                  {selectedTemplates.length === templates.length
                    ? "Desmarcar todos"
                    : "Selecionar todos"}
                </Button>
              </div>
              <div className="max-h-[200px] overflow-y-auto space-y-2 border rounded-lg p-3">
                {templates.map((template) => (
                  <div
                    key={template.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted/50"
                  >
                    <Checkbox
                      id={template.id}
                      checked={selectedTemplates.includes(template.id)}
                      onCheckedChange={() => handleToggleTemplate(template.id)}
                    />
                    <Label
                      htmlFor={template.id}
                      className="flex-1 cursor-pointer text-sm"
                    >
                      {template.title}
                    </Label>
                    {template.is_required && (
                      <Badge variant="secondary" className="text-xs">
                        Obrigatório
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Expiration */}
            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="expires" className="text-sm">
                Expira em:
              </Label>
              <Input
                id="expires"
                type="number"
                min={1}
                max={168}
                value={expiresHours}
                onChange={(e) => setExpiresHours(Number(e.target.value))}
                className="w-20 h-8"
              />
              <span className="text-sm text-muted-foreground">horas</span>
            </div>

            {/* Generate button */}
            {!generatedLink && (
              <Button
                onClick={handleGenerateLink}
                disabled={isGenerating || selectedTemplates.length === 0}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                {isGenerating ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando link...</>
                ) : (
                  <><Link2 className="mr-2 h-4 w-4" />Gerar Link de Assinatura</>
                )}
              </Button>
            )}

            {/* Generated link */}
            {generatedLink && (
              <>
                <Separator />
                <div className="space-y-3">
                  <Label className="text-sm font-medium">Link gerado</Label>
                  <div className="flex gap-2">
                    <Input
                      value={generatedLink}
                      readOnly
                      className="text-xs"
                    />
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={handleCopyLink}
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-green-600" />
                      ) : (
                        <Copy className="h-4 w-4" />
                      )}
                    </Button>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      onClick={handleSendWhatsApp}
                      disabled={!client.phone}
                      className="gap-2"
                    >
                      <MessageCircle className="h-4 w-4 text-green-600" />
                      WhatsApp
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleSendEmail}
                      disabled={!client.email}
                      className="gap-2"
                    >
                      <Mail className="h-4 w-4 text-blue-600" />
                      E-mail
                    </Button>
                  </div>

                  {!client.phone && !client.email && (
                    <p className="text-xs text-amber-600 text-center">
                      Paciente não possui telefone ou e-mail cadastrado.
                      Copie o link e envie manualmente.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
