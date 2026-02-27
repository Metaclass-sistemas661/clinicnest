import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Loader2, Monitor, Smartphone, Palette, ImageIcon, Type, MousePointerClick, AlignLeft, Mail, Tag, Upload, Calendar, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import {
  generateEmailHtml,
  makeDefaultState,
  COLOR_PRESETS,
  type BuilderState,
  type TemplateId,
} from "./emailHtml";
import SocialCreativePanel from "./SocialCreativePanel";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailBuilderProps {
  defaultClinicName: string;
  onSave: (payload: {
    name: string;
    subject: string;
    html: string;
    banner_url: string | null;
    preheader: string | null;
  }) => void;
  onCancel: () => void;
  isSaving?: boolean;
}

// ─── Debounce hook ────────────────────────────────────────────────────────────

function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// ─── Template thumbnail cards ────────────────────────────────────────────────

function TemplateThumbnail({ templateId }: { templateId: TemplateId }) {
  if (templateId === "promocao") {
    return (
      <div className="rounded overflow-hidden border border-border/50 w-full">
        <div className="h-7" style={{ background: "linear-gradient(135deg,#7c3aed,#db2777)" }} />
        <div className="p-2 bg-white space-y-1.5">
          <div className="h-2 w-3/4 bg-gray-800 rounded-sm" />
          <div className="h-1.5 w-1/2 bg-gray-400 rounded-sm" />
          <div className="h-1 w-full bg-gray-200 rounded-sm" />
          <div className="h-1 w-4/5 bg-gray-200 rounded-sm" />
          <div className="h-4 w-2/3 mx-auto rounded-full mt-1" style={{ background: "#db2777" }} />
        </div>
      </div>
    );
  }
  if (templateId === "newsletter") {
    return (
      <div className="rounded overflow-hidden border border-border/50 w-full">
        <div className="h-7 bg-slate-800" />
        <div className="p-2 bg-white space-y-1.5">
          <div className="h-px w-full bg-gray-200 mb-1" />
          <div className="h-2 w-2/3 bg-gray-700 rounded-sm" />
          <div className="h-1 w-full bg-gray-200 rounded-sm" />
          <div className="h-1 w-full bg-gray-200 rounded-sm" />
          <div className="h-1 w-3/4 bg-gray-200 rounded-sm" />
          <div className="h-4 w-1/2 mx-auto bg-slate-700 rounded-full mt-1" />
        </div>
      </div>
    );
  }
  return (
    <div className="rounded overflow-hidden border border-border/50 w-full">
      <div className="h-7" style={{ background: "linear-gradient(135deg,#b45309,#d97706)" }} />
      <div className="p-2 bg-white space-y-1.5">
        <div className="h-2 w-1/3 rounded-full" style={{ background: "#fbbf24" }} />
        <div className="h-2 w-3/4 bg-gray-800 rounded-sm" />
        <div className="h-1 w-full bg-gray-200 rounded-sm" />
        <div className="h-1 w-4/5 bg-gray-200 rounded-sm" />
        <div className="h-4 w-2/3 mx-auto rounded-full mt-1" style={{ background: "#b45309" }} />
      </div>
    </div>
  );
}

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ icon: Icon, children }: { icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{children}</p>
    </div>
  );
}

// ─── Color preset row ─────────────────────────────────────────────────────────

function ColorPresetRow({
  primaryColor,
  onChange,
}: {
  primaryColor: string;
  onChange: (preset: { primary: string; secondary: string; gradient: boolean }) => void;
}) {
  const customRef = useRef<HTMLInputElement>(null);

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {COLOR_PRESETS.map((p) => (
        <button
          key={p.id}
          type="button"
          title={p.name}
          onClick={() => onChange({ primary: p.primary, secondary: p.secondary, gradient: p.gradient })}
          className={cn(
            "w-7 h-7 rounded-full border-2 transition-all hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-primary",
            primaryColor === p.primary ? "border-foreground scale-110 shadow-md" : "border-transparent"
          )}
          style={{
            background: p.gradient
              ? `linear-gradient(135deg, ${p.primary}, ${p.secondary})`
              : p.primary,
          }}
        />
      ))}
      <label
        title="Cor personalizada"
        className="w-7 h-7 rounded-full border-2 border-dashed border-muted-foreground/50 cursor-pointer flex items-center justify-center hover:border-foreground transition-colors"
      >
        <span className="text-xs text-muted-foreground font-bold leading-none">+</span>
        <input
          ref={customRef}
          type="color"
          value={primaryColor}
          onChange={(e) => onChange({ primary: e.target.value, secondary: e.target.value, gradient: false })}
          className="sr-only"
        />
      </label>
    </div>
  );
}

// ─── Banner input (upload + URL) ──────────────────────────────────────────────

function BannerUrlInput({
  value,
  onChange,
  onUploadFile,
  isUploading,
  height,
  onHeightChange,
  onDelete,
}: {
  value: string;
  onChange: (v: string) => void;
  onUploadFile: (file: File) => Promise<void>;
  isUploading: boolean;
  height: number;
  onHeightChange: (v: number) => void;
  onDelete: () => void;
}) {
  const [mode, setMode] = useState<"upload" | "url">("upload");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isValidUrl = value.trim().startsWith("http");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await onUploadFile(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-2">
      <div className="flex rounded-md border border-border overflow-hidden text-xs">
        <button
          type="button"
          onClick={() => setMode("upload")}
          className={cn(
            "flex-1 py-1.5 px-2 transition-colors",
            mode === "upload"
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          Do computador
        </button>
        <button
          type="button"
          onClick={() => setMode("url")}
          className={cn(
            "flex-1 py-1.5 px-2 transition-colors border-l border-border",
            mode === "url"
              ? "bg-primary text-primary-foreground font-medium"
              : "bg-transparent text-muted-foreground hover:bg-muted"
          )}
        >
          Colar URL
        </button>
      </div>

      {mode === "upload" ? (
        <div className="space-y-1">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
            className="sr-only"
            onChange={handleFileChange}
          />
          <Button
            type="button"
            variant="outline"
            className="w-full gap-2"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            {isUploading ? (
              <><Loader2 className="h-4 w-4 animate-spin" />Enviando...</>
            ) : (
              <><Upload className="h-4 w-4" />Importar imagem</>
            )}
          </Button>
          <p className="text-xs text-muted-foreground">JPG, PNG, GIF ou WebP — máx. 5 MB</p>
        </div>
      ) : (
        <Input
          placeholder="https://exemplo.com/imagem-banner.jpg"
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}

      {isValidUrl && (
        <div className="space-y-2">
          {/* Preview com botão deletar */}
          <div className="relative rounded-md overflow-hidden border bg-muted/30">
            <img
              src={value}
              alt="Banner preview"
              className="w-full object-cover block"
              style={{ height: `${Math.min(height, 160)}px` }}
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
            />
            <button
              type="button"
              onClick={onDelete}
              title="Remover imagem"
              className="absolute top-1.5 right-1.5 bg-black/60 hover:bg-red-600 text-white rounded-full p-1 transition-colors"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
          {/* Slider de altura */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">Altura no email</span>
              <span className="text-xs font-medium tabular-nums">{height}px</span>
            </div>
            <input
              type="range"
              min={60}
              max={400}
              step={10}
              value={height}
              onChange={(e) => onHeightChange(Number(e.target.value))}
              className="w-full h-1.5 rounded-full cursor-pointer accent-primary"
            />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>60px</span>
              <span>400px</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── CTA Color picker ─────────────────────────────────────────────────────────

function CtaColorPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer group">
      <span
        className="w-8 h-8 rounded-full border-2 border-border group-hover:border-foreground transition-colors shadow-sm"
        style={{ background: value }}
      />
      <span className="text-sm text-muted-foreground group-hover:text-foreground transition-colors">{value}</span>
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="sr-only" />
    </label>
  );
}

// ─── Right panel tabs ─────────────────────────────────────────────────────────

type RightTab = "email" | "stories" | "feed" | "whatsapp";

const RIGHT_TABS: { id: RightTab; label: string }[] = [
  { id: "email",    label: "Email"    },
  { id: "stories",  label: "Stories"  },
  { id: "feed",     label: "Feed"     },
  { id: "whatsapp", label: "WhatsApp" },
];

// ─── Email preview panel ──────────────────────────────────────────────────────

function EmailPreviewPanel({ html, isMobilePreview }: { html: string; isMobilePreview: boolean }) {
  return (
    <div className="h-full w-full bg-muted/30 overflow-auto">
      <div
        className="transition-all duration-300 mx-auto"
        style={{ maxWidth: isMobilePreview ? "390px" : "100%" }}
      >
        <iframe
          title="Email Preview"
          srcDoc={html}
          className="w-full border-0"
          style={{ height: "calc(100vh - 100px)", minHeight: "600px" }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

// ─── Main templates list ──────────────────────────────────────────────────────

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "promocao",   label: "Promoção"   },
  { id: "newsletter", label: "Newsletter" },
  { id: "novidade",   label: "Novidade"   },
];

// ─── Main EmailBuilder ────────────────────────────────────────────────────────

export default function EmailBuilder({ defaultClinicName, onSave, onCancel, isSaving }: EmailBuilderProps) {
  const isMobile = useIsMobile();
  const { tenant } = useAuth();
  const [previewMobile, setPreviewMobile] = useState(false);
  const [rightTab, setRightTab] = useState<RightTab>("email");
  const [errors, setErrors] = useState<{ campaignName?: string; subject?: string }>({});
  const [isUploadingBanner, setIsUploadingBanner] = useState(false);

  const [state, setState] = useState<BuilderState>(() =>
    makeDefaultState("promocao", defaultClinicName || "Minha Clínica")
  );

  const debouncedState = useDebounced(state, 280);
  const previewHtml = useMemo(() => generateEmailHtml(debouncedState), [debouncedState]);

  const set = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const handleTemplateChange = (id: TemplateId) => {
    const defaults = makeDefaultState(id, state.clinicName);
    setState({
      ...defaults,
      campaignName: state.campaignName,
      subject: state.subject,
      bannerUrl: state.bannerUrl,
      bannerHeight: state.bannerHeight,
      preheader: state.preheader,
      startDate: state.startDate,
      endDate: state.endDate,
    });
  };

  const handleColorPreset = (preset: { primary: string; secondary: string; gradient: boolean }) => {
    setState((s) => ({
      ...s,
      primaryColor: preset.primary,
      secondaryColor: preset.secondary,
      useGradient: preset.gradient,
      ctaColor: preset.primary,
    }));
  };

  const handleBannerUpload = async (file: File) => {
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      toast.error("Imagem muito grande. Máximo 5 MB.");
      return;
    }
    setIsUploadingBanner(true);
    try {
      const ext = file.name.split(".").pop() ?? "jpg";
      const tenantId = tenant?.id ?? "shared";
      const path = `${tenantId}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("campaign-banners")
        .upload(path, file, { upsert: false, contentType: file.type });
      if (uploadError) throw uploadError;
      const { data } = supabase.storage.from("campaign-banners").getPublicUrl(path);
      set("bannerUrl", data.publicUrl);
    } catch {
      toast.error("Erro ao enviar imagem. Tente novamente.");
    } finally {
      setIsUploadingBanner(false);
    }
  };

  const handleSave = () => {
    const newErrors: typeof errors = {};
    if (!state.campaignName.trim()) newErrors.campaignName = "Nome da campanha é obrigatório";
    if (!state.subject.trim()) newErrors.subject = "Assunto do email é obrigatório";
    if (Object.keys(newErrors).length) {
      setErrors(newErrors);
      return;
    }
    setErrors({});
    onSave({
      name: state.campaignName.trim(),
      subject: state.subject.trim(),
      html: generateEmailHtml(state),
      banner_url: state.bannerUrl.trim() || null,
      preheader: state.preheader.trim() || null,
    });
  };

  // ── Left panel controls ────────────────────────────────────────────────────
  const LeftPanel = (
    <div className="flex-1 min-h-0 overflow-y-auto">
      <div className="p-4 space-y-5 pb-8">

        {/* IDENTIFICAÇÃO */}
        <div>
          <SectionLabel icon={Tag}>Identificação</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome da Campanha <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: Promoção de Páscoa"
                value={state.campaignName}
                onChange={(e) => { set("campaignName", e.target.value); setErrors((err) => ({ ...err, campaignName: undefined })); }}
                className={cn(errors.campaignName && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.campaignName && <p className="text-xs text-destructive">{errors.campaignName}</p>}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Assunto do Email <span className="text-destructive">*</span></Label>
              <Input
                placeholder="Ex: 🎉 Oferta especial só para você!"
                value={state.subject}
                onChange={(e) => { set("subject", e.target.value); setErrors((err) => ({ ...err, subject: undefined })); }}
                className={cn(errors.subject && "border-destructive focus-visible:ring-destructive")}
              />
              {errors.subject && <p className="text-xs text-destructive">{errors.subject}</p>}
            </div>
          </div>
        </div>

        <Separator />

        {/* PERÍODO */}
        <div>
          <SectionLabel icon={Calendar}>Período da Campanha</SectionLabel>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label className="text-sm">Início</Label>
              <Input
                type="date"
                value={state.startDate}
                onChange={(e) => set("startDate", e.target.value)}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Término</Label>
              <Input
                type="date"
                value={state.endDate}
                onChange={(e) => set("endDate", e.target.value)}
                className="text-sm"
              />
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">Aparece no email como "Válida de DD/MM até DD/MM"</p>
        </div>

        <Separator />

        {/* TEMPLATE */}
        <div>
          <SectionLabel icon={Mail}>Template</SectionLabel>
          <div className="grid grid-cols-3 gap-2">
            {TEMPLATES.map(({ id, label }) => (
              <button
                key={id}
                type="button"
                onClick={() => handleTemplateChange(id)}
                className={cn(
                  "rounded-lg p-2 border-2 text-left transition-all hover:border-primary/60 focus:outline-none",
                  state.templateId === id
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/60 bg-transparent"
                )}
              >
                <TemplateThumbnail templateId={id} />
                <p className={cn(
                  "text-xs font-medium text-center mt-2",
                  state.templateId === id ? "text-primary" : "text-muted-foreground"
                )}>
                  {label}
                </p>
              </button>
            ))}
          </div>
        </div>

        <Separator />

        {/* MARCA */}
        <div>
          <SectionLabel icon={Palette}>Marca</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Nome da Clínica</Label>
              <Input
                placeholder="Nome da sua clínica"
                value={state.clinicName}
                onChange={(e) => set("clinicName", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cor Principal</Label>
              <ColorPresetRow primaryColor={state.primaryColor} onChange={handleColorPreset} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Pré-cabeçalho <span className="text-muted-foreground text-xs">(aparece na prévia do email)</span></Label>
              <Input
                placeholder="Uma frase curta que aparece antes de abrir o email..."
                value={state.preheader}
                onChange={(e) => set("preheader", e.target.value)}
              />
            </div>
          </div>
        </div>

        <Separator />

        {/* IMAGEM */}
        <div>
          <SectionLabel icon={ImageIcon}>Imagem de Banner</SectionLabel>
          <BannerUrlInput
            value={state.bannerUrl}
            onChange={(v) => set("bannerUrl", v)}
            onUploadFile={handleBannerUpload}
            isUploading={isUploadingBanner}
            height={state.bannerHeight}
            onHeightChange={(v) => set("bannerHeight", v)}
            onDelete={() => set("bannerUrl", "")}
          />
        </div>

        <Separator />

        {/* CONTEÚDO */}
        <div>
          <SectionLabel icon={Type}>Conteúdo</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Título Principal</Label>
              <Input
                placeholder="Ex: Promoção Especial Para Você! 🎉"
                value={state.headline}
                onChange={(e) => set("headline", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Subtítulo</Label>
              <Input
                placeholder="Ex: Aproveite nossos descontos exclusivos"
                value={state.subheadline}
                onChange={(e) => set("subheadline", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Texto do Email</Label>
              <Textarea
                placeholder={"Escreva o texto principal do email aqui...\n\nUse linha em branco para criar um novo parágrafo."}
                value={state.bodyText}
                onChange={(e) => set("bodyText", e.target.value)}
                rows={5}
                className="resize-none text-sm"
              />
              <p className="text-xs text-muted-foreground">Linha em branco = novo parágrafo</p>
            </div>
          </div>
        </div>

        <Separator />

        {/* BOTÃO CTA */}
        <div>
          <SectionLabel icon={MousePointerClick}>Botão de Ação</SectionLabel>
          <div className="space-y-3">
            <div className="space-y-1.5">
              <Label className="text-sm">Texto do Botão</Label>
              <Input
                placeholder="Ex: Agendar Agora"
                value={state.ctaText}
                onChange={(e) => set("ctaText", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Link do Botão</Label>
              <Input
                placeholder="https://clinicnest.metaclass.com.br/agendar/..."
                value={state.ctaUrl}
                onChange={(e) => set("ctaUrl", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">Cor do Botão</Label>
              <CtaColorPicker value={state.ctaColor} onChange={(v) => set("ctaColor", v)} />
            </div>
          </div>
        </div>

        <Separator />

        {/* RODAPÉ */}
        <div>
          <SectionLabel icon={AlignLeft}>Rodapé</SectionLabel>
          <Textarea
            value={state.footerText}
            onChange={(e) => set("footerText", e.target.value)}
            rows={3}
            className="resize-none text-sm"
            placeholder="© 2026 Sua Clínica. Para cancelar o recebimento, responda este email."
          />
        </div>

        {/* SAVE BAR (mobile only) */}
        {isMobile && (
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button className="flex-1 gradient-primary text-primary-foreground" onClick={handleSave} disabled={isSaving}>
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Campanha"}
            </Button>
          </div>
        )}
      </div>
    </div>
  );

  // ── Right panel (preview + social) ────────────────────────────────────────
  const RightPanel = (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 flex-shrink-0 gap-2">
        <div className="flex items-center gap-0.5 bg-muted rounded-md p-0.5">
          {RIGHT_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setRightTab(t.id)}
              className={cn(
                "px-2.5 py-1 text-xs rounded transition-all font-medium",
                rightTab === t.id
                  ? "bg-background shadow-sm text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        {/* Desktop/mobile toggle – only for email tab */}
        {rightTab === "email" && (
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setPreviewMobile(false)}
              className={cn(
                "p-1.5 rounded transition-colors",
                !previewMobile ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Desktop"
            >
              <Monitor className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setPreviewMobile(true)}
              className={cn(
                "p-1.5 rounded transition-colors",
                previewMobile ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"
              )}
              title="Mobile"
            >
              <Smartphone className="h-3.5 w-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-hidden">
        {rightTab === "email" && (
          <EmailPreviewPanel html={previewHtml} isMobilePreview={previewMobile} />
        )}
        {(rightTab === "stories" || rightTab === "feed" || rightTab === "whatsapp") && (
          <SocialCreativePanel state={debouncedState} format={rightTab} />
        )}
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
      {/* Top bar */}
      <div className="flex items-center justify-between px-5 py-3 border-b bg-background flex-shrink-0">
        <div>
          <h2 className="text-base font-semibold leading-tight">Nova Campanha</h2>
          <p className="text-xs text-muted-foreground">Crie um email profissional sem precisar saber programar</p>
        </div>
        {!isMobile && (
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onCancel} disabled={isSaving}>
              Cancelar
            </Button>
            <Button size="sm" className="gradient-primary text-primary-foreground" onClick={handleSave} disabled={isSaving}>
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
              ) : (
                "Criar Campanha"
              )}
            </Button>
          </div>
        )}
      </div>

      {/* Body */}
      {isMobile ? (
        <Tabs defaultValue="editar" className="flex flex-col flex-1 overflow-hidden">
          <TabsList className="grid grid-cols-2 mx-4 mt-2 flex-shrink-0">
            <TabsTrigger value="editar">Editar</TabsTrigger>
            <TabsTrigger value="preview">Prévia</TabsTrigger>
          </TabsList>
          <TabsContent value="editar" className="flex-1 overflow-hidden mt-0">
            {LeftPanel}
          </TabsContent>
          <TabsContent value="preview" className="flex-1 overflow-hidden mt-0">
            {RightPanel}
          </TabsContent>
        </Tabs>
      ) : (
        <div className="flex flex-1 overflow-hidden min-h-0">
          {/* Left controls */}
          <div className="w-[380px] flex-shrink-0 border-r flex flex-col overflow-hidden min-h-0">
            {LeftPanel}
          </div>
          {/* Right preview */}
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {RightPanel}
          </div>
        </div>
      )}
    </div>
  );
}
