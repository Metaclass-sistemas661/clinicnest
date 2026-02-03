import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
import { UserCog, Plus, Loader2, Mail, Shield, ShieldCheck, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { Profile, UserRole, AppRole } from "@/types/database";

interface TeamMember extends Profile {
  user_roles: UserRole[];
  commission?: {
    id: string;
    type: "percentage" | "fixed";
    value: number;
  } | null;
}

interface CommissionFormData {
  type: "percentage" | "fixed";
  value: string;
}

export default function Equipe() {
  const { profile, isAdmin } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [commissionData, setCommissionData] = useState<CommissionFormData>({
    type: "percentage",
    value: "",
  });
  const [isSavingCommission, setIsSavingCommission] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirm_password: "",
    full_name: "",
    phone: "",
    role: "staff" as AppRole,
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchTeam();
    }
  }, [profile?.tenant_id, isAdmin]);

  const fetchTeam = async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch profiles, roles, and commissions
      const [profilesRes, rolesRes, commissionsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("user_roles")
          .select("*")
          .eq("tenant_id", profile.tenant_id),
        supabase
          .from("professional_commissions")
          .select("id, user_id, type, value")
          .eq("tenant_id", profile.tenant_id),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const profiles = (profilesRes.data as Profile[]) || [];
      const roles = (rolesRes.data as UserRole[]) || [];
      const commissions = (commissionsRes.data || []) as Array<{
        id: string;
        user_id: string;
        type: "percentage" | "fixed";
        value: number;
      }>;

      // Merge profiles with their roles and commissions
      const teamData: TeamMember[] = profiles.map((p) => {
        const memberCommission = commissions.find((c) => c.user_id === p.user_id);
        return {
          ...p,
          user_roles: roles.filter((r) => r.user_id === p.user_id),
          commission: memberCommission || null,
        };
      });

      setTeam(teamData);
    } catch (error) {
      console.error("Error fetching team:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setPasswordError(null);
    if (formData.password.length < 6) {
      setPasswordError("A senha deve ter no mínimo 6 caracteres");
      return;
    }
    if (formData.password !== formData.confirm_password) {
      setPasswordError("As senhas não coincidem");
      return;
    }

    setIsSaving(true);

    try {
      console.log("[Equipe] Chamando invite-team-member com:", {
        email: formData.email.trim(),
        full_name: formData.full_name.trim(),
        role: formData.role,
      });

      const { data, error } = await supabase.functions.invoke("invite-team-member", {
        body: {
          email: formData.email.trim(),
          password: formData.password,
          full_name: formData.full_name.trim(),
          phone: formData.phone.trim() || undefined,
          role: formData.role,
        },
      });

      console.log("[Equipe] Resposta recebida:", { data, error });

      if (error) {
        // Tentar extrair mensagem de erro do contexto
        let errorMessage = error.message || "Erro ao cadastrar membro";
        if (error.context) {
          try {
            const errorBody = typeof error.context.body === 'string' 
              ? JSON.parse(error.context.body) 
              : error.context.body;
            if (errorBody?.error) {
              errorMessage = errorBody.error;
            }
          } catch {
            // Ignora erro de parse
          }
        }
        toast.error(errorMessage);
        console.error("[Equipe] Erro completo:", error);
        return;
      }
      
      // Edge Function sempre retorna status 200, mas pode ter campo 'error'
      if (data?.error) {
        toast.error(data.error);
        console.error("[Equipe] Erro retornado pela função:", data.error);
        return;
      }

      if (!data?.success) {
        toast.error("Resposta inesperada do servidor");
        console.error("[Equipe] Resposta inesperada:", data);
        return;
      }

      toast.success(data.message ?? "Membro cadastrado. Ele já pode acessar o sistema com o e-mail e a senha definidos.");
      setIsDialogOpen(false);
      setFormData({
        email: "",
        password: "",
        confirm_password: "",
        full_name: "",
        phone: "",
        role: "staff",
      });
      fetchTeam();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Erro ao cadastrar membro";
      toast.error(errorMessage);
      console.error("[Equipe] Exceção não tratada:", error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateRole = async (userId: string, newRole: AppRole) => {
    if (!profile?.tenant_id) return;

    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId)
        .eq("tenant_id", profile.tenant_id);

      if (error) throw error;

      toast.success("Função atualizada com sucesso!");
      fetchTeam();
    } catch (error) {
      toast.error("Erro ao atualizar função");
      console.error(error);
    }
  };

  const getRoleBadge = (role: AppRole) => {
    return role === "admin" ? (
      <Badge className="bg-primary/20 text-primary border-primary/30">
        <ShieldCheck className="mr-1 h-3 w-3" />
        Administrador
      </Badge>
    ) : (
      <Badge variant="outline" className="bg-muted">
        <Shield className="mr-1 h-3 w-3" />
        Profissional
      </Badge>
    );
  };

  const formatCommission = (commission: TeamMember["commission"]) => {
    if (!commission) return "—";
    if (commission.type === "percentage") {
      return `${commission.value}%`;
    }
    return `R$ ${Number(commission.value).toFixed(2)}`;
  };

  const handleOpenCommissionDialog = (member: TeamMember) => {
    setSelectedMember(member);
    if (member.commission) {
      setCommissionData({
        type: member.commission.type,
        value: String(member.commission.value),
      });
    } else {
      setCommissionData({ type: "percentage", value: "" });
    }
    setIsCommissionDialogOpen(true);
  };

  const handleSaveCommission = async () => {
    if (!selectedMember || !profile?.tenant_id) return;

    const value = parseFloat(commissionData.value);
    if (isNaN(value) || value < 0) {
      toast.error("Valor inválido");
      return;
    }

    if (commissionData.type === "percentage" && (value < 0 || value > 100)) {
      toast.error("Percentual deve estar entre 0 e 100");
      return;
    }

    setIsSavingCommission(true);

    try {
      const commissionPayload = {
        user_id: selectedMember.user_id,
        tenant_id: profile.tenant_id,
        type: commissionData.type,
        value: value,
      };

      if (selectedMember.commission) {
        // Update existing commission
        const { error } = await supabase
          .from("professional_commissions")
          .update(commissionPayload)
          .eq("id", selectedMember.commission.id);

        if (error) throw error;
        toast.success("Comissão atualizada com sucesso!");
      } else {
        // Create new commission
        const { error } = await supabase
          .from("professional_commissions")
          .insert(commissionPayload);

        if (error) throw error;
        toast.success("Comissão configurada com sucesso!");
      }

      setIsCommissionDialogOpen(false);
      setSelectedMember(null);
      setCommissionData({ type: "percentage", value: "" });
      fetchTeam();
    } catch (error: any) {
      console.error("Error saving commission:", error);
      toast.error(error.message || "Erro ao salvar comissão");
    } finally {
      setIsSavingCommission(false);
    }
  };

  if (!isAdmin) {
    return (
      <MainLayout title="Equipe" subtitle="Acesso restrito">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <UserCog className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">
              Apenas administradores podem gerenciar a equipe
            </p>
          </CardContent>
        </Card>
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Equipe"
      subtitle="Gerencie os membros do salão"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar profissional
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cadastrar profissional</DialogTitle>
              <DialogDescription>
                O profissional poderá acessar o sistema com o e-mail e a senha definidos abaixo.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleInvite}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nome Completo</Label>
                  <Input
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    placeholder="Nome do profissional"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Senha</Label>
                  <Input
                    type="password"
                    value={formData.password}
                    onChange={(e) => {
                      setFormData({ ...formData, password: e.target.value });
                      setPasswordError(null);
                    }}
                    placeholder="Mínimo 6 caracteres"
                    minLength={6}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Confirmar senha</Label>
                  <Input
                    type="password"
                    value={formData.confirm_password}
                    onChange={(e) => {
                      setFormData({ ...formData, confirm_password: e.target.value });
                      setPasswordError(null);
                    }}
                    placeholder="Repita a senha"
                    minLength={6}
                    required
                  />
                  {passwordError && (
                    <p className="text-sm text-destructive">{passwordError}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Função</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v as AppRole })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="staff">Profissional</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Administradores têm acesso a financeiro, produtos e configurações
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                  {isSaving ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cadastrando...
                    </>
                  ) : (
                    "Cadastrar profissional"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Dialog de Configuração de Comissão */}
      <Dialog open={isCommissionDialogOpen} onOpenChange={setIsCommissionDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Comissão</DialogTitle>
            <DialogDescription>
              Configure a comissão para {selectedMember?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Comissão</Label>
              <Select
                value={commissionData.type}
                onValueChange={(v) =>
                  setCommissionData({ ...commissionData, type: v as "percentage" | "fixed" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentual (%)</SelectItem>
                  <SelectItem value="fixed">Valor Fixo (R$)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>
                {commissionData.type === "percentage" ? "Percentual (%)" : "Valor Fixo (R$)"}
              </Label>
              <Input
                type="number"
                step={commissionData.type === "percentage" ? "0.01" : "0.01"}
                min="0"
                max={commissionData.type === "percentage" ? "100" : undefined}
                value={commissionData.value}
                onChange={(e) =>
                  setCommissionData({ ...commissionData, value: e.target.value })
                }
                placeholder={
                  commissionData.type === "percentage" ? "Ex: 30" : "Ex: 50.00"
                }
                required
              />
              <p className="text-xs text-muted-foreground">
                {commissionData.type === "percentage"
                  ? "Digite o percentual (ex: 30 para 30%)"
                  : "Digite o valor fixo em reais"}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCommissionDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveCommission}
              disabled={isSavingCommission}
              className="gradient-primary text-primary-foreground"
            >
              {isSavingCommission ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Salvando...
                </>
              ) : (
                "Salvar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Card>
        <CardHeader>
          <CardTitle>{isLoading ? "Membros da Equipe" : `Membros da Equipe (${team.length})`}</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : team.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12">
              <UserCog className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum membro na equipe</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Telefone</TableHead>
                  <TableHead>Função</TableHead>
                  <TableHead>Comissão</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {team.map((member) => {
                  const currentRole = member.user_roles[0]?.role || "staff";
                  const isCurrentUser = member.user_id === profile?.user_id;

                  return (
                    <TableRow key={member.id}>
                      <TableCell className="font-medium">
                        {member.full_name}
                        {isCurrentUser && (
                          <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          {member.email || "—"}
                        </div>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {member.phone || "—"}
                      </TableCell>
                      <TableCell>{getRoleBadge(currentRole)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {formatCommission(member.commission)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isCurrentUser && (
                            <>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenCommissionDialog(member)}
                                className="gap-1"
                              >
                                <DollarSign className="h-3 w-3" />
                                Comissão
                              </Button>
                              <Select
                                value={currentRole}
                                onValueChange={(v) => updateRole(member.user_id, v as AppRole)}
                              >
                                <SelectTrigger className="w-40">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="staff">Profissional</SelectItem>
                                  <SelectItem value="admin">Administrador</SelectItem>
                                </SelectContent>
                              </Select>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
