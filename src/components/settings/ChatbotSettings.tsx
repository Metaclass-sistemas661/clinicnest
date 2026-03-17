import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Loader2, Save, Bot, MessageSquare, Clock, Phone } from "lucide-react";

interface ChatbotSettingsData {
  id?: string;
  is_active: boolean;
  welcome_message: string;
  menu_message: string;
  business_hours_start: string;
  business_hours_end: string;
  business_days: number[];
  auto_confirm_booking: boolean;
  transfer_phone: string;
  outside_hours_message: string;
  max_future_days: number;
}

const DEFAULT_SETTINGS: ChatbotSettingsData = {
  is_active: false,
  welcome_message:
    "Olá! 👋 Bem-vindo(a) à nossa clínica. Sou o assistente virtual e posso ajudá-lo(a) com agendamentos, consultas e muito mais.",
  menu_message:
    "Como posso ajudar?\n\n1️⃣ Agendar consulta\n2️⃣ Ver meus agendamentos\n3️⃣ Cancelar agendamento\n4️⃣ Falar com atendente",
  business_hours_start: "08:00",
  business_hours_end: "18:00",
  business_days: [1, 2, 3, 4, 5],
  auto_confirm_booking: false,
  transfer_phone: "",
  outside_hours_message:
    "Nosso horário de atendimento é de segunda a sexta, das 08h às 18h. Deixe sua mensagem e retornaremos em breve! 😊",
  max_future_days: 30,
};

const DAY_LABELS = [
  { value: 0, label: "Dom" },
  { value: 1, label: "Seg" },
  { value: 2, label: "Ter" },
  { value: 3, label: "Qua" },
  { value: 4, label: "Qui" },
  { value: 5, label: "Sex" },
  { value: 6, label: "Sáb" },
];

export default function ChatbotSettings() {
  const { tenant } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState<ChatbotSettingsData>(DEFAULT_SETTINGS);

  useEffect(() => {
    if (!tenant?.id) return;
    void fetchSettings();
  }, [tenant?.id]);

  const fetchSettings = async () => {
    if (!tenant?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("chatbot_settings" as any)
        .select("*")
        .eq("tenant_id", tenant.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        const d = data as any;
        setForm({
          id: d.id,
          is_active: d.is_active ?? false,
          welcome_message: d.welcome_message || DEFAULT_SETTINGS.welcome_message,
          menu_message: d.menu_message || DEFAULT_SETTINGS.menu_message,
          business_hours_start: d.business_hours_start || "08:00",
          business_hours_end: d.business_hours_end || "18:00",
          business_days: d.business_days || [1, 2, 3, 4, 5],
          auto_confirm_booking: d.auto_confirm_booking ?? false,
          transfer_phone: d.transfer_phone || "",
          outside_hours_message: d.outside_hours_message || DEFAULT_SETTINGS.outside_hours_message,
          max_future_days: d.max_future_days ?? DEFAULT_SETTINGS.max_future_days,
        });
      }
    } catch (err) {
      logger.error("[ChatbotSettings] fetch error", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!tenant?.id) return;
    setIsSaving(true);
    try {
      const payload = {
        tenant_id: tenant.id,
        is_active: form.is_active,
        welcome_message: form.welcome_message,
        menu_message: form.menu_message,
        business_hours_start: form.business_hours_start,
        business_hours_end: form.business_hours_end,
        business_days: form.business_days,
        auto_confirm_booking: form.auto_confirm_booking,
        transfer_phone: form.transfer_phone || null,
        outside_hours_message: form.outside_hours_message,
        max_future_days: form.max_future_days,
      };

      if (form.id) {
        const { error } = await supabase
          .from("chatbot_settings" as any)
          .update(payload)
          .eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("chatbot_settings" as any)
          .insert(payload);
        if (error) throw error;
      }

      toast.success("Configurações do chatbot salvas!");
      await fetchSettings();
    } catch (err) {
      logger.error("[ChatbotSettings] save error", err);
      toast.error("Erro ao salvar configurações do chatbot");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleDay = (day: number) => {
    setForm((prev) => ({
      ...prev,
      business_days: prev.business_days.includes(day)
        ? prev.business_days.filter((d) => d !== day)
        : [...prev.business_days, day].sort(),
    }));
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Spinner className="text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Ativação */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/10 text-green-600">
              <Bot className="h-5 w-5" />
            </div>
            <div className="flex-1">
              <CardTitle>Chatbot WhatsApp</CardTitle>
              <CardDescription>
                Assistente virtual que agenda, consulta e cancela atendimentos pelo WhatsApp
              </CardDescription>
            </div>
            <Switch
              checked={form.is_active}
              onCheckedChange={(checked) => setForm((p) => ({ ...p, is_active: checked }))}
            />
          </div>
        </CardHeader>
      </Card>

      {/* Mensagens */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
              <MessageSquare className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Mensagens</CardTitle>
              <CardDescription>Personalize as mensagens do assistente virtual</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <Label>Mensagem de boas-vindas</Label>
            <Textarea
              value={form.welcome_message}
              onChange={(e) => setForm((p) => ({ ...p, welcome_message: e.target.value }))}
              rows={3}
              placeholder="Olá! Bem-vindo(a) à nossa clínica..."
            />
            <p className="text-xs text-muted-foreground">
              Enviada na primeira interação do paciente
            </p>
          </div>

          <div className="space-y-2">
            <Label>Menu principal</Label>
            <Textarea
              value={form.menu_message}
              onChange={(e) => setForm((p) => ({ ...p, menu_message: e.target.value }))}
              rows={5}
              placeholder="Como posso ajudar?..."
            />
            <p className="text-xs text-muted-foreground">
              Exibido após a mensagem de boas-vindas e quando o paciente digita &quot;menu&quot;
            </p>
          </div>

          <div className="space-y-2">
            <Label>Mensagem fora do horário</Label>
            <Textarea
              value={form.outside_hours_message}
              onChange={(e) => setForm((p) => ({ ...p, outside_hours_message: e.target.value }))}
              rows={3}
              placeholder="Nosso horário de atendimento é..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Horário de funcionamento */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Clock className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Horário de Funcionamento</CardTitle>
              <CardDescription>Define quando o chatbot opera no modo automático</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label>Início</Label>
              <Input
                type="time"
                value={form.business_hours_start}
                onChange={(e) => setForm((p) => ({ ...p, business_hours_start: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label>Fim</Label>
              <Input
                type="time"
                value={form.business_hours_end}
                onChange={(e) => setForm((p) => ({ ...p, business_hours_end: e.target.value }))}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Dias de funcionamento</Label>
            <div className="flex flex-wrap gap-2">
              {DAY_LABELS.map((day) => (
                <Button
                  key={day.value}
                  type="button"
                  variant={form.business_days.includes(day.value) ? "default" : "outline"}
                  size="sm"
                  onClick={() => toggleDay(day.value)}
                  className="min-w-[52px]"
                >
                  {day.label}
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configurações de agendamento */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/10 text-purple-600">
              <Phone className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Agendamento & Transferência</CardTitle>
              <CardDescription>Comportamento ao agendar e transferir para humano</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
            <div className="space-y-0.5">
              <Label htmlFor="auto-confirm" className="cursor-pointer font-medium">
                Confirmar agendamentos automaticamente
              </Label>
              <p className="text-sm text-muted-foreground">
                Se desativado, agendamentos ficam como &quot;pendente&quot; até aprovação manual
              </p>
            </div>
            <Switch
              id="auto-confirm"
              checked={form.auto_confirm_booking}
              onCheckedChange={(checked) =>
                setForm((p) => ({ ...p, auto_confirm_booking: checked }))
              }
            />
          </div>

          <div className="space-y-2">
            <Label>Dias máximos para agendamento futuro</Label>
            <Select
              value={String(form.max_future_days)}
              onValueChange={(v) => setForm((p) => ({ ...p, max_future_days: Number(v) }))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="7">7 dias</SelectItem>
                <SelectItem value="14">14 dias</SelectItem>
                <SelectItem value="30">30 dias</SelectItem>
                <SelectItem value="60">60 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Limite de antecedência que o paciente pode agendar pelo chatbot
            </p>
          </div>

          <div className="space-y-2">
            <Label>Telefone para transferência</Label>
            <Input
              value={form.transfer_phone}
              onChange={(e) => setForm((p) => ({ ...p, transfer_phone: e.target.value }))}
              placeholder="(11) 99999-9999"
            />
            <p className="text-xs text-muted-foreground">
              Número exibido quando o paciente solicita falar com um atendente humano
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Salvar */}
      <div className="flex justify-end">
        <Button
          onClick={handleSave}
          disabled={isSaving}
          variant="gradient"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar configurações do chatbot
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
