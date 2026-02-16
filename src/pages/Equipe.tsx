import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
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
import { UserCog, Plus, Loader2, Mail, Shield, ShieldCheck, DollarSign, ArrowDown } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { Profile, UserRole, AppRole } from "@/types/database";

interface TeamMember extends Profile {
  user_roles: UserRole[];
  commission?: {
    id: string;
    type: "percentage" | "fixed";
    value: number;
    payment_type?: "commission" | "salary";
    salary_amount?: number | null;
    salary_payment_day?: number | null;
    default_payment_method?: string | null;
  } | null;
}

interface CommissionFormData {
  payment_type: "commission" | "salary";
  type: "percentage" | "fixed";
  value: string;
  salary_amount?: string;
  salary_payment_day?: string;
  default_payment_method?: string;
}

export default function Equipe() {
  const { profile, isAdmin, session } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightUserId = searchParams.get("highlight");
  const highlightedRowRef = useRef<HTMLTableRowElement | HTMLDivElement | null>(null);

  const [team, setTeam] = useState<TeamMember[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommissionDialogOpen, setIsCommissionDialogOpen] = useState(false);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [commissionData, setCommissionData] = useState<CommissionFormData>({
    payment_type: "commission",
    type: "percentage",
    value: "",
    salary_amount: "",
    salary_payment_day: "",
    default_payment_method: "",
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

  useEffect(() => {
    if (highlightUserId && !isLoading && highlightedRowRef.current) {
      highlightedRowRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [highlightUserId, isLoading]);

  const hasOpenedForHighlight = useRef(false);
  useEffect(() => {
    if (highlightUserId && team.length > 0 && !hasOpenedForHighlight.current) {
      const member = team.find((m) => m.user_id === highlightUserId);
      if (member && !member.commission) {
        hasOpenedForHighlight.current = true;
        setSelectedMember(member);
        setCommissionData({ 
          payment_type: "commission",
          type: "percentage", 
          value: "",
          salary_amount: "",
          salary_payment_day: "",
          default_payment_method: "",
        });
        setIsCommissionDialogOpen(true);
        setSearchParams({});
      }
    }
  }, [highlightUserId, team]);

  const fetchTeam = async () => {
    if (!profile?.tenant_id) return;

    try {
      // Fetch profiles, roles, and commissions
      const [profilesRes, rolesRes, commissionsRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,user_id,tenant_id,full_name,email,phone,avatar_url,created_at,updated_at")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("user_roles")
          .select("id,user_id,tenant_id,role,created_at")
          .eq("tenant_id", profile.tenant_id),
        supabase
          .from("professional_commissions")
          .select("id, user_id, type, value, payment_type, salary_amount, salary_payment_day, default_payment_method")
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
        payment_type?: "commission" | "salary";
        salary_amount?: number | null;
        salary_payment_day?: number | null;
        default_payment_method?: string | null;
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
      logger.error("Error fetching team:", error);
      toast.error("Erro ao carregar equipe. Tente novamente.");
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
      if (!session?.access_token) {
        throw new Error("Not authenticated");
      }

      logger.debug("[Equipe] Chamando invite-team-member com:", {
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
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
        },
      });

      logger.debug("[Equipe] Resposta recebida:", { data, error });

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
        logger.error("[Equipe] Erro completo:", error);
        return;
      }
      
      // Edge Function sempre retorna status 200, mas pode ter campo 'error'
      if (data?.error) {
        toast.error(data.error);
        logger.error("[Equipe] Erro retornado pela função:", data.error);
        return;
      }

      if (!data?.success) {
        toast.error("Resposta inesperada do servidor");
        logger.error("[Equipe] Resposta inesperada:", data);
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
      logger.error("[Equipe] Exceção não tratada:", error);
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
      logger.error(error);
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
    if (commission.payment_type === "salary") {
      return `Salário: R$ ${Number(commission.salary_amount || commission.value).toFixed(2)}`;
    }
    if (commission.type === "percentage") {
      return `${commission.value}%`;
    }
    return `R$ ${Number(commission.value).toFixed(2)}`;
  };

  const handleOpenCommissionDialog = (member: TeamMember) => {
    setSelectedMember(member);
    if (member.commission) {
      setCommissionData({
        payment_type: member.commission.payment_type || "commission",
        type: member.commission.type,
        value: String(member.commission.value),
        salary_amount: member.commission.salary_amount ? String(member.commission.salary_amount) : "",
        salary_payment_day: member.commission.salary_payment_day ? String(member.commission.salary_payment_day) : "",
        default_payment_method: member.commission.default_payment_method || "",
      });
    } else {
      setCommissionData({ 
        payment_type: "commission",
        type: "percentage", 
        value: "",
        salary_amount: "",
        salary_payment_day: "",
        default_payment_method: "",
      });
    }
    setIsCommissionDialogOpen(true);
  };

  const handleSaveCommission = async () => {
    if (!selectedMember || !profile?.tenant_id) return;

    // Validações para comissão
    if (commissionData.payment_type === "commission") {
      const value = parseFloat(commissionData.value);
      if (isNaN(value) || value < 0) {
        toast.error("Valor inválido");
        return;
      }

      if (commissionData.type === "percentage" && (value < 0 || value > 100)) {
        toast.error("Percentual deve estar entre 0 e 100");
        return;
      }
    }

    // Validações para salário
    if (commissionData.payment_type === "salary") {
      const salaryAmount = parseFloat(commissionData.salary_amount || "0");
      if (isNaN(salaryAmount) || salaryAmount <= 0) {
        toast.error("Valor do salário deve ser maior que zero");
        return;
      }

      const paymentDay = parseInt(commissionData.salary_payment_day || "0");
      if (paymentDay < 1 || paymentDay > 31) {
        toast.error("Dia de pagamento deve estar entre 1 e 31");
        return;
      }

      if (!commissionData.default_payment_method) {
        toast.error("Selecione o método de pagamento padrão");
        return;
      }
    }

    setIsSavingCommission(true);

    try {
      const commissionPayload: any = {
        user_id: selectedMember.user_id,
        tenant_id: profile.tenant_id,
        payment_type: commissionData.payment_type,
      };

      if (commissionData.payment_type === "commission") {
        commissionPayload.type = commissionData.type;
        commissionPayload.value = parseFloat(commissionData.value);
        commissionPayload.salary_amount = null;
        commissionPayload.salary_payment_day = null;
        commissionPayload.default_payment_method = null;
      } else {
        // Salário fixo
        commissionPayload.type = "fixed"; // Mantém compatibilidade
        commissionPayload.value = parseFloat(commissionData.salary_amount || "0");
        commissionPayload.salary_amount = parseFloat(commissionData.salary_amount || "0");
        commissionPayload.salary_payment_day = parseInt(commissionData.salary_payment_day || "1");
        commissionPayload.default_payment_method = commissionData.default_payment_method;
      }

      if (selectedMember.commission) {
        // Update existing commission
        const { error } = await supabase
          .from("professional_commissions")
          .update(commissionPayload)
          .eq("id", selectedMember.commission.id);

        if (error) throw error;
        toast.success(commissionData.payment_type === "salary" ? "Salário atualizado com sucesso!" : "Comissão atualizada com sucesso!");
      } else {
        // Create new commission
        const { error } = await supabase
          .from("professional_commissions")
          .insert(commissionPayload);

        if (error) throw error;
        toast.success(commissionData.payment_type === "salary" ? "Salário configurado com sucesso!" : "Comissão configurada com sucesso!");
      }

      setIsCommissionDialogOpen(false);
      setSelectedMember(null);
      setCommissionData({ 
        payment_type: "commission",
        type: "percentage", 
        value: "",
        salary_amount: "",
        salary_payment_day: "",
        default_payment_method: "",
      });
      fetchTeam();
    } catch (error: any) {
      logger.error("Error saving commission:", error);
      toast.error(error.message || "Erro ao salvar configuração");
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
            <Button className="gradient-primary text-primary-foreground" data-tour="team-invite-open">
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar profissional
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
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
                    data-tour="team-invite-full-name"
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
                    data-tour="team-invite-email"
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
                    data-tour="team-invite-password"
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
                    data-tour="team-invite-confirm-password"
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
                    data-tour="team-invite-phone"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Função</Label>
                  <Select
                    value={formData.role}
                    onValueChange={(v) => setFormData({ ...formData, role: v as AppRole })}
                  >
                    <SelectTrigger data-tour="team-invite-role">
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
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)} data-tour="team-invite-cancel">
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground" data-tour="team-invite-submit">
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
      {/* Dialog de Configuração de Comissão/Salário */}
      <Dialog open={isCommissionDialogOpen} onOpenChange={setIsCommissionDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Configurar Remuneração</DialogTitle>
            <DialogDescription>
              Configure a comissão ou salário fixo para {selectedMember?.full_name}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <Label>Tipo de Remuneração</Label>
              <Select
                value={commissionData.payment_type}
                onValueChange={(v) =>
                  setCommissionData({ ...commissionData, payment_type: v as "commission" | "salary" })
                }
              >
                <SelectTrigger data-tour="team-compensation-payment-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commission">Comissão</SelectItem>
                  <SelectItem value="salary">Salário Fixo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {commissionData.payment_type === "commission" ? (
              <>
                <div className="space-y-2">
                  <Label>Tipo de Comissão</Label>
                  <Select
                    value={commissionData.type}
                    onValueChange={(v) =>
                      setCommissionData({ ...commissionData, type: v as "percentage" | "fixed" })
                    }
                  >
                    <SelectTrigger data-tour="team-compensation-commission-type">
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
                    data-tour="team-compensation-commission-value"
                  />
                  <p className="text-xs text-muted-foreground">
                    {commissionData.type === "percentage"
                      ? "Digite o percentual (ex: 30 para 30%)"
                      : "Digite o valor fixo em reais"}
                  </p>
                </div>
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label>Valor do Salário (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={commissionData.salary_amount}
                    onChange={(e) =>
                      setCommissionData({ ...commissionData, salary_amount: e.target.value })
                    }
                    placeholder="Ex: 2000.00"
                    required
                    data-tour="team-compensation-salary-amount"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Dia do Pagamento</Label>
                  <Input
                    type="number"
                    min="1"
                    max="31"
                    value={commissionData.salary_payment_day}
                    onChange={(e) =>
                      setCommissionData({ ...commissionData, salary_payment_day: e.target.value })
                    }
                    placeholder="Ex: 5 (dia 5 de cada mês)"
                    required
                    data-tour="team-compensation-salary-payment-day"
                  />
                  <p className="text-xs text-muted-foreground">
                    Dia do mês em que o salário será pago (1 a 31)
                  </p>
                </div>
                <div className="space-y-2">
                  <Label>Método de Pagamento Padrão</Label>
                  <Select
                    value={commissionData.default_payment_method}
                    onValueChange={(v) =>
                      setCommissionData({ ...commissionData, default_payment_method: v })
                    }
                  >
                    <SelectTrigger data-tour="team-compensation-default-payment-method">
                      <SelectValue placeholder="Selecione o método" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pix">PIX</SelectItem>
                      <SelectItem value="deposit">Depósito em Conta</SelectItem>
                      <SelectItem value="cash">Espécie</SelectItem>
                      <SelectItem value="other">Outro</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsCommissionDialogOpen(false)}
              data-tour="team-compensation-cancel"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={handleSaveCommission}
              disabled={isSavingCommission}
              className="gradient-primary text-primary-foreground"
              data-tour="team-save-compensation"
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
            <>
              {/* Mobile: Card Layout */}
              <div className="block md:hidden space-y-3">
                {team.map((member) => {
                  const currentRole = member.user_roles[0]?.role || "staff";
                  const isCurrentUser = member.user_id === profile?.user_id;
                  const isHighlighted = member.user_id === highlightUserId && !member.commission;
                  return (
                    <div key={member.id} className="rounded-lg border p-4 space-y-3 relative" ref={isHighlighted ? highlightedRowRef : undefined}>
                      {isHighlighted && (
                        <div className="absolute -top-8 left-0 right-0 flex justify-center">
                          <div className="flex items-center gap-1 rounded-md bg-warning/20 px-3 py-1 text-sm text-warning border border-warning/30">
                            <ArrowDown className="h-4 w-4" />
                            <span>Profissional sem comissão definida</span>
                          </div>
                        </div>
                      )}
                      <div className="flex justify-between items-start">
                        <div>
                          <p className="font-medium">
                            {member.full_name}
                            {isCurrentUser && (
                              <span className="ml-2 text-xs text-muted-foreground">(você)</span>
                            )}
                          </p>
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {member.email || "—"}
                          </p>
                          {member.phone && (
                            <p className="text-sm text-muted-foreground">{member.phone}</p>
                          )}
                        </div>
                        {getRoleBadge(currentRole)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal">
                          {formatCommission(member.commission)}
                        </Badge>
                      </div>
                      {!isCurrentUser && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenCommissionDialog(member)}
                            className="gap-1"
                            data-tour="team-item-compensation"
                          >
                            <DollarSign className="h-3 w-3" />
                            Comissão
                          </Button>
                          <Select
                            value={currentRole}
                            onValueChange={(v) => updateRole(member.user_id, v as AppRole)}
                          >
                            <SelectTrigger className="w-36" data-tour="team-item-role">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="staff">Profissional</SelectItem>
                              <SelectItem value="admin">Administrador</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block overflow-x-auto">
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
                  const isHighlighted = member.user_id === highlightUserId && !member.commission;

                  return (
                    <TableRow key={member.id} ref={isHighlighted ? highlightedRowRef as React.Ref<HTMLTableRowElement> : undefined}>
                      <TableCell className="font-medium">
                        {isHighlighted && (
                          <div className="absolute -top-8 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-md bg-warning/20 px-3 py-1 text-sm text-warning border border-warning/30 z-10">
                            <ArrowDown className="h-4 w-4" />
                            <span>Profissional sem comissão definida</span>
                          </div>
                        )}
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
                                data-tour="team-item-compensation"
                              >
                                <DollarSign className="h-3 w-3" />
                                Comissão
                              </Button>
                              <Select
                                value={currentRole}
                                onValueChange={(v) => updateRole(member.user_id, v as AppRole)}
                              >
                                <SelectTrigger className="w-40" data-tour="team-item-role">
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
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </MainLayout>
  );
}
