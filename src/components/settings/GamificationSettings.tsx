import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Trophy, Loader2, Save } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { logger } from "@/lib/logger";

interface GamificationSettingsProps {
  isAdmin?: boolean;
}

/**
 * GamificationSettings — Configurações de pop-ups de gamificação
 * 
 * Para Admin: Toggle global para toda a clínica
 * Para Usuário: Toggle individual para suas preferências
 */
export function GamificationSettings({ isAdmin = false }: GamificationSettingsProps) {
  const { profile, tenant, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  
  // Estado local para os toggles
  const [tenantGamificationEnabled, setTenantGamificationEnabled] = useState(true);
  const [userGamificationEnabled, setUserGamificationEnabled] = useState(true);

  // Sincronizar com dados do contexto
  useEffect(() => {
    if (tenant) {
      setTenantGamificationEnabled(tenant.gamification_enabled ?? true);
    }
    if (profile) {
      setUserGamificationEnabled(profile.show_gamification_popups ?? true);
    }
  }, [tenant, profile]);

  const handleSaveTenantSetting = async () => {
    if (!tenant?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await api
        .from("tenants")
        .update({ gamification_enabled: tenantGamificationEnabled })
        .eq("id", tenant.id);

      if (error) throw error;
      
      toast.success("Configuração de gamificação salva");
      refreshProfile();
    } catch (err) {
      logger.error("Erro ao salvar configuração de gamificação:", err);
      toast.error("Erro ao salvar configuração", { description: normalizeError(err, "Não foi possível salvar a configuração de gamificação.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveUserSetting = async () => {
    if (!profile?.id) return;
    
    setIsSaving(true);
    try {
      const { error } = await api
        .from("profiles")
        .update({ show_gamification_popups: userGamificationEnabled })
        .eq("id", profile.id);

      if (error) throw error;
      
      toast.success("Preferência de notificações salva");
      refreshProfile();
    } catch (err) {
      logger.error("Erro ao salvar preferência de gamificação:", err);
      toast.error("Erro ao salvar preferência", { description: normalizeError(err, "Não foi possível salvar a preferência de notificações.") });
    } finally {
      setIsSaving(false);
    }
  };

  // Configuração Admin (global para clínica)
  if (isAdmin) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
              <Trophy className="h-5 w-5" />
            </div>
            <div>
              <CardTitle className="text-base">Gamificação</CardTitle>
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
            onClick={handleSaveTenantSetting}
            disabled={isSaving}
            variant="outline"
            className="w-full"
          >
            {isSaving ? (
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
    );
  }

  // Configuração do Usuário (preferência individual)
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10 text-amber-600">
            <Trophy className="h-5 w-5" />
          </div>
          <div>
            <CardTitle className="text-base">Pop-ups de Gamificação</CardTitle>
            <CardDescription>
              Controle as notificações de comissão e metas
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between rounded-lg border border-border/70 px-4 py-3">
          <div className="space-y-0.5">
            <Label htmlFor="user-gamification" className="cursor-pointer font-medium">
              Mostrar pop-ups após atendimentos
            </Label>
            <p className="text-sm text-muted-foreground">
              Exibe sua comissão e progresso de metas ao concluir atendimentos
            </p>
          </div>
          <Switch
            id="user-gamification"
            checked={userGamificationEnabled}
            onCheckedChange={setUserGamificationEnabled}
          />
        </div>

        {!tenant?.gamification_enabled && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3">
            <p className="text-sm text-amber-800">
              <strong>Atenção:</strong> O administrador desativou os pop-ups de gamificação 
              para toda a clínica. Esta configuração não terá efeito até que seja reativada.
            </p>
          </div>
        )}

        <Button
          onClick={handleSaveUserSetting}
          disabled={isSaving}
          variant="outline"
          className="w-full"
        >
          {isSaving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar preferência
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
