import { useEffect, useMemo, useRef, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { cn } from "@/lib/utils";
import {
  Copy, ExternalLink, Globe, Loader2, Save, Palette, Code2, Monitor,
  Image, MessageSquare, Upload, Scissors, ShieldCheck, Sparkles, X,
  Info,
} from "lucide-react";

// ── Color presets ─────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: "Roxo",    value: "#7c3aed" },
  { label: "Rosa",    value: "#ec4899" },
  { label: "Verde",   value: "#14b8a6" },
  { label: "Dourado", value: "#d97706" },
  { label: "Escuro",  value: "#1e293b" },
];

// ── Hex → HSL (for preview) ───────────────────────────────────────────────────
function hexToHsl(hex: string): string | null {
  const clean = hex.replace("#", "");
  const res = /^([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(clean);
  if (!res) return null;
  const r = parseInt(res[1], 16) / 255;
  const g = parseInt(res[2], 16) / 255;
  const b = parseInt(res[3], 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`;
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AgendamentoOnlineAdmin() {
  const { tenant, refreshProfile } = useAuth();

  // ── Booking config state ─────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [minLeadMinutes, setMinLeadMinutes] = useState(60);
  const [cancelMinLeadMinutes, setCancelMinLeadMinutes] = useState(240);

  // ── Widget personalisation state ─────────────────────────────────────────
  const [widgetColor, setWidgetColor] = useState("#7c3aed");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  // Logo can be a URL or a base64 data URL (from file upload)
  const [logoUrl, setLogoUrl] = useState("");       // URL externa
  const [logoDataUrl, setLogoDataUrl] = useState(""); // arquivo local (base64)
  const [isSavingWidget, setIsSavingWidget] = useState(false);

  const [snippetType, setSnippetType] = useState<"iframe" | "script">("iframe");

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Effective logo = uploaded file takes priority, then URL
  const effectiveLogo = logoDataUrl || logoUrl;

  // Load booking config from tenant
  useEffect(() => {
    if (!tenant) return;
    setEnabled(tenant.online_booking_enabled === true);
    setSlug(tenant.online_booking_slug || "");
    setMinLeadMinutes(Number(tenant.online_booking_min_lead_minutes ?? 60));
    setCancelMinLeadMinutes(Number(tenant.online_booking_cancel_min_lead_minutes ?? 240));
  }, [tenant]);

  // Load widget config — Supabase first, localStorage fallback
  useEffect(() => {
    const loadConfig = async () => {
      // Try Supabase
      if (tenant?.id) {
        try {
          const { data } = await (supabase as any)
            .from("tenants")
            .select("widget_config")
            .eq("id", tenant.id)
            .maybeSingle();
          if (data?.widget_config) {
            const wc = data.widget_config as { color?: string; welcome?: string; logo?: string };
            if (wc.color) setWidgetColor(wc.color);
            if (typeof wc.welcome === "string") setWelcomeMsg(wc.welcome);
            if (typeof wc.logo === "string") {
              if (wc.logo.startsWith("data:")) setLogoDataUrl(wc.logo);
              else setLogoUrl(wc.logo);
            }
            return; // loaded from Supabase, skip localStorage
          }
        } catch { /* ignore — column may not exist yet */ }
      }
      // localStorage fallback
      try {
        const saved = localStorage.getItem("bg-widget-config");
        if (saved) {
          const p = JSON.parse(saved) as { color?: string; welcome?: string; logo?: string };
          if (p.color) setWidgetColor(p.color);
          if (typeof p.welcome === "string") setWelcomeMsg(p.welcome);
          if (typeof p.logo === "string") {
            if (p.logo.startsWith("data:")) setLogoDataUrl(p.logo);
            else setLogoUrl(p.logo);
          }
        }
      } catch { /* ignore */ }
    };
    loadConfig();
  }, [tenant?.id]);

  // ── Derived URLs ──────────────────────────────────────────────────────────

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const s = slug.trim();
    if (!s) return "";
    return `${window.location.origin}/agendar/${s}`;
  }, [slug]);

  // previewUrl: for the live iframe preview
  // Logo: use data URL if uploaded (passed via localStorage), URL otherwise (in param)
  const previewUrl = useMemo(() => {
    if (!publicUrl) return "";
    const params = new URLSearchParams({ embed: "1" });
    if (widgetColor) params.set("primary", widgetColor.replace("#", ""));
    if (welcomeMsg.trim()) params.set("welcome", welcomeMsg.trim());
    // Only put logo in URL param if it's a real URL (not base64 — too long)
    if (logoUrl.trim() && !logoUrl.startsWith("data:")) params.set("logo", logoUrl.trim());
    return `${publicUrl}?${params.toString()}`;
  }, [publicUrl, widgetColor, welcomeMsg, logoUrl]);

  // ── Snippets ──────────────────────────────────────────────────────────────

  const iframeSnippet = useMemo(() => {
    if (!previewUrl) return "⚠ Configure o slug na aba Configurações para gerar o código.";
    const name = tenant?.name ?? "Clínica";
    return `<!-- Agendamento Online - ${name} -->\n<iframe\n  src="${previewUrl}"\n  style="width:100%;height:720px;border:none;border-radius:12px;"\n  loading="lazy"\n  title="Agendar Horário - ${name}"\n></iframe>`;
  }, [previewUrl, tenant]);

  const scriptSnippet = useMemo(() => {
    if (!previewUrl) return "⚠ Configure o slug na aba Configurações para gerar o código.";
    return `<div id="bg-booking"></div>\n<script>\n!function(){\n  var e=document.createElement("iframe");\n  e.src="${previewUrl}";\n  e.style.cssText="width:100%;height:720px;border:none;border-radius:12px;";\n  e.loading="lazy";\n  document.getElementById("bg-booking").appendChild(e);\n}();\n</script>`;
  }, [previewUrl]);

  const activeSnippet = snippetType === "iframe" ? iframeSnippet : scriptSnippet;

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleCopy = async (text: string, msg = "Copiado!") => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(msg);
    } catch {
      toast.error("Não foi possível copiar automaticamente.");
    }
  };

  const handleOpen = (url: string) => {
    if (!url) { toast.error("Defina o slug primeiro."); return; }
    window.open(url, "_blank", "noopener,noreferrer");
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    const s = slug.trim();
    if (enabled && !s) { toast.error("Informe um slug para habilitar o agendamento online"); return; }
    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          online_booking_enabled: enabled,
          online_booking_slug: s || null,
          online_booking_min_lead_minutes: Number(minLeadMinutes || 0) || 60,
          online_booking_cancel_min_lead_minutes: Number(cancelMinLeadMinutes || 0) || 240,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        } as any)
        .eq("id", tenant.id);
      if (error) throw error;
      toast.success("Configurações salvas!");
      refreshProfile();
    } catch (e) {
      logger.error("[AgendamentoOnlineAdmin] save error", e);
      toast.error("Erro ao salvar");
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveWidget = async () => {
    if (!tenant?.id) return;
    setIsSavingWidget(true);
    const config = { color: widgetColor, welcome: welcomeMsg, logo: effectiveLogo };

    // 1. Save to localStorage (immediate, same-browser preview)
    try {
      localStorage.setItem("bg-widget-config", JSON.stringify(config));
    } catch { /* ignore */ }

    // 2. Save to Supabase widget_config column (works for all visitors)
    try {
      const { error } = await (supabase as any)
        .from("tenants")
        .update({ widget_config: config })
        .eq("id", tenant.id);
      if (error) {
        // Column may not exist yet — not critical
        logger.warn("[Widget] widget_config column not found, using localStorage only", error);
        toast.success("Personalização salva! (localmente)");
      } else {
        toast.success("Personalização salva com sucesso!");
      }
    } catch {
      toast.success("Personalização salva! (localmente)");
    } finally {
      setIsSavingWidget(false);
    }
  };

  // ── Logo file upload ──────────────────────────────────────────────────────

  const handleLogoFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const MAX_SIZE = 512 * 1024; // 512 KB
    if (file.size > MAX_SIZE) {
      toast.error("Arquivo muito grande. Use imagens com até 512 KB.");
      return;
    }

    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result;
      if (typeof result === "string") {
        setLogoDataUrl(result);
        setLogoUrl(""); // clear URL field when file is selected
      }
    };
    reader.readAsDataURL(file);
  };

  const clearLogo = () => {
    setLogoDataUrl("");
    setLogoUrl("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ── Render ────────────────────────────────────────────────────────────────

  const primaryHsl = hexToHsl(widgetColor) ?? "#7c3aed";

  return (
    <MainLayout
      title="Agendamento Online"
      subtitle="Configure e incorpore o widget de agendamento no seu site"
    >
      <Tabs defaultValue="config" className="space-y-6">
        <TabsList className="grid w-full max-w-lg grid-cols-3">
          <TabsTrigger value="config" className="gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="personalizar" className="gap-1.5">
            <Palette className="h-3.5 w-3.5" />
            Personalizar
          </TabsTrigger>
          <TabsTrigger value="embed" className="gap-1.5">
            <Code2 className="h-3.5 w-3.5" />
            Widget Embed
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 1 — Configurações
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="config">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Globe className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Link público</CardTitle>
                    <CardDescription>Ative, defina o slug e configure as regras de agendamento</CardDescription>
                  </div>
                </div>
                <Badge variant={enabled ? "default" : "secondary"}>
                  {enabled ? "Ativo" : "Inativo"}
                </Badge>
              </div>
            </CardHeader>

            <CardContent className="space-y-5">
              {/* Enable toggle */}
              <div className="flex items-center justify-between rounded-lg border border-border/70 p-4">
                <div>
                  <Label htmlFor="online-booking-enabled" className="cursor-pointer">
                    Habilitar agendamento online
                  </Label>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Recomendado para captar clientes e reduzir trabalho no WhatsApp.
                  </p>
                </div>
                <Switch
                  id="online-booking-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
              </div>

              {/* Slug + public URL */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Slug do link</Label>
                  <Input
                    value={slug}
                    onChange={(e) => setSlug(e.target.value)}
                    placeholder="meu-salao"
                  />
                  <p className="text-xs text-muted-foreground">O link ficará em /agendar/&lt;slug&gt;</p>
                </div>
                <div className="space-y-2">
                  <Label>Link público</Label>
                  <Input readOnly value={publicUrl} placeholder="Defina o slug para ver o link" />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopy(publicUrl, "Link copiado!")}
                      disabled={!publicUrl}
                    >
                      <Copy className="mr-2 h-4 w-4" />Copiar
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpen(publicUrl)}
                      disabled={!publicUrl}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />Abrir
                    </Button>
                  </div>
                </div>
              </div>

              {/* Lead times */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Antecedência mínima (minutos)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={String(minLeadMinutes)}
                    onChange={(e) => setMinLeadMinutes(Number(e.target.value || 0))}
                    placeholder="60"
                  />
                  <p className="text-xs text-muted-foreground">Evita agendamentos muito em cima da hora.</p>
                </div>
                <div className="space-y-2">
                  <Label>Antecedência p/ cancelar (minutos)</Label>
                  <Input
                    type="number"
                    min={0}
                    step={1}
                    value={String(cancelMinLeadMinutes)}
                    onChange={(e) => setCancelMinLeadMinutes(Number(e.target.value || 0))}
                    placeholder="240"
                  />
                  <p className="text-xs text-muted-foreground">Define a janela mínima para cancelamento.</p>
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gradient-primary text-primary-foreground"
                  onClick={handleSave}
                  disabled={!tenant?.id || isSaving}
                >
                  {isSaving
                    ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                    : <><Save className="mr-2 h-4 w-4" />Salvar configurações</>
                  }
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 2 — Personalizar
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="personalizar">
          <div className="grid gap-6 lg:grid-cols-[1fr_320px]">

            {/* ── Left: controls ── */}
            <Card>
              <CardHeader>
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Palette className="h-5 w-5" />
                  </div>
                  <div>
                    <CardTitle>Personalização da Página de Agendamento</CardTitle>
                    <CardDescription>
                      As alterações são salvas e aparecem automaticamente para todos os clientes que acessarem o link de agendamento.
                    </CardDescription>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                {/* Color */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5">
                    <Palette className="h-3.5 w-3.5" />
                    Cor principal
                  </Label>
                  <div className="flex flex-wrap items-center gap-2">
                    {COLOR_PRESETS.map((c) => (
                      <button
                        key={c.value}
                        type="button"
                        title={c.label}
                        onClick={() => setWidgetColor(c.value)}
                        className={cn(
                          "h-9 w-9 rounded-full border-2 transition-all",
                          widgetColor === c.value
                            ? "border-foreground scale-110 shadow-md"
                            : "border-transparent hover:scale-105"
                        )}
                        style={{ background: c.value }}
                      />
                    ))}
                    <input
                      type="color"
                      value={widgetColor}
                      onChange={(e) => setWidgetColor(e.target.value)}
                      className="h-9 w-9 rounded-full border-2 border-border cursor-pointer p-0.5 bg-transparent"
                      title="Cor personalizada"
                    />
                    <span className="text-sm font-mono text-muted-foreground">{widgetColor}</span>
                  </div>
                </div>

                <Separator />

                {/* Logo */}
                <div className="space-y-3">
                  <Label className="flex items-center gap-1.5">
                    <Image className="h-3.5 w-3.5" />
                    Logo
                    <span className="text-xs text-muted-foreground">(opcional)</span>
                  </Label>

                  {/* Hidden file input */}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/svg+xml"
                    className="sr-only"
                    onChange={handleLogoFileChange}
                  />

                  {/* Logo options */}
                  {!effectiveLogo ? (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {/* Upload button */}
                      <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border p-5 text-center hover:border-primary/50 hover:bg-primary/5 transition-all group"
                      >
                        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-muted group-hover:bg-primary/10 transition-colors">
                          <Upload className="h-5 w-5 text-muted-foreground group-hover:text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-medium">Upload do computador</p>
                          <p className="text-xs text-muted-foreground mt-0.5">PNG, JPG, SVG · até 512 KB</p>
                        </div>
                      </button>

                      {/* URL input */}
                      <div className="flex flex-col gap-2 rounded-xl border-2 border-border p-4">
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          URL externa
                        </p>
                        <Input
                          value={logoUrl}
                          onChange={(e) => { setLogoUrl(e.target.value); setLogoDataUrl(""); }}
                          placeholder="https://meusite.com/logo.png"
                          className="h-9 text-sm"
                        />
                      </div>
                    </div>
                  ) : (
                    /* Logo preview */
                    <div className="rounded-xl border bg-muted/20 p-4">
                      <div className="flex items-center gap-4">
                        {/* 64×64 preview — same size as in the widget */}
                        <div className="relative flex-shrink-0">
                          <div className="h-16 w-16 rounded-2xl border-2 border-dashed border-primary/30 overflow-hidden bg-white flex items-center justify-center shadow-sm">
                            <img
                              src={effectiveLogo}
                              alt="Logo preview"
                              className="h-full w-full object-contain p-1"
                              onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                            />
                          </div>
                          <span className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] text-muted-foreground whitespace-nowrap">
                            64×64px
                          </span>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground">Logo configurado</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {logoDataUrl ? "Arquivo local (base64)" : logoUrl}
                          </p>
                          <div className="flex flex-wrap gap-2 mt-2">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-7 text-xs gap-1"
                              onClick={() => fileInputRef.current?.click()}
                            >
                              <Upload className="h-3 w-3" /> Trocar arquivo
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs gap-1 text-destructive hover:text-destructive"
                              onClick={clearLogo}
                            >
                              <X className="h-3 w-3" /> Remover
                            </Button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Size guide */}
                  <div className="flex items-start gap-2 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 p-3">
                    <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                    <div className="text-xs text-blue-700 dark:text-blue-300 space-y-0.5">
                      <p className="font-medium">Tamanho ideal de logo</p>
                      <p>Quadrado (1:1) · Mínimo 200×200px · PNG com fundo transparente</p>
                      <p>O logo é exibido num espaço de <strong>64×64px</strong> com bordas arredondadas.</p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Welcome message */}
                <div className="space-y-2">
                  <Label className="flex items-center gap-1.5">
                    <MessageSquare className="h-3.5 w-3.5" />
                    Mensagem de boas-vindas
                    <span className="text-xs text-muted-foreground">(opcional)</span>
                  </Label>
                  <Textarea
                    value={welcomeMsg}
                    onChange={(e) => setWelcomeMsg(e.target.value)}
                    placeholder="Ex: Bem-vindo à Clínica Bella! Agende sua consulta em instantes."
                    rows={2}
                  />
                  <p className="text-xs text-muted-foreground">
                    Substitui a tagline padrão "Agende em segundos. Sem WhatsApp, sem espera."
                  </p>
                </div>

                <div className="flex justify-end">
                  <Button
                    type="button"
                    className="gradient-primary text-primary-foreground"
                    onClick={handleSaveWidget}
                    disabled={isSavingWidget}
                  >
                    {isSavingWidget
                      ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                      : <><Save className="mr-2 h-4 w-4" />Salvar personalização</>
                    }
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* ── Right: live branding preview ── */}
            <div className="space-y-3">
              <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Monitor className="h-4 w-4" />
                Preview do cabeçalho
              </p>
              <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
                {/* Gradient header area */}
                <div
                  className="h-2"
                  style={{ background: `linear-gradient(to right, ${primaryHsl}, ${primaryHsl}aa)` }}
                />
                <div className="px-5 py-6 flex flex-col items-center gap-3 text-center bg-gradient-to-b from-background to-muted/20">
                  {/* Logo slot — 64×64px */}
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-2xl shadow-sm ring-2 ring-white/50 overflow-hidden"
                    style={{ background: `${primaryHsl}1a` }}
                  >
                    {effectiveLogo ? (
                      <img
                        src={effectiveLogo}
                        alt="Logo"
                        className="h-full w-full object-contain p-1"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                          (e.currentTarget.parentElement as HTMLElement)?.querySelector(".fallback-icon")?.removeAttribute("style");
                        }}
                      />
                    ) : (
                      <Scissors className="h-8 w-8" style={{ color: primaryHsl }} />
                    )}
                  </div>

                  {/* Name + welcome */}
                  <div>
                    <p className="text-base font-bold tracking-tight text-foreground">
                      {tenant?.name || "Nome da Clínica"}
                    </p>
                    <p className="mt-0.5 text-xs text-muted-foreground max-w-[200px]">
                      {welcomeMsg.trim() || "Agende em segundos. Sem WhatsApp, sem espera."}
                    </p>
                  </div>

                  {/* Trust badges */}
                  <div className="flex flex-wrap justify-center gap-1.5">
                    <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background px-2.5 py-1 text-[10px] text-muted-foreground">
                      <ShieldCheck className="h-3 w-3 text-green-500" />
                      Confirmação imediata
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px]"
                      style={{ borderColor: `${primaryHsl}40`, color: primaryHsl, background: `${primaryHsl}0d` }}
                    >
                      <Sparkles className="h-3 w-3" />
                      Horários em tempo real
                    </span>
                  </div>
                </div>

                {/* CTA mock */}
                <div className="px-5 pb-5 pt-2">
                  <div
                    className="w-full rounded-xl py-3 text-center text-sm font-semibold text-white shadow-sm"
                    style={{ background: primaryHsl }}
                  >
                    Selecionar serviço →
                  </div>
                </div>
              </div>

              <p className="text-xs text-center text-muted-foreground">
                Preview do cabeçalho real da página de agendamento
              </p>
            </div>
          </div>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 3 — Widget Embed
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="embed">
          {/* Explanation banner */}
          <div className="mb-6 rounded-xl border border-primary/20 bg-primary/5 p-4 flex gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Globe className="h-5 w-5" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-foreground">O que é o Widget Embed?</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                É um trecho de código HTML que você cola no <strong>seu próprio site</strong> (Wix, WordPress, Webflow, link na bio, etc.) para que seus clientes agendem diretamente lá — sem precisar sair da sua página. O widget é o mesmo formulário de agendamento, incorporado como uma janela no seu site, com suas cores e logo personalizados.
              </p>
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-[420px_1fr]">

            {/* ── Left: snippet controls ── */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Code2 className="h-4 w-4" />
                    Código para Incorporar
                  </CardTitle>
                  <CardDescription>
                    Cole esse código no seu site Wix, WordPress, Webflow ou HTML puro.
                  </CardDescription>
                </CardHeader>

                <CardContent className="space-y-4">
                  {!publicUrl && (
                    <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-300">
                      ⚠ Configure o slug na aba <strong>Configurações</strong> para gerar o código.
                    </div>
                  )}

                  {/* Snippet type */}
                  <div className="space-y-2">
                    <Label>Tipo de snippet</Label>
                    <div className="grid grid-cols-2 gap-2">
                      {(["iframe", "script"] as const).map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setSnippetType(t)}
                          className={cn(
                            "rounded-lg border-2 p-3 text-left transition-all",
                            snippetType === t
                              ? "border-primary bg-primary/5"
                              : "border-border hover:border-primary/40"
                          )}
                        >
                          <p className="text-sm font-medium">
                            {t === "iframe" ? "iframe direto" : "script loader"}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t === "iframe" ? "Mais simples, HTML puro" : "Para sites com JavaScript"}
                          </p>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Snippet display */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label>Snippet</Label>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCopy(activeSnippet, "Snippet copiado!")}
                        disabled={!publicUrl}
                      >
                        <Copy className="mr-1 h-3 w-3" />
                        Copiar
                      </Button>
                    </div>
                    <pre className="rounded-lg border bg-muted/50 p-3 text-xs font-mono overflow-x-auto whitespace-pre-wrap break-all leading-relaxed min-h-[120px]">
                      {activeSnippet}
                    </pre>
                  </div>

                  <Separator />

                  {/* Instructions */}
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                      Como instalar
                    </p>
                    <ol className="space-y-2 text-xs text-muted-foreground">
                      <li className="flex gap-1.5">
                        <span className="font-bold text-foreground shrink-0">1.</span>
                        Copie o snippet acima
                      </li>
                      <li className="flex gap-1.5">
                        <span className="font-bold text-foreground shrink-0">2.</span>
                        Cole no HTML da sua página onde deseja exibir o widget
                      </li>
                      <li className="flex gap-1.5">
                        <span className="font-bold text-foreground shrink-0">3.</span>
                        Ajuste a altura (720px) conforme sua necessidade
                      </li>
                      <li className="flex gap-1.5">
                        <span className="font-bold text-foreground shrink-0">4.</span>
                        Personalize cores e mensagem na aba <strong>Personalizar</strong>
                      </li>
                    </ol>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* ── Right: live preview ── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">Preview ao vivo</span>
                  <Badge variant="outline" className="text-xs">tempo real</Badge>
                </div>
                {publicUrl && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleOpen(previewUrl)}
                  >
                    <ExternalLink className="mr-1.5 h-3.5 w-3.5" />
                    Abrir em nova aba
                  </Button>
                )}
              </div>

              {/* Browser chrome mockup */}
              <div className="rounded-xl border bg-muted/30 overflow-hidden" style={{ minHeight: 620 }}>
                <div className="flex items-center gap-2 border-b bg-background/90 px-4 py-2.5">
                  <div className="flex gap-1.5">
                    <span className="h-3 w-3 rounded-full bg-red-400/80" />
                    <span className="h-3 w-3 rounded-full bg-yellow-400/80" />
                    <span className="h-3 w-3 rounded-full bg-green-400/80" />
                  </div>
                  <div className="flex-1 rounded-md bg-muted px-3 py-1 text-xs text-muted-foreground font-mono truncate">
                    {previewUrl || "Configure o slug para ver o preview"}
                  </div>
                </div>

                {previewUrl ? (
                  <iframe
                    key={previewUrl}
                    src={previewUrl}
                    className="w-full"
                    style={{ height: 620, border: "none" }}
                    title="Preview do widget"
                  />
                ) : (
                  <div className="flex flex-col items-center justify-center gap-3 py-24 text-center px-6">
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted text-muted-foreground">
                      <Monitor className="h-7 w-7" />
                    </div>
                    <p className="text-sm text-muted-foreground max-w-xs">
                      Configure o slug na aba <strong>Configurações</strong> para ver o preview ao vivo.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
