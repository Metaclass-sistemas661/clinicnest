import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { ChevronRight, ChevronLeft, Check, Users, Shield, Sparkles, Loader2 } from "lucide-react";
import { PROFESSIONAL_TYPE_LABELS, type ProfessionalType } from "@/types/database";

interface TeamMember {
  user_id: string;
  full_name: string;
  email: string | null;
  professional_type: ProfessionalType | null;
  is_admin: boolean;
}

interface RbacWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onComplete: () => void;
}

const PROFESSIONAL_TYPES: ProfessionalType[] = [
  "medico", "dentista", "enfermeiro", "tec_enfermagem",
  "fisioterapeuta", "nutricionista", "psicologo", "fonoaudiologo",
  "secretaria", "faturista",
];

const STEPS = [
  { id: 1, title: "Bem-vindo", icon: Sparkles },
  { id: 2, title: "Classificar Equipe", icon: Users },
  { id: 3, title: "Revisar Permissões", icon: Shield },
  { id: 4, title: "Confirmar", icon: Check },
];

export function RbacWizard({ open, onOpenChange, onComplete }: RbacWizardProps) {
  const { profile } = useAuth();
  const [step, setStep] = useState(1);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [assignments, setAssignments] = useState<Record<string, ProfessionalType>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const fetchTeam = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("user_id, full_name, email, professional_type")
          .eq("tenant_id", profile.tenant_id),
        supabase
          .from("user_roles")
          .select("user_id, role")
          .eq("tenant_id", profile.tenant_id),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const adminUserIds = new Set(
        (rolesRes.data ?? []).filter((r) => r.role === "admin").map((r) => r.user_id)
      );

      const members: TeamMember[] = (profilesRes.data ?? []).map((p) => ({
        user_id: p.user_id,
        full_name: p.full_name ?? "Sem nome",
        email: p.email,
        professional_type: p.professional_type as ProfessionalType | null,
        is_admin: adminUserIds.has(p.user_id),
      }));

      setTeam(members);

      const initial: Record<string, ProfessionalType> = {};
      members.forEach((m) => {
        if (!m.is_admin && m.professional_type) {
          initial[m.user_id] = m.professional_type;
        }
      });
      setAssignments(initial);
    } catch (err) {
      logger.error("RbacWizard fetchTeam:", err);
      toast.error("Erro ao carregar equipe");
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (open && step === 2) {
      fetchTeam();
    }
  }, [open, step, fetchTeam]);

  const handleSave = async () => {
    if (!profile?.tenant_id) return;
    setIsSaving(true);
    try {
      for (const [userId, profType] of Object.entries(assignments)) {
        const { error } = await supabase
          .from("profiles")
          .update({ professional_type: profType })
          .eq("user_id", userId)
          .eq("tenant_id", profile.tenant_id);
        if (error) throw error;
      }

      localStorage.setItem(`rbac_wizard_done_${profile.tenant_id}`, "true");
      toast.success("Configuração de permissões concluída!");
      onComplete();
      onOpenChange(false);
    } catch (err) {
      logger.error("RbacWizard save:", err);
      toast.error("Erro ao salvar configurações");
    } finally {
      setIsSaving(false);
    }
  };

  const nonAdminTeam = team.filter((m) => !m.is_admin && m.user_id !== profile?.user_id);
  const unassignedCount = nonAdminTeam.filter((m) => !assignments[m.user_id]).length;

  const renderStep = () => {
    switch (step) {
      case 1:
        return (
          <div className="text-center space-y-4 py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-xl font-semibold">Configuração de Permissões</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Vamos configurar o controle de acessos da sua clínica em 3 passos simples.
              Cada tipo profissional terá permissões adequadas às suas funções.
            </p>
            <div className="flex justify-center gap-4 pt-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{team.length || "—"}</div>
                <div className="text-xs text-muted-foreground">Membros</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-primary">{PROFESSIONAL_TYPES.length}</div>
                <div className="text-xs text-muted-foreground">Tipos</div>
              </div>
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Defina o tipo profissional de cada membro. Isso determina as permissões padrão.
            </p>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="text-muted-foreground" />
              </div>
            ) : nonAdminTeam.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                Nenhum profissional para classificar (apenas administradores).
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto">
                {nonAdminTeam.map((member) => (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{member.full_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{member.email}</p>
                    </div>
                    <Select
                      value={assignments[member.user_id] ?? ""}
                      onValueChange={(v) =>
                        setAssignments((prev) => ({ ...prev, [member.user_id]: v as ProfessionalType }))
                      }
                    >
                      <SelectTrigger className="w-44">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {PROFESSIONAL_TYPES.map((pt) => (
                          <SelectItem key={pt} value={pt}>
                            {PROFESSIONAL_TYPE_LABELS[pt]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
            )}
            {unassignedCount > 0 && (
              <p className="text-sm text-amber-600">
                {unassignedCount} profissional{unassignedCount > 1 ? "is" : ""} ainda sem tipo definido.
              </p>
            )}
          </div>
        );

      case 3:
        return (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Revise as atribuições. Você pode ajustar permissões individuais depois em Equipe → Permissões.
            </p>
            <div className="space-y-2 max-h-[300px] overflow-y-auto">
              {nonAdminTeam.map((member) => {
                const pt = assignments[member.user_id];
                return (
                  <div
                    key={member.user_id}
                    className="flex items-center justify-between gap-4 p-3 rounded-lg border bg-card"
                  >
                    <div className="min-w-0">
                      <p className="font-medium truncate">{member.full_name}</p>
                    </div>
                    {pt ? (
                      <Badge variant="outline" className="shrink-0">
                        {PROFESSIONAL_TYPE_LABELS[pt]}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 border-amber-300">
                        Não definido
                      </Badge>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="text-center space-y-4 py-6">
            <div className="mx-auto w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Check className="h-8 w-8 text-green-600" />
            </div>
            <h3 className="text-xl font-semibold">Tudo pronto!</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              Clique em "Concluir" para salvar as configurações. Você pode ajustar permissões
              a qualquer momento em <strong>Operacional → Permissões</strong>.
            </p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Assistente de Configuração RBAC</DialogTitle>
          <DialogDescription>
            Passo {step} de {STEPS.length}: {STEPS[step - 1]?.title}
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-center gap-2 py-2">
          {STEPS.map((s) => (
            <div
              key={s.id}
              className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-colors ${
                s.id < step
                  ? "bg-primary text-primary-foreground"
                  : s.id === step
                  ? "bg-primary/20 text-primary border-2 border-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {s.id < step ? <Check className="h-4 w-4" /> : s.id}
            </div>
          ))}
        </div>

        <div className="min-h-[200px]">{renderStep()}</div>

        <DialogFooter className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => setStep((s) => Math.max(1, s - 1))}
            disabled={step === 1}
          >
            <ChevronLeft className="mr-2 h-4 w-4" />
            Voltar
          </Button>
          {step < 4 ? (
            <Button onClick={() => setStep((s) => Math.min(4, s + 1))}>
              Próximo
              <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          ) : (
            <Button onClick={handleSave} disabled={isSaving} variant="gradient">
              {isSaving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Concluir"
              )}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
