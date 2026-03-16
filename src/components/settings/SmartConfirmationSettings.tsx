import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Bell, Clock, ShieldCheck, ClipboardList } from "lucide-react";

type ChannelOption = "whatsapp" | "email" | "sms";

interface ConfirmationSettings {
  smart_confirmation_enabled: boolean;
  smart_confirmation_4h_channel: ChannelOption;
  smart_confirmation_1h_channel: ChannelOption;
  smart_confirmation_autorelease_minutes: number;
  pre_consultation_enabled: boolean;
}

const channelLabels: Record<ChannelOption, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  sms: "SMS",
};

export function SmartConfirmationSettings() {
  const { profile } = useAuth();
  const [settings, setSettings] = useState<ConfirmationSettings>({
    smart_confirmation_enabled: false,
    smart_confirmation_4h_channel: "whatsapp",
    smart_confirmation_1h_channel: "sms",
    smart_confirmation_autorelease_minutes: 30,
    pre_consultation_enabled: false,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const tenantId = profile?.tenant_id;

  const loadSettings = useCallback(async () => {
    if (!tenantId) return;
    setIsLoading(true);
    try {
      const { data, error } = await (supabase as any)
        .from("tenants")
        .select(
          "smart_confirmation_enabled, smart_confirmation_4h_channel, smart_confirmation_1h_channel, smart_confirmation_autorelease_minutes, pre_consultation_enabled"
        )
        .eq("id", tenantId)
        .single();

      if (error) throw error;
      if (data) {
        setSettings({
          smart_confirmation_enabled: data.smart_confirmation_enabled ?? false,
          smart_confirmation_4h_channel: data.smart_confirmation_4h_channel ?? "whatsapp",
          smart_confirmation_1h_channel: data.smart_confirmation_1h_channel ?? "sms",
          smart_confirmation_autorelease_minutes: data.smart_confirmation_autorelease_minutes ?? 30,
          pre_consultation_enabled: data.pre_consultation_enabled ?? false,
        });
      }
    } catch {
      // Columns may not exist yet — use defaults
    } finally {
      setIsLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  const handleSave = async () => {
    if (!tenantId) return;
    setIsSaving(true);
    try {
      const { error } = await (supabase as any)
        .from("tenants")
        .update({
          smart_confirmation_enabled: settings.smart_confirmation_enabled,
          smart_confirmation_4h_channel: settings.smart_confirmation_4h_channel,
          smart_confirmation_1h_channel: settings.smart_confirmation_1h_channel,
          smart_confirmation_autorelease_minutes: settings.smart_confirmation_autorelease_minutes,
          pre_consultation_enabled: settings.pre_consultation_enabled,
        })
        .eq("id", tenantId);

      if (error) throw error;
      toast.success("Configurações salvas!");
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Confirmação Inteligente */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <Bell className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Confirmação Inteligente</CardTitle>
              <CardDescription>
                Envia lembretes escalonados e libera vaga automaticamente se o paciente não confirmar
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ativar confirmação escalonada</Label>
              <p className="text-xs text-muted-foreground mt-1">
                4h antes → 1h antes → auto-libera vaga
              </p>
            </div>
            <Switch
              checked={settings.smart_confirmation_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, smart_confirmation_enabled: v }))}
            />
          </div>

          {settings.smart_confirmation_enabled && (
            <>
              <Separator />

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    1º Lembrete (4h antes)
                  </Label>
                  <Select
                    value={settings.smart_confirmation_4h_channel}
                    onValueChange={(v) =>
                      setSettings((s) => ({ ...s, smart_confirmation_4h_channel: v as ChannelOption }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(channelLabels).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2 text-sm">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    2º Lembrete (1h antes)
                  </Label>
                  <Select
                    value={settings.smart_confirmation_1h_channel}
                    onValueChange={(v) =>
                      setSettings((s) => ({ ...s, smart_confirmation_1h_channel: v as ChannelOption }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(channelLabels).map(([k, label]) => (
                        <SelectItem key={k} value={k}>
                          {label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2 sm:col-span-2">
                  <Label className="text-sm">
                    Auto-liberar vaga se não confirmar (minutos antes da consulta)
                  </Label>
                  <Input
                    type="number"
                    min={10}
                    max={120}
                    value={settings.smart_confirmation_autorelease_minutes}
                    onChange={(e) =>
                      setSettings((s) => ({
                        ...s,
                        smart_confirmation_autorelease_minutes: Math.max(10, Math.min(120, Number(e.target.value) || 30)),
                      }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Se o paciente não confirmar até esse tempo antes da consulta, a vaga será cancelada e
                    pacientes da lista de espera serão notificados automaticamente.
                  </p>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Questionário Pré-Consulta */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-lg">Questionário Pré-Consulta</CardTitle>
              <CardDescription>
                Pacientes preenchem informações antes da consulta via portal do paciente
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <Label className="text-sm font-medium">Ativar questionário pré-consulta</Label>
              <p className="text-xs text-muted-foreground mt-1">
                Pacientes poderão preencher um formulário ao fazer check-in online
              </p>
            </div>
            <Switch
              checked={settings.pre_consultation_enabled}
              onCheckedChange={(v) => setSettings((s) => ({ ...s, pre_consultation_enabled: v }))}
            />
          </div>

          {settings.pre_consultation_enabled && (
            <p className="text-xs text-muted-foreground bg-muted/50 rounded-md p-3">
              Configure os formulários em <strong>Agendamento → Pré-Consulta</strong> ou na tela de serviços.
              Os campos suportados são: texto, texto longo, seleção, checkbox, número e data.
            </p>
          )}
        </CardContent>
      </Card>

      {/* Save button */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={isSaving} className="gap-2">
          {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}
          Salvar Configurações
        </Button>
      </div>
    </div>
  );
}
