import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Bell,
  Mail,
  Smartphone,
  FileText,
  Pill,
  ClipboardList,
  Calendar,
  Loader2,
  Save,
  ShieldCheck,
  Moon,
  BellRing,
  BellOff,
  Send,
} from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { usePatientPushNotifications } from "@/hooks/usePatientPushNotifications";
import { PatientMfaSettings } from "@/components/patient/PatientMfaSettings";
import { PatientLgpdSettings } from "@/components/patient/PatientLgpdSettings";
import { PatientActivityHistory } from "@/components/patient/PatientActivityHistory";

interface NotificationPreferences {
  email_certificates: boolean;
  email_prescriptions: boolean;
  email_exams: boolean;
  email_appointments: boolean;
  push_certificates: boolean;
  push_prescriptions: boolean;
  push_exams: boolean;
  push_appointments: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
  email_certificates: true,
  email_prescriptions: true,
  email_exams: true,
  email_appointments: true,
  push_certificates: true,
  push_prescriptions: true,
  push_exams: true,
  push_appointments: true,
};

function SettingRow({
  icon: Icon,
  title,
  description,
  emailChecked,
  onEmailChange,
  pushChecked,
  onPushChange,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  emailChecked: boolean;
  onEmailChange: (v: boolean) => void;
  pushChecked: boolean;
  onPushChange: (v: boolean) => void;
}) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 py-4 border-b border-border/50 last:border-0">
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 dark:bg-teal-950/40 flex-shrink-0">
          <Icon className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="flex items-center gap-5 sm:gap-6 pl-12 sm:pl-0">
        <div className="flex items-center gap-2">
          <Mail className="h-3.5 w-3.5 text-muted-foreground" />
          <Switch
            checked={emailChecked}
            onCheckedChange={onEmailChange}
            aria-label={`E-mail para ${title}`}
          />
        </div>
        <div className="flex items-center gap-2">
          <Bell className="h-3.5 w-3.5 text-muted-foreground" />
          <Switch
            checked={pushChecked}
            onCheckedChange={onPushChange}
            aria-label={`Notificação para ${title}`}
          />
        </div>
      </div>
    </div>
  );
}

export default function PatientSettings() {
  const [prefs, setPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [savedPrefs, setSavedPrefs] = useState<NotificationPreferences>(DEFAULT_PREFS);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const push = usePatientPushNotifications();

  const hasChanges = JSON.stringify(prefs) !== JSON.stringify(savedPrefs);

  const fetchPrefs = useCallback(async () => {
    setIsLoading(true);
    try {
      const {
        data: { user },
      } = await apiPatient.auth.getUser();
      if (!user) return;

      const stored = user.user_metadata?.notification_preferences;
      if (stored && typeof stored === "object") {
        const merged = { ...DEFAULT_PREFS, ...stored };
        setPrefs(merged);
        setSavedPrefs(merged);
      }
    } catch {
      // use defaults
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPrefs();
  }, [fetchPrefs]);

  const updatePref = (key: keyof NotificationPreferences, value: boolean) => {
    setPrefs((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const { error } = await apiPatient.auth.updateUser({
        data: { notification_preferences: prefs },
      });
      if (error) throw error;

      setSavedPrefs(prefs);
      toast.success("Preferências salvas com sucesso");
    } catch {
      toast.error("Erro ao salvar preferências");
    } finally {
      setIsSaving(false);
    }
  };

  const enableAll = () => {
    const all: NotificationPreferences = {
      email_certificates: true,
      email_prescriptions: true,
      email_exams: true,
      email_appointments: true,
      push_certificates: true,
      push_prescriptions: true,
      push_exams: true,
      push_appointments: true,
    };
    setPrefs(all);
  };

  const disableAll = () => {
    const none: NotificationPreferences = {
      email_certificates: false,
      email_prescriptions: false,
      email_exams: false,
      email_appointments: false,
      push_certificates: false,
      push_prescriptions: false,
      push_exams: false,
      push_appointments: false,
    };
    setPrefs(none);
  };

  return (
    <PatientLayout
      title="Configurações"
      subtitle="Gerencie suas preferências de notificação"
    >
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Notification preferences */}
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Bell className="h-4 w-4 text-muted-foreground" />
                  Notificações
                </CardTitle>
                <CardDescription className="mt-1">
                  Escolha como deseja ser notificado sobre novos documentos
                </CardDescription>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs"
                  onClick={enableAll}
                >
                  Ativar todas
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-muted-foreground"
                  onClick={disableAll}
                >
                  Desativar todas
                </Button>
              </div>
            </div>
            {/* Channel legend */}
            <div className="flex items-center gap-5 pt-3 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <Mail className="h-3.5 w-3.5" />
                <span>E-mail</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5" />
                <span>Portal</span>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            ) : (
              <>
                <SettingRow
                  icon={ClipboardList}
                  title="Atestados"
                  description="Quando um novo atestado for emitido"
                  emailChecked={prefs.email_certificates}
                  onEmailChange={(v) => updatePref("email_certificates", v)}
                  pushChecked={prefs.push_certificates}
                  onPushChange={(v) => updatePref("push_certificates", v)}
                />
                <SettingRow
                  icon={Pill}
                  title="Receitas"
                  description="Quando uma nova receita for emitida"
                  emailChecked={prefs.email_prescriptions}
                  onEmailChange={(v) => updatePref("email_prescriptions", v)}
                  pushChecked={prefs.push_prescriptions}
                  onPushChange={(v) => updatePref("push_prescriptions", v)}
                />
                <SettingRow
                  icon={FileText}
                  title="Exames e Laudos"
                  description="Quando resultados de exames ficarem disponíveis"
                  emailChecked={prefs.email_exams}
                  onEmailChange={(v) => updatePref("email_exams", v)}
                  pushChecked={prefs.push_exams}
                  onPushChange={(v) => updatePref("push_exams", v)}
                />
                <SettingRow
                  icon={Calendar}
                  title="Consultas"
                  description="Lembretes e alterações de agendamento"
                  emailChecked={prefs.email_appointments}
                  onEmailChange={(v) => updatePref("email_appointments", v)}
                  pushChecked={prefs.push_appointments}
                  onPushChange={(v) => updatePref("push_appointments", v)}
                />
              </>
            )}
          </CardContent>
        </Card>

        {/* Save button */}
        {hasChanges && (
          <div className="flex justify-end">
            <Button
              className="gap-2 bg-teal-600 hover:bg-teal-700 text-white"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar preferências
            </Button>
          </div>
        )}

        {/* MFA / 2FA */}
        <PatientMfaSettings />

        {/* Push Notifications */}
        {push.isSupported && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <BellRing className="h-4 w-4 text-muted-foreground" />
                Notificações Push
              </CardTitle>
              <CardDescription className="mt-1">
                Receba alertas mesmo quando o navegador estiver fechado
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {push.isEnabled ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400">
                    <BellRing className="h-4 w-4" />
                    <span>Notificações push ativadas</span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => push.sendTestNotification()}
                    >
                      <Send className="h-3.5 w-3.5" />
                      Testar
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 text-muted-foreground"
                      onClick={() => void push.disableNotifications()}
                    >
                      <BellOff className="h-3.5 w-3.5" />
                      Desativar
                    </Button>
                  </div>
                </div>
              ) : push.canRequest ? (
                <div className="flex items-center justify-between gap-4">
                  <p className="text-sm text-muted-foreground">
                    Ative para receber notificações de consultas, exames e mensagens no seu dispositivo.
                  </p>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-teal-600 hover:bg-teal-700 whitespace-nowrap"
                    disabled={push.isLoading}
                    onClick={() => void push.enableNotifications()}
                  >
                    {push.isLoading ? (
                      <Spinner size="sm" />
                    ) : (
                      <Bell className="h-3.5 w-3.5" />
                    )}
                    Ativar
                  </Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Notificações push foram bloqueadas no seu navegador.
                  Acesse as configurações do navegador para permitir notificações deste site.
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {/* Privacy info */}
        <Card className="border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-100 dark:bg-teal-900 flex-shrink-0 mt-0.5">
                <ShieldCheck className="h-4.5 w-4.5 text-teal-600 dark:text-teal-400" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-teal-800 dark:text-teal-200 mb-1">
                  Privacidade e segurança
                </h3>
                <p className="text-xs text-teal-700/80 dark:text-teal-300/80 leading-relaxed">
                  Seus dados são protegidos conforme a LGPD. Notificações por e-mail nunca contêm
                  informações clínicas — apenas avisos de que um novo documento está disponível no
                  portal.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* LGPD — Export + Deletion */}
        <PatientLgpdSettings />

        {/* Activity History */}
        <PatientActivityHistory />
      </div>
    </PatientLayout>
  );
}
