import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, User, Lock } from "lucide-react";
import { toast } from "sonner";

export default function MinhasConfiguracoes() {
  const { profile, user, refreshProfile } = useAuth();
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [isSavingPassword, setIsSavingPassword] = useState(false);
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");

  useEffect(() => {
    setPhone(profile?.phone ?? "");
  }, [profile?.phone]);

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

  return (
    <MainLayout title="Minhas Configurações" subtitle="Gerencie seu perfil e preferências">
      <div className="w-full max-w-2xl">
        <Card>
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
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
