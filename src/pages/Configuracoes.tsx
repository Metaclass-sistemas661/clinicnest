import { useState, useEffect, lazy, Suspense } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Spinner } from "@/components/ui/spinner";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import {
  Settings,
  Loader2,
  Building,
  Save,
  Trophy,
  Sliders,
  ShieldCheck,
  Smartphone,
  Bot,
  CalendarPlus,
  Shield,
  Plug,
  Layers,
  Coins,
} from "lucide-react";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";
import { useLocation, useSearchParams } from "react-router-dom";
import { useSimpleMode } from "@/lib/simple-mode";
import CertificateManager from "@/components/settings/CertificateManager";
import SmsConfig from "@/components/settings/SmsConfig";
import ChatbotSettings from "@/components/settings/ChatbotSettings";
import { SmartConfirmationSettings } from "@/components/settings/SmartConfirmationSettings";

const LazyGerenciarPermissoes = lazy(() => import("@/pages/GerenciarPermissoes"));
const LazyIntegracoes = lazy(() => import("@/pages/Integracoes"));
const LazyModulePanel = lazy(() => import("@/components/settings/ModulePanel"));
const LazyHealthCredits = lazy(() => import("@/components/settings/HealthCreditsSettings"));

export default function Configuracoes() {
  const { user, profile: _profile, tenant, isAdmin, refreshProfile } = useAuth();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const { enabled: simpleModeEnabled, set: setSimpleModeEnabled } = useSimpleMode(tenant?.id);
  const [isSaving, setIsSaving] = useState(false);
  const [isSavingGamification, setIsSavingGamification] = useState(false);

  const [activeTab, setActiveTab] = useState(() => searchParams.get("tab") || "clinica");

  useEffect(() => {
    const tab = searchParams.get("tab");
    if (tab && tab !== activeTab) setActiveTab(tab);
  }, [searchParams]);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setSearchParams(value === "clinica" ? {} : { tab: value }, { replace: true });
  };

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    address: "",
    billingCpfCnpj: "",
  });

  const [tenantGamificationEnabled, setTenantGamificationEnabled] = useState(true);
  const [patientBookingEnabled, setPatientBookingEnabled] = useState(true);
  const [isSavingBooking, setIsSavingBooking] = useState(false);

  useEffect(() => {
    if (tenant) {
      setFormData({
        name: tenant.name || "",
        phone: tenant.phone || "",
        email: tenant.email || "",
        address: tenant.address || "",
        billingCpfCnpj: tenant.billing_cpf_cnpj || "",
      });
      setTenantGamificationEnabled(tenant.gamification_enabled ?? true);
      setPatientBookingEnabled(tenant.patient_booking_enabled ?? true);
    }
  }, [tenant]);

  useEffect(() => {
    const state = location.state as any;
    if (state?.reason === "missing_billing_cpf_cnpj") {
      toast.error("Para continuar, informe o CPF/CNPJ em Configurações.");
    }
  }, [location.state]);

  const writeAuditLog = async (
    action: string,
    entityType: string,
    entityId?: string | null,
    metadata?: Record<string, unknown>
  ) => {
    if (!tenant?.id) return;
    const { error } = await supabase.rpc("log_admin_action", {
      p_tenant_id: tenant.id,
      p_action: action,
      p_entity_type: entityType,
      p_entity_id: entityId ?? null,
      p_metadata: (metadata ?? {}) as unknown as Json,
    });
    if (error) {
      logger.warn("Falha ao gravar trilha de auditoria", { action, entityType, error });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;

    setIsSaving(true);

    try {
      const { error } = await supabase
        .from("tenants")
        .update({
          name: formData.name,
          phone: formData.phone || null,
          email: formData.email || null,
          address: formData.address || null,
          billing_cpf_cnpj: formData.billingCpfCnpj || null,
        })
        .eq("id", tenant.id);

      if (error) throw error;

      await writeAuditLog("tenant_settings_updated", "tenants", tenant.id, {
        name: formData.name,
        email: formData.email || null,
        phone: formData.phone || null,
        billing_cpf_cnpj: formData.billingCpfCnpj || null,
      });

      toast.success("Configurações salvas com sucesso!");
      refreshProfile();
    } catch (error) {
      toast.error("Erro ao salvar configurações", { description: normalizeError(error, "Não foi possível salvar as configurações da clínica.") });
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveGamification = async () => {
    if (!tenant?.id) return;

    setIsSavingGamification(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ gamification_enabled: tenantGamificationEnabled })
        .eq("id", tenant.id);

      if (error) throw error;

      toast.success("Configuração de gamificação salva");
      refreshProfile();
    } catch (err) {
      logger.error("Erro ao salvar configuração de gamificação:", err);
      toast.error("Erro ao salvar configuração", { description: normalizeError(err, "Não foi possível salvar a gamificação.") });
    } finally {
      setIsSavingGamification(false);
    }
  };

  const handleSaveBooking = async () => {
    if (!tenant?.id) return;

    setIsSavingBooking(true);
    try {
      const { error } = await supabase
        .from("tenants")
        .update({ patient_booking_enabled: patientBookingEnabled } as any)
        .eq("id", tenant.id);

      if (error) throw error;

      await writeAuditLog("patient_booking_settings_updated", "tenants", tenant.id, {
        patient_booking_enabled: patientBookingEnabled,
      });

      toast.success("Configuração de agendamento do portal salva");
      refreshProfile();
    } catch (err) {
      logger.error("Erro ao salvar configuração de agendamento pelo paciente:", err);
      toast.error("Erro ao salvar configuração", { description: normalizeError(err, "Não foi possível salvar a configuração.") });
    } finally {
      setIsSavingBooking(false);
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Configurações" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Settings className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem acessar as configurações
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Configurações"
      subtitle="Dados da clínica e preferências do sistema"
    >
      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="clinica" className="gap-2">
            <Building className="h-4 w-4" />
            Clínica
          </TabsTrigger>
          <TabsTrigger value="agendamento" className="gap-2">
            <CalendarPlus className="h-4 w-4" />
            Agendamento
          </TabsTrigger>
          <TabsTrigger value="certificados" className="gap-2">
            <ShieldCheck className="h-4 w-4" />
            Certificados
          </TabsTrigger>
          <TabsTrigger value="sms" className="gap-2">
            <Smartphone className="h-4 w-4" />
            SMS
          </TabsTrigger>
          <TabsTrigger value="chatbot" className="gap-2">
            <Bot className="h-4 w-4" />
            Chatbot
          </TabsTrigger>
          <TabsTrigger value="preferencias" className="gap-2">
            <Sliders className="h-4 w-4" />
            Preferências
          </TabsTrigger>
          <TabsTrigger value="permissoes" className="gap-2">
            <Shield className="h-4 w-4" />
            Permissões
          </TabsTrigger>
          <TabsTrigger value="integracoes" className="gap-2">
            <Plug className="h-4 w-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="fidelidade" className="gap-2">
            <Coins className="h-4 w-4" />
            Fidelidade
          </TabsTrigger>
          <TabsTrigger value="modulos" className="gap-2">
            <Layers className="h-4 w-4" />
            Módulos
          </TabsTrigger>
        </TabsList>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 1 — Dados da Clínica
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="clinica">
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <Building className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Dados da Clínica</CardTitle>
                  <CardDescription>Informações básicas do estabelecimento</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid gap-6 md:grid-cols-2">
                  <div className="space-y-2 md:col-span-2">
                    <Label>Nome da Clínica</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Nome da sua clínica"
                      required
                      data-tour="settings-clinic-name"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>CPF/CNPJ (faturamento)</Label>
                    <Input
                      value={formData.billingCpfCnpj}
                      onChange={(e) => setFormData({ ...formData, billingCpfCnpj: e.target.value })}
                      placeholder="Somente números"
                      inputMode="numeric"
                      required
                      data-tour="settings-billing-cpf-cnpj"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      data-tour="settings-clinic-phone"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Email</Label>
                    <Input
                      type="email"
                      value={formData.email ?? ""}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      placeholder="contato@clinica.com"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Endereço</Label>
                    <Input
                      value={formData.address}
                      onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                      placeholder="Rua, número, bairro, cidade"
                      data-tour="settings-clinic-address"
                    />
                  </div>
                </div>

                <p className="text-xs text-muted-foreground">
                  A comissão de cada profissional é definida na aba Equipe (percentual ou valor fixo por atendimento).
                </p>

                <Button
                  type="submit"
                  disabled={isSaving}
                  variant="gradient"
                  data-tour="settings-save"
                >
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Salvando...
                    </>
                  ) : (
                    <>
                      <Save className="mr-2 h-4 w-4" />
                      Salvar Alterações
                    </>
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 2 — Agendamento Inteligente
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="agendamento">
          <SmartConfirmationSettings />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 3 — Certificados Digitais
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="certificados">
          <CertificateManager />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 3 — SMS
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="sms">
          <SmsConfig />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 4 — Chatbot WhatsApp
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="chatbot">
          <ChatbotSettings />
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 5 — Preferências
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="preferencias" className="space-y-6">
          {/* Interface */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-blue-500/10 text-blue-600">
                  <Sliders className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Interface</CardTitle>
                  <CardDescription>Ajuste a experiência de uso do sistema</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="simple-mode" className="cursor-pointer font-medium">
                    Interface simplificada
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Oculta seções avançadas e reduz opções para uso mais rápido
                  </p>
                </div>
                <Switch
                  id="simple-mode"
                  checked={simpleModeEnabled}
                  onCheckedChange={(checked) => setSimpleModeEnabled(checked)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Portal do Paciente — Agendamento */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-500/10 text-teal-600">
                  <CalendarPlus className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Portal do Paciente</CardTitle>
                  <CardDescription>
                    Configure o agendamento online feito pelos próprios pacientes
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="patient-booking" className="cursor-pointer font-medium">
                    Permitir agendamento pelo portal
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Pacientes vinculados podem agendar consultas diretamente pelo portal
                  </p>
                </div>
                <Switch
                  id="patient-booking"
                  checked={patientBookingEnabled}
                  onCheckedChange={setPatientBookingEnabled}
                />
              </div>

              <Button
                onClick={handleSaveBooking}
                disabled={isSavingBooking}
                variant="outline"
                className="w-full"
              >
                {isSavingBooking ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar configuração
                  </>
                )}
              </Button>
            </CardContent>
          </Card>

          {/* Gamificação */}
          <Card>
            <CardHeader>
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
                  <Trophy className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle>Gamificação</CardTitle>
                  <CardDescription>
                    Controle os pop-ups de comissão e metas para toda a clínica
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
                <div className="space-y-0.5">
                  <Label htmlFor="tenant-gamification" className="cursor-pointer font-medium">
                    Habilitar pop-ups de gamificação
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Exibe pop-ups de comissão, metas e lucro após cada atendimento concluído
                  </p>
                </div>
                <Switch
                  id="tenant-gamification"
                  checked={tenantGamificationEnabled}
                  onCheckedChange={setTenantGamificationEnabled}
                />
              </div>

              <div className="rounded-lg bg-muted/50 p-3">
                <p className="text-sm text-muted-foreground">
                  <strong>Nota:</strong> Quando desativado, nenhum profissional da clínica verá os pop-ups 
                  de gamificação, independente das preferências individuais.
                </p>
              </div>

              <Button
                onClick={handleSaveGamification}
                disabled={isSavingGamification}
                variant="outline"
                className="w-full"
              >
                {isSavingGamification ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" />
                    Salvar configuração
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 7 — Permissões
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="permissoes">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>}>
            <LazyGerenciarPermissoes embedded />
          </Suspense>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 8 — Integrações
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="integracoes">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>}>
            <LazyIntegracoes embedded />
          </Suspense>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 9 — Fidelidade / Créditos de Saúde
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="fidelidade">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>}>
            <LazyHealthCredits />
          </Suspense>
        </TabsContent>

        {/* ═══════════════════════════════════════════════════════════════════
            Tab 10 — Módulos
        ═══════════════════════════════════════════════════════════════════ */}
        <TabsContent value="modulos">
          <Suspense fallback={<div className="flex items-center justify-center py-12"><Spinner size="lg" /></div>}>
            <LazyModulePanel />
          </Suspense>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
