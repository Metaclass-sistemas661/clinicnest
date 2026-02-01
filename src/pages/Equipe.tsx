import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { UserCog, Plus, Loader2, Mail, Shield, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import type { Profile, UserRole, AppRole } from "@/types/database";

interface TeamMember extends Profile {
  user_roles: UserRole[];
}

export default function Equipe() {
  const { profile, isAdmin } = useAuth();
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    full_name: "",
    phone: "",
    role: "staff" as AppRole,
  });

  useEffect(() => {
    if (profile?.tenant_id && isAdmin) {
      fetchTeam();
    }
  }, [profile?.tenant_id, isAdmin]);

  const fetchTeam = async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch profiles and roles separately
      const [profilesRes, rolesRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("user_roles")
          .select("*")
          .eq("tenant_id", profile.tenant_id),
      ]);

      if (profilesRes.error) throw profilesRes.error;

      const profiles = (profilesRes.data as Profile[]) || [];
      const roles = (rolesRes.data as UserRole[]) || [];

      // Merge profiles with their roles
      const teamData: TeamMember[] = profiles.map((p) => ({
        ...p,
        user_roles: roles.filter((r) => r.user_id === p.user_id),
      }));

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

    setIsSaving(true);

    try {
      // For MVP, we'll show a message that email invitation isn't implemented yet
      // In a real app, you would send an email invitation
      toast.info("Funcionalidade de convite por email", {
        description: "No MVP, peça ao usuário para criar uma conta manualmente e depois associe-o ao salão.",
      });

      setIsDialogOpen(false);
      setFormData({
        email: "",
        full_name: "",
        phone: "",
        role: "staff",
      });
    } catch (error) {
      toast.error("Erro ao convidar membro");
      console.error(error);
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
              Convidar Membro
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Convidar Novo Membro</DialogTitle>
              <DialogDescription>
                Adicione um novo profissional à equipe
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
                      Enviando...
                    </>
                  ) : (
                    "Enviar Convite"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Membros da Equipe ({team.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {team.length === 0 ? (
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
                  <TableHead className="text-right">Alterar Função</TableHead>
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
                      <TableCell className="text-right">
                        {!isCurrentUser && (
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
                        )}
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
