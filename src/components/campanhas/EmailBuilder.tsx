import { useState, useEffect, useMemo, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { Loader2, Monitor, Smartphone, Palette, ImageIcon, Type, MousePointerClick, AlignLeft, Mail, Tag } from "lucide-react";
import {
  generateEmailHtml,
  makeDefaultState,
  COLOR_PRESETS,
  type BuilderState,
  type TemplateId,
} from "./emailHtml";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EmailBuilderProps {
  defaultSalonName: string;
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
  // novidade
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
      {/* Custom color */}
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

// ─── Banner URL input with thumbnail ─────────────────────────────────────────

function BannerUrlInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const isValidUrl = value.trim().startsWith("http");
  return (
    <div className="space-y-2">
      <Input
        placeholder="https://exemplo.com/imagem-banner.jpg"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {isValidUrl && (
        <div className="rounded-md overflow-hidden border bg-muted/30">
          <img
            src={value}
            alt="Banner preview"
            className="w-full max-h-32 object-cover"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
          />
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

// ─── Email preview panel ──────────────────────────────────────────────────────

function EmailPreviewPanel({ html, isMobile: previewMobile }: { html: string; isMobile: boolean }) {
  return (
    <div className="h-full w-full bg-muted/30 overflow-auto">
      <div
        className="transition-all duration-300 mx-auto"
        style={{ maxWidth: previewMobile ? "390px" : "100%" }}
      >
        <iframe
          title="Email Preview"
          srcDoc={html}
          className="w-full border-0"
          style={{ height: "calc(100vh - 60px)", minHeight: "600px" }}
          sandbox="allow-same-origin"
        />
      </div>
    </div>
  );
}

// ─── Main EmailBuilder ────────────────────────────────────────────────────────

const TEMPLATES: { id: TemplateId; label: string }[] = [
  { id: "promocao",   label: "Promoção"   },
  { id: "newsletter", label: "Newsletter" },
  { id: "novidade",   label: "Novidade"   },
];

export default function EmailBuilder({ defaultSalonName, onSave, onCancel, isSaving }: EmailBuilderProps) {
  const isMobile = useIsMobile();
  const [previewMobile, setPreviewMobile] = useState(false);
  const [errors, setErrors] = useState<{ campaignName?: string; subject?: string }>({});

  const [state, setState] = useState<BuilderState>(() =>
    makeDefaultState("promocao", defaultSalonName || "Meu Salão")
  );

  const debouncedState = useDebounced(state, 280);
  const previewHtml = useMemo(() => generateEmailHtml(debouncedState), [debouncedState]);

  const set = <K extends keyof BuilderState>(key: K, value: BuilderState[K]) =>
    setState((s) => ({ ...s, [key]: value }));

  const handleTemplateChange = (id: TemplateId) => {
    const defaults = makeDefaultState(id, state.salonName);
    setState({
      ...defaults,
      campaignName: state.campaignName,
      subject: state.subject,
      bannerUrl: state.bannerUrl,
      preheader: state.preheader,
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

  // ── Left panel (all controls) ──────────────────────────────────────────────
  const LeftPanel = (
    <ScrollArea className="h-full">
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
              <Label className="text-sm">Nome do Salão</Label>
              <Input
                placeholder="Nome do seu salão"
                value={state.salonName}
                onChange={(e) => set("salonName", e.target.value)}
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
          <div className="space-y-1.5">
            <Label className="text-sm">URL da Imagem <span className="text-muted-foreground text-xs">(opcional)</span></Label>
            <BannerUrlInput value={state.bannerUrl} onChange={(v) => set("bannerUrl", v)} />
            <p className="text-xs text-muted-foreground">Cole o link de uma imagem (ex: do Google Drive, Unsplash, Canva, etc.)</p>
          </div>
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
                placeholder="Escreva o texto principal do email aqui...&#10;&#10;Use linha em branco para criar um novo parágrafo."
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
                placeholder="https://beautygest.app/agendar/..."
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
            placeholder="© 2026 Seu Salão. Para cancelar o recebimento, responda este email."
          />
        </div>

        {/* SAVE BAR (mobile only — desktop has it in header) */}
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
    </ScrollArea>
  );

  // ── Right panel (preview) ──────────────────────────────────────────────────
  const RightPanel = (
    <div className="flex flex-col h-full">
      {/* Preview toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/40 flex-shrink-0">
        <p className="text-xs font-medium text-muted-foreground">Prévia do Email</p>
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
      </div>
      <div className="flex-1 overflow-hidden">
        <EmailPreviewPanel html={previewHtml} isMobile={previewMobile} />
      </div>
    </div>
  );

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">
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
        <div className="flex flex-1 overflow-hidden">
          {/* Left controls */}
          <div className="w-[380px] flex-shrink-0 border-r h-full overflow-hidden">
            {LeftPanel}
          </div>
          {/* Right preview */}
          <div className="flex-1 h-full overflow-hidden">
            {RightPanel}
          </div>
        </div>
      )}
    </div>
  );
}
