import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { Loader2, Plus, Zap } from "lucide-react";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { useLimitCheck } from "@/hooks/useUsageStats";
import { UsageIndicator } from "@/components/subscription/LimitGate";

type TriggerType =
  | "appointment_created"
  | "appointment_reminder_24h"
  | "appointment_reminder_2h"
  | "appointment_completed"
  | "appointment_cancelled"
  | "birthday"
  | "client_inactive_days"
  | "return_reminder"
  | "consent_signed"
  | "return_scheduled"
  | "invoice_created"
  | "exam_ready";

type Channel = "whatsapp" | "email" | "sms";

type AutomationRow = {
  id: string;
  tenant_id: string;
  name: string;
  trigger_type: TriggerType;
  trigger_config: Record<string, unknown>;
  channel: Channel;
  message_template: string;
  is_active: boolean;
  created_at: string;
};

const triggerLabel: Record<TriggerType, string> = {
  appointment_created: "Agendamento criado",
  appointment_reminder_24h: "Lembrete 24h antes",
  appointment_reminder_2h: "Lembrete 2h antes",
  appointment_completed: "Pós-atendimento",
  appointment_cancelled: "Agendamento cancelado",
  birthday: "Aniversário",
  client_inactive_days: "Paciente inativo",
  return_reminder: "Lembrete de retorno",
  consent_signed: "Contrato/Termo assinado",
  return_scheduled: "Retorno agendado",
  invoice_created: "Fatura gerada",
  exam_ready: "Exame disponível",
};

const channelLabel: Record<Channel, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  sms: "SMS",
};

const availableVariables = [
  "{{client_name}}",
  "{{service_name}}",
  "{{date}}",
  "{{time}}",
  "{{professional_name}}",
  "{{clinic_name}}",
  "{{nps_link}}",
  "{{return_reason}}",
  "{{confirm_link}}",
  "{{consent_template}}",
  "{{invoice_amount}}",
  "{{exam_name}}",
  "{{cancel_reason}}",
];

function interpolateTemplate(template: string, vars: Record<string, string>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[String(key)];
    return v ?? "";
  });
}

export default function Automacoes() {
  const { profile, tenant, isAdmin } = useAuth();
  const { isWithinLimit } = usePlanFeatures();
  const { currentValue: automationsCount } = useLimitCheck('automations');
  const [isLoading, setIsLoading] = useState(true);
  const [rows, setRows] = useState<AutomationRow[]>([]);

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [form, setForm] = useState({
    name: "",
    trigger_type: "appointment_created" as TriggerType,
    channel: "whatsapp" as Channel,
    message_template: "",
    inactive_days: 60,
  });

  const exampleVars = useMemo(
    () => ({
      client_name: "Ana",
      service_name: "Consulta",
      date: "10/04",
      time: "14:00",
      professional_name: "Dr. Mariana",
      clinic_name: tenant?.name || "ClinicNest",
      nps_link: `${window.location.origin}/nps/xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx`,
      return_reason: "Acompanhamento pós-procedimento",
      confirm_link: `${window.location.origin}/confirmar-retorno/xxx`,
      consent_template: "Termo de Consentimento Cirúrgico",
      invoice_amount: "R$ 350,00",
      exam_name: "Hemograma Completo",
      cancel_reason: "Paciente solicitou cancelamento",
    }),
    [tenant?.name],
  );

  const preview = useMemo(() => interpolateTemplate(form.message_template || "", exampleVars), [form.message_template, exampleVars]);

  useEffect(() => {
    if (!profile?.tenant_id || !isAdmin) return;
    void fetchAutomations();
  }, [profile?.tenant_id, isAdmin]);

  const fetchAutomations = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setRows(((data as any) ?? []) as AutomationRow[]);
    } catch (err) {
      logger.error("[Automacoes] fetch error", err);
      toast.error("Erro ao carregar automações");
    } finally {
      setIsLoading(false);
    }
  };

  const toggleActive = async (row: AutomationRow) => {
    if (!profile?.tenant_id) return;
    const next = !row.is_active;
    setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: next } : r)));
    try {
      const { error } = await supabase
        .from("automations")
        .update({ is_active: next })
        .eq("id", row.id)
        .eq("tenant_id", profile.tenant_id);
      if (error) throw error;
    } catch (err) {
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, is_active: row.is_active } : r)));
      logger.error("[Automacoes] toggle error", err);
      toast.error("Erro ao atualizar automação");
    }
  };

  const createAutomation = async () => {
    if (!profile?.tenant_id) return;
    if (!form.name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }
    if (!form.message_template.trim()) {
      toast.error("Mensagem é obrigatória");
      return;
    }

    // Verificar limite de automações
    const activeAutomations = rows.filter(r => r.is_active).length;
    if (!isWithinLimit('automations', activeAutomations)) {
      toast.error("Você atingiu o limite de automações do seu plano. Faça upgrade para criar mais.");
      return;
    }

    setIsSaving(true);
    try {
      const trigger_config =
        form.trigger_type === "client_inactive_days" ? { days: Number(form.inactive_days || 60) } : {};

      const payload = {
        tenant_id: profile.tenant_id,
        name: form.name.trim(),
        trigger_type: form.trigger_type,
        trigger_config,
        channel: form.channel,
        message_template: form.message_template,
        is_active: true,
      };

      const { error } = await supabase.from("automations").insert(payload as any);
      if (error) throw error;

      toast.success("Automação criada!");
      setIsDialogOpen(false);
      setForm({
        name: "",
        trigger_type: "appointment_created",
        channel: "whatsapp",
        message_template: "",
        inactive_days: 60,
      });
      await fetchAutomations();
    } catch (err) {
      logger.error("[Automacoes] create error", err);
      toast.error("Erro ao criar automação");
    } finally {
      setIsSaving(false);
    }
  };

  const empty = !isLoading && rows.length === 0;

  return (
    <MainLayout>
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">Automações</h1>
            <p className="text-sm text-muted-foreground">Regras de comunicação por gatilhos do sistema.</p>
          </div>
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Nova automação
          </Button>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle>Regras</CardTitle>
              <CardDescription>Ative/desative e personalize mensagens.</CardDescription>
            </div>
            <UsageIndicator 
              limit="automations" 
              currentValue={rows.filter(r => r.is_active).length} 
              showLabel={false} 
              size="sm" 
              className="w-40"
            />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : empty ? (
              <EmptyState
                icon={Zap}
                title="Nenhuma automação criada"
                description="Crie sua primeira regra para enviar mensagens automaticamente."
                action={
                  <Button onClick={() => setIsDialogOpen(true)}>
                    <Plus className="h-4 w-4" />
                    Criar automação
                  </Button>
                }
              />
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Gatilho</TableHead>
                    <TableHead>Canal</TableHead>
                    <TableHead className="text-right">Ativo</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell>{triggerLabel[r.trigger_type]}</TableCell>
                      <TableCell>{channelLabel[r.channel]}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <Switch checked={r.is_active} onCheckedChange={() => void toggleActive(r)} />
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <FormDrawer
          open={isDialogOpen}
          onOpenChange={setIsDialogOpen}
          title="Nova automação"
          description="Defina gatilho, canal e mensagem."
          width="lg"
          onSubmit={() => void createAutomation()}
          isSubmitting={isSaving}
          submitLabel="Criar"
        >
          <FormDrawerSection title="Identificação">
            <div className="grid gap-2">
              <Label>Nome</Label>
              <Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Gatilho">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Gatilho</Label>
                <Select value={form.trigger_type} onValueChange={(v) => setForm((p) => ({ ...p, trigger_type: v as TriggerType }))}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(triggerLabel) as TriggerType[]).map((t) => (
                      <SelectItem key={t} value={t}>
                        {triggerLabel[t]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.trigger_type === "client_inactive_days" && (
                <div className="grid gap-2">
                  <Label>Dias sem visita</Label>
                  <Input
                    type="number"
                    value={form.inactive_days}
                    onChange={(e) => setForm((p) => ({ ...p, inactive_days: Number(e.target.value || 0) }))}
                  />
                </div>
              )}
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Canal">
            <div className="grid gap-2">
              <Label>Canal</Label>
              <Select value={form.channel} onValueChange={(v) => setForm((p) => ({ ...p, channel: v as Channel }))}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(channelLabel) as Channel[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {channelLabel[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </FormDrawerSection>

          <FormDrawerSection title="Mensagem">
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label>Mensagem</Label>
                <Textarea
                  value={form.message_template}
                  onChange={(e) => setForm((p) => ({ ...p, message_template: e.target.value }))}
                  rows={6}
                />
                <div className="text-xs text-muted-foreground">
                  Variáveis disponíveis: {availableVariables.join(" ")}
                </div>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Preview</CardTitle>
                  <CardDescription>Exemplo com dados fictícios.</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="whitespace-pre-wrap text-sm">{preview || "—"}</div>
                </CardContent>
              </Card>
            </div>
          </FormDrawerSection>
        </FormDrawer>
      </div>
    </MainLayout>
  );
}
