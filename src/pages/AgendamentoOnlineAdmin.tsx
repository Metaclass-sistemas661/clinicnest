import { useEffect, useMemo, useState } from "react";
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
  Image, MessageSquare,
} from "lucide-react";

// ── Color presets ─────────────────────────────────────────────────────────────

const COLOR_PRESETS = [
  { label: "Roxo",    value: "#7c3aed" },
  { label: "Rosa",    value: "#ec4899" },
  { label: "Verde",   value: "#14b8a6" },
  { label: "Dourado", value: "#d97706" },
  { label: "Escuro",  value: "#1e293b" },
];

// ── Main ──────────────────────────────────────────────────────────────────────

export default function AgendamentoOnlineAdmin() {
  const { tenant, refreshProfile } = useAuth();

  // ── Booking config state ─────────────────────────────────────────────────
  const [isSaving, setIsSaving] = useState(false);
  const [enabled, setEnabled] = useState(false);
  const [slug, setSlug] = useState("");
  const [minLeadMinutes, setMinLeadMinutes] = useState(60);
  const [cancelMinLeadMinutes, setCancelMinLeadMinutes] = useState(240);

  // ── Widget personalisation state (persisted in localStorage) ────────────
  const [widgetColor, setWidgetColor] = useState("#7c3aed");
  const [welcomeMsg, setWelcomeMsg] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [snippetType, setSnippetType] = useState<"iframe" | "script">("iframe");

  // Load booking config from tenant
  useEffect(() => {
    if (!tenant) return;
    setEnabled(tenant.online_booking_enabled === true);
    setSlug(tenant.online_booking_slug || "");
    setMinLeadMinutes(Number(tenant.online_booking_min_lead_minutes ?? 60));
    setCancelMinLeadMinutes(Number(tenant.online_booking_cancel_min_lead_minutes ?? 240));
  }, [tenant]);

  // Load widget config from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("bg-widget-config");
      if (saved) {
        const p = JSON.parse(saved);
        if (p.color) setWidgetColor(p.color);
        if (typeof p.welcome === "string") setWelcomeMsg(p.welcome);
        if (typeof p.logo === "string") setLogoUrl(p.logo);
      }
    } catch { /* ignore */ }
  }, []);

  // ── Derived URLs ──────────────────────────────────────────────────────────

  const publicUrl = useMemo(() => {
    if (typeof window === "undefined") return "";
    const s = slug.trim();
    if (!s) return "";
    return `${window.location.origin}/agendar/${s}`;
  }, [slug]);

  const previewUrl = useMemo(() => {
    if (!publicUrl) return "";
    const params = new URLSearchParams({ embed: "1" });
    if (widgetColor) params.set("primary", widgetColor.replace("#", ""));
    if (welcomeMsg.trim()) params.set("welcome", welcomeMsg.trim());
    if (logoUrl.trim()) params.set("logo", logoUrl.trim());
    return `${publicUrl}?${params.toString()}`;
  }, [publicUrl, widgetColor, welcomeMsg, logoUrl]);

  // ── Snippets ──────────────────────────────────────────────────────────────

  const iframeSnippet = useMemo(() => {
    if (!previewUrl) return "⚠ Configure o slug na aba Configurações para gerar o código.";
    const name = tenant?.name ?? "Salão";
    return `<!-- Agendamento Online - ${name} -->\n<iframe\n  src="${previewUrl}"\n  style="width:100%;height:720px;border:none;border-radius:12px;"\n  loading="lazy"\n  title="Agendar Horário - ${name}"\n></iframe>`;
  }, [previewUrl, tenant]);

  const scriptSnippet = useMemo(() => {
    if (!previewUrl) return "⚠ Configure o slug na aba Configurações para gerar o código.";
    return `<div id="bg-booking"></div>\n<script>\n!function(){\n  var e=document.createElement("iframe");\n  e.src="${previewUrl}";\n  e.style.cssText="width:100%;height:720px;border:none;border-radius:12px;";\n  e.loading="lazy";\n  document.getElementById("bg-booking").appendChild(e);\n}();\n<\/script>`;
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

  const handleSaveWidget = () => {
    try {
      localStorage.setItem("bg-widget-config", JSON.stringify({ color: widgetColor, welcome: welcomeMsg, logo: logoUrl }));
      toast.success("Personalização salva!");
    } catch { /* ignore */ }
  };

  // ── Render ────────────────────────────────────────────────────────────────

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
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Palette className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Personalização do Widget</CardTitle>
                  <CardDescription>Defina a cor, logo e mensagem de boas-vindas do widget embed</CardDescription>
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
                <div className="rounded-lg border p-3 flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-xl flex-shrink-0"
                    style={{ background: widgetColor }}
                  />
                  <p className="text-xs text-muted-foreground">
                    Essa cor será aplicada nos botões, ícones e elementos de destaque do widget.
                  </p>
                </div>
              </div>

              <Separator />

              {/* Logo */}
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5">
                  <Image className="h-3.5 w-3.5" />
                  URL do logo
                  <span className="text-xs text-muted-foreground">(opcional)</span>
                </Label>
                <Input
                  value={logoUrl}
                  onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://meusite.com/logo.png"
                />
                {logoUrl && (
                  <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
                    <img
                      src={logoUrl}
                      alt="Logo preview"
                      className="h-14 w-14 rounded-lg object-contain border bg-white flex-shrink-0"
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.3"; }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Aparece no topo do widget em vez do ícone de tesoura padrão.
                    </p>
                  </div>
                )}
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
                  placeholder="Ex: Bem-vindo ao Salão Bella! Agende seu horário em instantes."
                  rows={2}
                />
                <p className="text-xs text-muted-foreground">
                  Substitui a tagline padrão &ldquo;Agende em segundos. Sem WhatsApp, sem espera.&rdquo;
                </p>
              </div>

              <div className="flex justify-end">
                <Button
                  type="button"
                  className="gradient-primary text-primary-foreground"
                  onClick={handleSaveWidget}
                >
                  <Save className="mr-2 h-4 w-4" />
                  Salvar personalização
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 3 — Widget Embed
        ══════════════════════════════════════════════════════════════════════ */}
        <TabsContent value="embed">
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
