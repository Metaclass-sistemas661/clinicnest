import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Palette, RotateCcw, Check, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ThemeSettings {
  primary_h: number;
  primary_s: number;
  primary_l: number;
  accent_h: number;
  accent_s: number;
  accent_l: number;
  preset_name: string;
  border_radius: string;
  font_family: string;
}

const PRESETS: Record<string, Partial<ThemeSettings>> = {
  teal: { primary_h: 174, primary_s: 72, primary_l: 38, accent_h: 210, accent_s: 80, accent_l: 55, preset_name: "teal" },
  blue: { primary_h: 210, primary_s: 80, primary_l: 50, accent_h: 174, accent_s: 72, accent_l: 45, preset_name: "blue" },
  purple: { primary_h: 270, primary_s: 70, primary_l: 50, accent_h: 320, accent_s: 70, accent_l: 55, preset_name: "purple" },
  green: { primary_h: 142, primary_s: 70, primary_l: 40, accent_h: 180, accent_s: 60, accent_l: 45, preset_name: "green" },
  orange: { primary_h: 25, primary_s: 90, primary_l: 50, accent_h: 45, accent_s: 85, accent_l: 55, preset_name: "orange" },
  rose: { primary_h: 350, primary_s: 75, primary_l: 55, accent_h: 320, accent_s: 70, accent_l: 50, preset_name: "rose" },
  slate: { primary_h: 215, primary_s: 20, primary_l: 40, accent_h: 210, accent_s: 40, accent_l: 50, preset_name: "slate" },
};

const PRESET_NAMES: Record<string, string> = {
  teal: "Teal Médico (Padrão)",
  blue: "Azul Confiança",
  purple: "Roxo Elegante",
  green: "Verde Saúde",
  orange: "Laranja Energia",
  rose: "Rosa Moderno",
  slate: "Cinza Profissional",
};

const BORDER_RADIUS_OPTIONS = [
  { value: "0", label: "Sem arredondamento" },
  { value: "0.25rem", label: "Mínimo" },
  { value: "0.5rem", label: "Pequeno" },
  { value: "0.75rem", label: "Médio" },
  { value: "1rem", label: "Grande (Padrão)" },
  { value: "1.5rem", label: "Extra grande" },
];

const FONT_OPTIONS = [
  { value: "default", label: "Padrão (Space Grotesk + DM Sans)" },
  { value: "inter", label: "Inter" },
  { value: "roboto", label: "Roboto" },
  { value: "poppins", label: "Poppins" },
  { value: "nunito", label: "Nunito" },
];

export function ThemeCustomizer() {
  const { profile, isAdmin } = useAuth();
  const tenantId = profile?.tenant_id;

  const [settings, setSettings] = useState<ThemeSettings>({
    primary_h: 174, primary_s: 72, primary_l: 38,
    accent_h: 210, accent_s: 80, accent_l: 55,
    preset_name: "teal", border_radius: "1rem", font_family: "default",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (tenantId) loadTheme();
  }, [tenantId]);

  useEffect(() => {
    applyThemeToDOM(settings);
  }, [settings]);

  async function loadTheme() {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_tenant_theme", { p_tenant_id: tenantId });
      if (!error && data) {
        setSettings(data as ThemeSettings);
      }
    } catch (e) {
      console.error("Error loading theme:", e);
    } finally {
      setLoading(false);
    }
  }

  function applyThemeToDOM(theme: ThemeSettings) {
    const root = document.documentElement;
    root.style.setProperty("--primary", `${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%`);
    root.style.setProperty("--ring", `${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%`);
    root.style.setProperty("--accent", `${theme.accent_h} ${theme.accent_s}% ${theme.accent_l}%`);
    root.style.setProperty("--radius", theme.border_radius);
    
    // Update sidebar colors
    root.style.setProperty("--sidebar-primary", `${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%`);
    root.style.setProperty("--sidebar-ring", `${theme.primary_h} ${theme.primary_s}% ${theme.primary_l}%`);
    
    // Update secondary based on primary
    root.style.setProperty("--secondary", `${theme.primary_h} 30% 92%`);
    root.style.setProperty("--secondary-foreground", `${theme.primary_h} 60% 25%`);
  }

  function applyPreset(presetKey: string) {
    const preset = PRESETS[presetKey];
    if (preset) {
      setSettings(prev => ({ ...prev, ...preset }));
    }
  }

  async function saveTheme() {
    if (!isAdmin) {
      toast.error("Apenas administradores podem alterar o tema");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.rpc("upsert_tenant_theme", {
        p_tenant_id: tenantId,
        p_primary_h: settings.primary_h,
        p_primary_s: settings.primary_s,
        p_primary_l: settings.primary_l,
        p_accent_h: settings.accent_h,
        p_accent_s: settings.accent_s,
        p_accent_l: settings.accent_l,
        p_preset_name: settings.preset_name,
        p_border_radius: settings.border_radius,
        p_font_family: settings.font_family,
      });

      if (error) throw error;
      toast.success("Tema salvo com sucesso!");
    } catch (e: any) {
      toast.error("Erro ao salvar tema: " + e.message);
    } finally {
      setSaving(false);
    }
  }

  function resetToDefault() {
    applyPreset("teal");
    setSettings(prev => ({ ...prev, border_radius: "1rem", font_family: "default" }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Preset Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="h-5 w-5" /> Temas Predefinidos
          </CardTitle>
          <CardDescription>Escolha um tema ou personalize as cores</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
            {Object.entries(PRESETS).map(([key, preset]) => (
              <button
                key={key}
                onClick={() => applyPreset(key)}
                className={cn(
                  "relative flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition-all hover:scale-105",
                  settings.preset_name === key ? "border-primary bg-primary/5" : "border-transparent bg-muted/50 hover:border-muted-foreground/20"
                )}
              >
                <div
                  className="w-10 h-10 rounded-full shadow-md"
                  style={{ backgroundColor: `hsl(${preset.primary_h} ${preset.primary_s}% ${preset.primary_l}%)` }}
                />
                <span className="text-xs font-medium text-center">{PRESET_NAMES[key]?.split(" ")[0]}</span>
                {settings.preset_name === key && (
                  <div className="absolute -top-1 -right-1 w-5 h-5 bg-primary rounded-full flex items-center justify-center">
                    <Check className="h-3 w-3 text-primary-foreground" />
                  </div>
                )}
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Custom Colors */}
      <Card>
        <CardHeader>
          <CardTitle>Cores Personalizadas</CardTitle>
          <CardDescription>Ajuste fino das cores do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Primary Color */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Cor Primária</Label>
              <div
                className="w-8 h-8 rounded-full border shadow-sm"
                style={{ backgroundColor: `hsl(${settings.primary_h} ${settings.primary_s}% ${settings.primary_l}%)` }}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Matiz (H)</span>
                <Slider
                  value={[settings.primary_h]}
                  onValueChange={([v]) => setSettings(p => ({ ...p, primary_h: v, preset_name: "custom" }))}
                  max={360} step={1} className="flex-1"
                />
                <span className="text-xs w-8 text-right">{settings.primary_h}°</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Saturação (S)</span>
                <Slider
                  value={[settings.primary_s]}
                  onValueChange={([v]) => setSettings(p => ({ ...p, primary_s: v, preset_name: "custom" }))}
                  max={100} step={1} className="flex-1"
                />
                <span className="text-xs w-8 text-right">{settings.primary_s}%</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Luminosidade (L)</span>
                <Slider
                  value={[settings.primary_l]}
                  onValueChange={([v]) => setSettings(p => ({ ...p, primary_l: v, preset_name: "custom" }))}
                  max={100} step={1} className="flex-1"
                />
                <span className="text-xs w-8 text-right">{settings.primary_l}%</span>
              </div>
            </div>
          </div>

          {/* Accent Color */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Cor de Destaque</Label>
              <div
                className="w-8 h-8 rounded-full border shadow-sm"
                style={{ backgroundColor: `hsl(${settings.accent_h} ${settings.accent_s}% ${settings.accent_l}%)` }}
              />
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Matiz (H)</span>
                <Slider
                  value={[settings.accent_h]}
                  onValueChange={([v]) => setSettings(p => ({ ...p, accent_h: v, preset_name: "custom" }))}
                  max={360} step={1} className="flex-1"
                />
                <span className="text-xs w-8 text-right">{settings.accent_h}°</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Saturação (S)</span>
                <Slider
                  value={[settings.accent_s]}
                  onValueChange={([v]) => setSettings(p => ({ ...p, accent_s: v, preset_name: "custom" }))}
                  max={100} step={1} className="flex-1"
                />
                <span className="text-xs w-8 text-right">{settings.accent_s}%</span>
              </div>
              <div className="flex items-center gap-4">
                <span className="text-xs text-muted-foreground w-20">Luminosidade (L)</span>
                <Slider
                  value={[settings.accent_l]}
                  onValueChange={([v]) => setSettings(p => ({ ...p, accent_l: v, preset_name: "custom" }))}
                  max={100} step={1} className="flex-1"
                />
                <span className="text-xs w-8 text-right">{settings.accent_l}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* UI Settings */}
      <Card>
        <CardHeader>
          <CardTitle>Aparência</CardTitle>
          <CardDescription>Ajuste o estilo visual do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Arredondamento de Bordas</Label>
              <Select value={settings.border_radius} onValueChange={v => setSettings(p => ({ ...p, border_radius: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BORDER_RADIUS_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Fonte</Label>
              <Select value={settings.font_family} onValueChange={v => setSettings(p => ({ ...p, font_family: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FONT_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Pré-visualização</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-3">
            <Button>Botão Primário</Button>
            <Button variant="secondary">Secundário</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destrutivo</Button>
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button variant="outline" onClick={resetToDefault}>
          <RotateCcw className="h-4 w-4 mr-2" /> Restaurar Padrão
        </Button>
        <Button onClick={saveTheme} disabled={saving || !isAdmin}>
          {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Check className="h-4 w-4 mr-2" />}
          Salvar Tema
        </Button>
      </div>
    </div>
  );
}
