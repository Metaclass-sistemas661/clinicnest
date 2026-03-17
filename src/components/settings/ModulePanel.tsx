import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Calendar,
  ClipboardList,
  Video,
  FileText,
  Smile,
  DollarSign,
  Building2,
  Wallet,
  Package,
  Sparkles,
  Settings,
  Bot,
  Layers,
  RotateCcw,
} from "lucide-react";
import { useEnabledModules } from "@/hooks/useEnabledModules";
import { MODULE_DEFINITIONS } from "@/types/clinic-type-presets";
import { CLINIC_TYPES, type ClinicType } from "@/types/clinic-type-presets";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import type { FeatureKey } from "@/types/subscription-plans";

const ICON_MAP: Record<string, React.ElementType> = {
  Calendar,
  ClipboardList,
  Video,
  FileText,
  Smile,
  DollarSign,
  Building2,
  Wallet,
  Package,
  Sparkles,
  Settings,
  Bot,
};

export default function ModulePanel() {
  const {
    clinicType,
    isModuleEnabled,
    toggleModule,
    applyPreset,
    saveClinicType,
    isSaving,
    rawEnabledModules,
  } = useEnabledModules();

  const { hasFeature } = usePlanFeatures();

  /** Checks if at least one feature in the module is available in the current plan */
  const isModuleAvailableInPlan = (features: FeatureKey[]) => {
    return features.some(f => hasFeature(f));
  };

  const handleClinicTypeChange = (value: string) => {
    saveClinicType(value);
  };

  const handleApplyPreset = () => {
    applyPreset(clinicType as ClinicType);
  };

  const handleResetAll = () => {
    // Reset to all modules — persist null
    applyPreset('multidisciplinar' as ClinicType);
  };

  return (
    <div className="space-y-6">
      {/* Tipo de Clínica */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Tipo de Clínica</CardTitle>
              <CardDescription>
                Escolha o tipo da sua clínica para sugestões de módulos relevantes
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-2 min-w-[240px] flex-1">
              <Label>Especialidade</Label>
              <Select value={clinicType} onValueChange={handleClinicTypeChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o tipo" />
                </SelectTrigger>
                <SelectContent>
                  {CLINIC_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button
              variant="outline"
              onClick={handleApplyPreset}
              disabled={isSaving}
              className="gap-2"
            >
              <RotateCcw className="h-4 w-4" />
              Aplicar Preset
            </Button>
          </div>
          <p className="text-xs text-muted-foreground">
            Ao aplicar o preset, os módulos serão ajustados automaticamente para o tipo de clínica escolhido. Você pode personalizar depois.
          </p>
        </CardContent>
      </Card>

      {/* Painel de Módulos */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-violet-500/10 text-violet-600">
                <Settings className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Módulos Ativos</CardTitle>
                <CardDescription>
                  Ative ou desative módulos para simplificar a navegação
                </CardDescription>
              </div>
            </div>
            {rawEnabledModules !== null && (
              <Button variant="ghost" size="sm" onClick={handleResetAll} className="text-xs gap-1.5">
                <RotateCcw className="h-3.5 w-3.5" />
                Ativar Todos
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2">
            {MODULE_DEFINITIONS.map((mod) => {
              const IconComponent = ICON_MAP[mod.icon] ?? Settings;
              const enabled = isModuleEnabled(mod.key);
              const availableInPlan = isModuleAvailableInPlan(mod.features);

              return (
                <div
                  key={mod.key}
                  className={`flex items-center gap-3 rounded-lg border p-3 transition-colors ${
                    !availableInPlan
                      ? "border-border/50 bg-muted/30 opacity-60"
                      : enabled
                      ? "border-primary/20 bg-primary/5"
                      : "border-border/70"
                  }`}
                >
                  <div
                    className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                      enabled && availableInPlan
                        ? "bg-primary/10 text-primary"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    <IconComponent className="h-4.5 w-4.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium truncate">{mod.label}</span>
                      {!availableInPlan && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 shrink-0">
                          Upgrade
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{mod.description}</p>
                  </div>
                  <Switch
                    checked={enabled}
                    onCheckedChange={() => toggleModule(mod.key)}
                    disabled={isSaving || !availableInPlan}
                  />
                </div>
              );
            })}
          </div>

          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Nota:</strong> Desativar um módulo oculta suas páginas do menu lateral, mas
              não apaga nenhum dado. Você pode reativar a qualquer momento.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
