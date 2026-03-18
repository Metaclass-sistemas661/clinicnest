import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bot,
  CheckCircle,
  Zap,
  ClipboardList,
  MessageSquare,
  Bell,
  Stethoscope,
  UserCheck,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { MainLayout } from "@/components/layout/MainLayout";

interface AutonomousConfig {
  auto_checkin_enabled: boolean;
  auto_triage_enabled: boolean;
  auto_prefill_prontuario: boolean;
  auto_notify_doctor: boolean;
  auto_send_prep_instructions: boolean;
  auto_post_consult_summary: boolean;
}

const DEFAULT_CONFIG: AutonomousConfig = {
  auto_checkin_enabled: false,
  auto_triage_enabled: false,
  auto_prefill_prontuario: false,
  auto_notify_doctor: false,
  auto_send_prep_instructions: false,
  auto_post_consult_summary: false,
};

const WORKFLOW_STEPS = [
  {
    key: "auto_send_prep_instructions" as const,
    label: "Instruções de Preparo",
    description: "Envia automaticamente orientações pré-consulta ao paciente (jejum, documentos, etc.)",
    icon: MessageSquare,
    color: "text-blue-600",
  },
  {
    key: "auto_checkin_enabled" as const,
    label: "Check-in Automático",
    description: "Paciente faz check-in pelo celular ao chegar — sem recepção",
    icon: UserCheck,
    color: "text-teal-600",
  },
  {
    key: "auto_triage_enabled" as const,
    label: "Triagem IA Automática",
    description: "IA coleta queixa principal e sinais vitais antes da consulta",
    icon: ClipboardList,
    color: "text-purple-600",
  },
  {
    key: "auto_prefill_prontuario" as const,
    label: "Pré-preenchimento Prontuário",
    description: "IA prepara anamnese e dados do prontuário antes do médico abrir",
    icon: Stethoscope,
    color: "text-amber-600",
  },
  {
    key: "auto_notify_doctor" as const,
    label: "Notificar Médico",
    description: "Avisa o profissional que o paciente está pronto com dados preparados",
    icon: Bell,
    color: "text-red-500",
  },
  {
    key: "auto_post_consult_summary" as const,
    label: "Resumo Pós-Consulta",
    description: "Envia ao paciente um resumo com orientações, receitas e retorno",
    icon: CheckCircle,
    color: "text-green-600",
  },
];

export default function ClinicaAutonoma() {
  const { profile } = useAuth();
  const queryClient = useQueryClient();

  const { data: config, isLoading } = useQuery({
    queryKey: ["autonomous-config", profile?.tenant_id],
    queryFn: async () => {
      if (!profile?.tenant_id) return DEFAULT_CONFIG;
      const { data } = await supabase
        .from("tenants")
        .select("autonomous_config")
        .eq("id", profile.tenant_id)
        .single();
      return (data as Record<string, unknown>)?.autonomous_config as AutonomousConfig || DEFAULT_CONFIG;
    },
    enabled: !!profile?.tenant_id,
  });

  const updateMutation = useMutation({
    mutationFn: async (newConfig: AutonomousConfig) => {
      const { error } = await supabase
        .from("tenants")
        .update({ autonomous_config: newConfig } as never)
        .eq("id", profile!.tenant_id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Configuração atualizada!");
      queryClient.invalidateQueries({ queryKey: ["autonomous-config"] });
    },
    onError: () => toast.error("Erro ao salvar configuração."),
  });

  const handleToggle = (key: keyof AutonomousConfig) => {
    if (!config) return;
    const updated = { ...config, [key]: !config[key] };
    updateMutation.mutate(updated);
  };

  const enabledCount = config ? Object.values(config).filter(Boolean).length : 0;
  const allEnabled = enabledCount === WORKFLOW_STEPS.length;

  if (isLoading) {
    return (
      <MainLayout title="Clínica Autônoma" subtitle="Pipeline de automação inteligente">
        <Card>
          <CardContent className="py-6">
            <Skeleton className="h-64 w-full" />
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout title="Clínica Autônoma" subtitle="Pipeline de automação inteligente">
    <div className="space-y-6">
      {/* Header */}
      <Card className="border-teal-200 dark:border-teal-800 bg-gradient-to-br from-teal-50/60 to-cyan-50/40 dark:from-teal-950/40 dark:to-cyan-950/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100 dark:bg-teal-900/50">
                <Bot className="h-6 w-6 text-teal-700 dark:text-teal-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Clínica Autônoma</CardTitle>
                <CardDescription>
                  Fluxo automatizado: paciente agenda → check-in → triagem IA → prontuário pré-pronto → médico só revisa
                </CardDescription>
              </div>
            </div>
            <Badge variant={allEnabled ? "default" : "secondary"} className={cn(
              "text-xs",
              allEnabled && "bg-teal-600"
            )}>
              {enabledCount}/{WORKFLOW_STEPS.length} ativo{enabledCount !== 1 ? "s" : ""}
            </Badge>
          </div>
        </CardHeader>
      </Card>

      {/* Workflow pipeline */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm flex items-center gap-2">
            <Zap className="h-4 w-4 text-amber-500" />
            Pipeline Autônomo
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          {WORKFLOW_STEPS.map((step, idx) => {
            const Icon = step.icon;
            const isActive = config?.[step.key] ?? false;

            return (
              <div key={step.key}>
                <div className={cn(
                  "flex items-center gap-4 p-3 rounded-lg transition-colors",
                  isActive ? "bg-muted/50" : "opacity-60",
                )}>
                  {/* Step number */}
                  <div className={cn(
                    "flex items-center justify-center h-8 w-8 rounded-full text-xs font-bold shrink-0",
                    isActive ? "bg-teal-100 text-teal-700" : "bg-muted text-muted-foreground"
                  )}>
                    {idx + 1}
                  </div>

                  {/* Icon + Info */}
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <Icon className={cn("h-5 w-5 shrink-0", isActive ? step.color : "text-muted-foreground")} />
                    <div className="min-w-0">
                      <Label className="text-sm font-medium cursor-pointer" htmlFor={step.key}>
                        {step.label}
                      </Label>
                      <p className="text-xs text-muted-foreground truncate">{step.description}</p>
                    </div>
                  </div>

                  {/* Toggle */}
                  <Switch
                    id={step.key}
                    checked={isActive}
                    onCheckedChange={() => handleToggle(step.key)}
                    disabled={updateMutation.isPending}
                  />
                </div>

                {/* Arrow connector */}
                {idx < WORKFLOW_STEPS.length - 1 && (
                  <div className="flex justify-center py-0.5">
                    <ArrowRight className={cn(
                      "h-3 w-3 rotate-90",
                      isActive && config?.[WORKFLOW_STEPS[idx + 1].key]
                        ? "text-teal-400"
                        : "text-muted-foreground/30"
                    )} />
                  </div>
                )}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* How it works */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Como funciona</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            <strong>1. Paciente agenda</strong> → recebe instruções de preparo automaticamente (exames, jejum, documentos).
          </p>
          <p>
            <strong>2. Chega na clínica</strong> → faz check-in pelo celular (QR code/link) — sem fila na recepção.
          </p>
          <p>
            <strong>3. Triagem IA</strong> → chatbot coleta queixa, sinais vitais e histórico relevante.
          </p>
          <p>
            <strong>4. Prontuário pré-pronto</strong> → IA monta anamnese, sugere CID, protocolos e alerta interações.
          </p>
          <p>
            <strong>5. Médico notificado</strong> → recebe alerta de que o paciente está pronto com tudo preparado.
          </p>
          <p>
            <strong>6. Pós-consulta</strong> → paciente recebe resumo com orientações, receitas e data de retorno.
          </p>
        </CardContent>
      </Card>
    </div>
    </MainLayout>
  );
}
