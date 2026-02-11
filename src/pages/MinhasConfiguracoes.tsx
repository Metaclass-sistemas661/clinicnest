import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Lock, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface NotificationPrefs {
  appointment_created: boolean;
  appointment_completed: boolean;
  appointment_cancelled: boolean;
  goal_approved: boolean;
  goal_rejected: boolean;
  goal_reminder: boolean;
  goal_reached: boolean;
  commission_paid: boolean;
}

const DEFAULT_PREFS: NotificationPrefs = {
  appointment_created: true,
  appointment_completed: true,
  appointment_cancelled: true,
  goal_approved: true,
  goal_rejected: true,
  goal_reminder: true,
  goal_reached: true,
  commission_paid: true,
};

export default function MinhasConfiguracoes() {
  const { profile, user, refreshProfile } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [isSavingPrefs, setIsSavingPrefs] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [prefs, setPrefs] = useState<NotificationPrefs>(DEFAULT_PREFS);

  useEffect(() => {
    setPhone(profile?.phone ?? "");
  }, [profile?.phone]);

  useEffect(() => {
    if (!user?.id) return;
    supabase
      .from("user_notification_preferences")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data) {
          setPrefs({
            appointment_created: data.appointment_created ?? true,
            appointment_completed: data.appointment_completed ?? true,
            appointment_cancelled: data.appointment_cancelled ?? true,
            goal_approved: data.goal_approved ?? true,
            goal_rejected: data.goal_rejected ?? true,
            goal_reminder: data.goal_reminder ?? true,
            goal_reached: data.goal_reached ?? true,
            commission_paid: data.commission_paid ?? true,
          });
        }
      });
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
      logger.error(e);
    } finally {
      setIsSavingProfile(false);
    }
  };

  const handleSavePrefs = async () => {
    if (!user?.id) return;
    setIsSavingPrefs(true);
    try {
      const { error } = await supabase
        .from("user_notification_preferences")
        .upsert(
          {
            user_id: user.id,
            ...prefs,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "user_id" }
        );
      if (error) throw error;
      toast.success("Preferências de notificação salvas!");
    } catch (e) {
      toast.error("Erro ao salvar preferências");
      logger.error(e);
    } finally {
      setIsSavingPrefs(false);
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
      logger.error(e);
    } finally {
      setIsSavingPassword(false);
    }
  };

  return (
    <MainLayout title="Minhas Configurações" subtitle="Gerencie seu perfil e preferências">
      <div className="grid w-full gap-6 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <CardHeader>
            <CardTitle>Minhas Configurações</CardTitle>
            <CardDescription>
              Dados pessoais e alteração de senha
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Dados pessoais */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Dados pessoais</h3>
              </div>
              <div className="grid gap-4 lg:grid-cols-2">
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
              <div className="flex justify-end">
                <Button onClick={handleSaveProfile} disabled={isSavingProfile} size="sm">
                  {isSavingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Salvar telefone
                </Button>
              </div>
            </section>

            <Separator />

            {/* Alterar senha */}
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-primary" />
                <h3 className="text-sm font-semibold">Alterar senha</h3>
              </div>
              <form onSubmit={handleChangePassword} className="grid gap-4 lg:grid-cols-2">
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
                <div className="lg:col-span-2 flex justify-end">
                  <Button type="submit" disabled={isSavingPassword} size="sm">
                    {isSavingPassword ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Alterar senha
                  </Button>
                </div>
              </form>
            </section>
          </CardContent>
        </Card>

        <Card className="h-fit xl:col-span-1">
          <CardHeader className="space-y-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Notificações</CardTitle>
              </div>
              <Button variant="outline" size="sm" asChild>
                <Link to="/notificacoes">Ver notificações</Link>
              </Button>
            </div>
            <CardDescription>
              Escolha quais notificações deseja receber.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { key: "appointment_created" as const, label: "Novo agendamento para mim" },
              { key: "appointment_completed" as const, label: "Atendimento concluído (por admin)" },
              { key: "appointment_cancelled" as const, label: "Agendamento cancelado" },
              { key: "goal_approved" as const, label: "Meta sugerida aprovada" },
              { key: "goal_rejected" as const, label: "Meta sugerida rejeitada" },
              { key: "goal_reminder" as const, label: "Meta quase alcançada (80%+)" },
              { key: "goal_reached" as const, label: "Meta alcançada" },
              { key: "commission_paid" as const, label: "Comissão paga" },
            ].map(({ key, label }) => (
              <div key={key} className="flex items-center justify-between gap-3 rounded-lg border border-border/70 px-3 py-2.5">
                <Label htmlFor={key} className="cursor-pointer text-sm leading-snug">
                  {label}
                </Label>
                <Switch
                  id={key}
                  checked={prefs[key]}
                  onCheckedChange={(checked) =>
                    setPrefs((p) => ({ ...p, [key]: checked }))
                  }
                />
              </div>
            ))}
            <div className="flex justify-end pt-1">
              <Button onClick={handleSavePrefs} disabled={isSavingPrefs} size="sm">
                {isSavingPrefs ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                Salvar preferências
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
