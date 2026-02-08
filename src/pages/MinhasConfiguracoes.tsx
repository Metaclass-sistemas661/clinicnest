import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Bell, Lock } from "lucide-react";
import { toast } from "sonner";

const NOTIFICATION_LABELS: Record<string, string> = {
  goal_approved: "Meta sugerida aprovada",
  goal_rejected: "Meta sugerida rejeitada",
  appointment_created: "Novo agendamento",
  appointment_completed: "Agendamento concluído",
  appointment_cancelled: "Agendamento cancelado",
  goal_reminder: "Lembrete de meta próxima",
  goal_reached: "Meta atingida",
  commission_paid: "Comissão paga",
};

export default function MinhasConfiguracoes() {
  const { profile, user, refreshProfile } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [prefs, setPrefs] = useState<Record<string, boolean>>({
    goal_approved: true,
    goal_rejected: true,
    appointment_created: true,
    appointment_completed: true,
    appointment_cancelled: true,
    goal_reminder: true,
    goal_reached: true,
    commission_paid: true,
  });

  useEffect(() => {
    setPhone(profile?.phone ?? "");
  }, [profile?.phone]);

  useEffect(() => {
    if (!user?.id) return;
    const loadPrefs = async () => {
      const { data } = await supabase
        .from("user_notification_preferences")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      if (data) {
        setPrefs({
          goal_approved: data.goal_approved ?? true,
          goal_rejected: data.goal_rejected ?? true,
          appointment_created: data.appointment_created ?? true,
          appointment_completed: data.appointment_completed ?? true,
          appointment_cancelled: data.appointment_cancelled ?? true,
          goal_reminder: data.goal_reminder ?? true,
          goal_reached: data.goal_reached ?? true,
          commission_paid: data.commission_paid ?? true,
        });
      }
    };
    loadPrefs();
  }, [user?.id]);

  const handleSaveProfile = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!user?.id) return;
    setIsSavingProfile(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phone: phone.trim() || null })
        .eq("user_id", user.id);

      if (error) throw error;
      toast.success("Telefone atualizado!");
      refreshProfile();
    } catch (e) {
      toast.error("Erro ao salvar telefone");
      console.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password || password.length < 6) {
      toast.error("A senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (password !== passwordConfirm) {
      toast.error("As senhas não coincidem");
      return;
    }
    setIsSavingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha alterada com sucesso!");
      setPassword("");
      setPasswordConfirm("");
    } catch (e) {
      toast.error("Erro ao alterar senha");
      console.error(e);
    } finally {
      setIsSavingPassword(false);
    }
  };

  const handleTogglePref = async (key: string, enabled: boolean) => {
    if (!user?.id) return;
    const newPrefs = { ...prefs, [key]: enabled };
    setPrefs(newPrefs);
    setIsSavingPrefs(true);
    try {
      const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(
          {
            user_id: user.id,
            goal_approved: newPrefs.goal_approved,
            goal_rejected: newPrefs.goal_rejected,
            appointment_created: newPrefs.appointment_created,
            appointment_completed: newPrefs.appointment_completed,
            appointment_cancelled: newPrefs.appointment_cancelled,
            goal_reminder: newPrefs.goal_reminder,
            goal_reached: newPrefs.goal_reached,
            commission_paid: newPrefs.commission_paid,
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Preferência atualizada");
    } catch (e) {
      setPrefs((prev) => ({ ...prev, [key]: !enabled }));
      toast.error("Erro ao salvar preferência");
      console.error(e);
    } finally {
      setIsSavingPrefs(false);
    }
  };

  return (
    <MainLayout title="Minhas Configurações" subtitle="Gerencie seu perfil e preferências">
      <div className="w-full max-w-2xl">
        <Card>
          <CardHeader>
            <CardTitle>Minhas Configurações</CardTitle>
            <CardDescription>
              Dados pessoais, senha e preferências de notificação
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados pessoais */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dados pessoais</h3>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>E-mail</Label>
                  <Input value={user?.email ?? ""} disabled className="bg-muted" />
                  <p className="text-xs text-muted-foreground">
                    Alterações no e-mail devem ser feitas pelo administrador.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="(00) 00000-0000"
                  />
                </div>
              </div>
              <Button onClick={handleSaveProfile} disabled={isSavingProfile} size="sm">
                {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar telefone
              </Button>
            </section>

            <Separator />

            {/* Alterar senha */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Alterar senha</h3>
              </div>
              <form onSubmit={handleChangePassword} className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nova senha</Label>
                  <Input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar nova senha</Label>
                  <Input
                    type="password"
                    value={passwordConfirm}
                    onChange={(e) => setPasswordConfirm(e.target.value)}
                    placeholder="Repita a senha"
                  />
                </div>
                <div className="sm:col-span-2">
                  <Button type="submit" disabled={isSavingPassword} size="sm">
                    {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Alterar senha
                  </Button>
                </div>
              </form>
            </section>

            <Separator />

            {/* Notificações */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Notificações</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                Escolha quais notificações deseja receber no sistema.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                {Object.entries(NOTIFICATION_LABELS).map(([key, label]) => (
                  <div key={key} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <Label htmlFor={key} className="text-sm font-normal cursor-pointer flex-1">
                      {label}
                    </Label>
                    <Switch
                      id={key}
                      checked={prefs[key] ?? true}
                      onCheckedChange={(checked) => handleTogglePref(key, checked)}
                      disabled={isSavingPrefs}
                    />
                  </div>
                ))}
              </div>
            </section>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
