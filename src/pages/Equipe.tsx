import { useState, useEffect, useRef } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { UserCog, Plus, Loader2, Mail, Shield, ShieldCheck, DollarSign, ArrowDown, AlertTriangle, Check, X, KeyRound, Copy, Lock, LockOpen, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { Profile, UserRole, AppRole, ProfessionalType } from "@/types/database";
import { PROFESSIONAL_TYPE_LABELS, COUNCIL_BY_TYPE } from "@/types/database";
import { CommissionRulesDrawer } from "@/components/equipe/CommissionRulesDrawer";
import { UsageIndicator, LimitGate } from "@/components/subscription/LimitGate";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

const UF_OPTIONS = [
  "AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA",
  "PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO",
];

const PERMISSION_PREVIEW_RESOURCES = [
  { key: "prontuarios", label: "Prontuários" },
  { key: "receituarios", label: "Receituários" },
  { key: "laudos", label: "Laudos" },
  { key: "atestados", label: "Atestados" },
  { key: "triagem", label: "Triagem" },
  { key: "evolucao_enfermagem", label: "Evol. Enfermagem" },
  { key: "evolucoes", label: "Evol. Clínica" },
  { key: "encaminhamentos", label: "Encaminhamentos" },
  { key: "odontograma", label: "Odontograma" },
  { key: "financeiro", label: "Financeiro" },
  { key: "faturamento_tiss", label: "Faturamento TISS" },
  { key: "equipe", label: "Equipe" },
  { key: "configuracoes", label: "Configurações" },
];

const PROFESSIONAL_TYPES_OPTIONS: ProfessionalType[] = [
  "medico","dentista","enfermeiro","tec_enfermagem","fisioterapeuta",
  "nutricionista","psicologo","fonoaudiologo","secretaria","faturista",
];

const TYPE_COLORS: Partial<Record<ProfessionalType, string>> = {
  medico: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-900/30 dark:text-blue-300",
  dentista: "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-900/30 dark:text-cyan-300",
  enfermeiro: "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300",
  tec_enfermagem: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300",
  fisioterapeuta: "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-300",
  nutricionista: "bg-lime-100 text-lime-800 border-lime-200 dark:bg-lime-900/30 dark:text-lime-300",
  psicologo: "bg-purple-100 text-purple-800 border-purple-200 dark:bg-purple-900/30 dark:text-purple-300",
  fonoaudiologo: "bg-pink-100 text-pink-800 border-pink-200 dark:bg-pink-900/30 dark:text-pink-300",
  secretaria: "bg-gray-100 text-gray-800 border-gray-200 dark:bg-gray-900/30 dark:text-gray-300",
  faturista: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300",
  admin: "bg-primary/20 text-primary border-primary/30",
};

interface TeamMember extends Profile {
  user_roles: UserRole[];
  is_readonly?: boolean;
  readonly_reason?: string | null;
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

const CLINICAL_TYPES: ProfessionalType[] = ["medico","dentista","enfermeiro","fisioterapeuta","nutricionista","psicologo","fonoaudiologo"];
const PRESCRIBER_TYPES: ProfessionalType[] = ["medico","dentista"];

function getTypeDefaultAccess(profType: ProfessionalType, resource: string): boolean {
  if (profType === "admin") return true;
  const map: Record<string, ProfessionalType[]> = {
    prontuarios: CLINICAL_TYPES,
    receituarios: PRESCRIBER_TYPES,
    laudos: ["medico","dentista","fisioterapeuta","psicologo","fonoaudiologo"],
    atestados: PRESCRIBER_TYPES,
    triagem: ["enfermeiro","tec_enfermagem"],
    evolucao_enfermagem: ["enfermeiro"],
    evolucoes: ["medico","dentista","fisioterapeuta","nutricionista","psicologo","fonoaudiologo"],
    encaminhamentos: CLINICAL_TYPES,
    odontograma: ["dentista"],
    financeiro: ["faturista"],
    faturamento_tiss: ["faturista"],
    equipe: [],
    configuracoes: [],
  };
  return (map[resource] ?? []).includes(profType);
}

export default function Equipe() {
  const { profile, isAdmin, session } = useAuth();
  const { isWithinLimit, getLimit } = usePlanFeatures();
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

  // 31B — Advanced commission rules drawer
  const [isRulesDrawerOpen, setIsRulesDrawerOpen] = useState(false);
  const [rulesMember, setRulesMember] = useState<TeamMember | null>(null);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    confirm_password: "",
    full_name: "",
    phone: "",
    role: "staff" as AppRole,
    professional_type: "" as ProfessionalType | "",
    council_type: "",
    council_number: "",
    council_state: "",
  });
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [isPermOverrideOpen, setIsPermOverrideOpen] = useState(false);
  const [overrideMember, setOverrideMember] = useState<TeamMember | null>(null);
  const [overrideData, setOverrideData] = useState<Record<string, { view: boolean; create: boolean; edit: boolean; delete: boolean }>>({});

  // 12G.2 — Clone permissions
  const [isCloneOpen, setIsCloneOpen] = useState(false);
  const [cloneSource, setCloneSource] = useState<TeamMember | null>(null);
  const [cloneTarget, setCloneTarget] = useState("");

  // 12G.4 — Readonly mode
  const [isReadonlyOpen, setIsReadonlyOpen] = useState(false);
  const [readonlyMember, setReadonlyMember] = useState<TeamMember | null>(null);
  const [readonlyReason, setReadonlyReason] = useState("");

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
          .select("id,user_id,tenant_id,full_name,email,phone,avatar_url,professional_type,council_type,council_number,council_state,is_readonly,readonly_reason,created_at,updated_at")
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

  const handleInvite = async () => {
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
          professional_type: formData.professional_type || undefined,
          council_type: formData.council_type || undefined,
          council_number: formData.council_number || undefined,
          council_state: formData.council_state || undefined,
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
        professional_type: "",
        council_type: "",
        council_number: "",
        council_state: "",
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

  const getRoleBadge = (role: AppRole, member?: TeamMember) => {
    if (role === "admin") {
      return (
        <Badge className="bg-primary/20 text-primary border-primary/30">
          <ShieldCheck className="mr-1 h-3 w-3" />
          Administrador
        </Badge>
      );
    }
    const pt = member?.professional_type as ProfessionalType | undefined;
    const label = pt ? PROFESSIONAL_TYPE_LABELS[pt] : "Profissional";
    const colorClass = pt ? (TYPE_COLORS[pt] || "bg-muted text-muted-foreground") : "bg-muted text-muted-foreground";
    const council = member?.council_number && member?.council_state
      ? ` (${member.council_type || COUNCIL_BY_TYPE[pt!] || ""} ${member.council_number}-${member.council_state})`
      : "";
    return (
      <Badge variant="outline" className={colorClass}>
        {label}{council}
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

  const handleOpenPermOverride = async (member: TeamMember) => {
    setOverrideMember(member);
    try {
      const { data } = await supabase
        .from("permission_overrides")
        .select("resource,can_view,can_create,can_edit,can_delete")
        .eq("user_id", member.user_id)
        .eq("tenant_id", profile?.tenant_id ?? "");
      const overrides: typeof overrideData = {};
      PERMISSION_PREVIEW_RESOURCES.forEach((r) => {
        const existing = data?.find((d: any) => d.resource === r.key);
        const profType = (member.professional_type || "secretaria") as ProfessionalType;
        const defaultAccess = getTypeDefaultAccess(profType, r.key);
        overrides[r.key] = existing
          ? { view: existing.can_view, create: existing.can_create, edit: existing.can_edit, delete: existing.can_delete }
          : { view: defaultAccess, create: defaultAccess, edit: defaultAccess, delete: defaultAccess };
      });
      setOverrideData(overrides);
    } catch {
      const profType = (member.professional_type || "secretaria") as ProfessionalType;
      const overrides: typeof overrideData = {};
      PERMISSION_PREVIEW_RESOURCES.forEach((r) => {
        const a = getTypeDefaultAccess(profType, r.key);
        overrides[r.key] = { view: a, create: a, edit: a, delete: a };
      });
      setOverrideData(overrides);
    }
    setIsPermOverrideOpen(true);
  };

  const handleSavePermOverride = async () => {
    if (!overrideMember || !profile?.tenant_id) return;
    setIsSaving(true);
    try {
      for (const r of PERMISSION_PREVIEW_RESOURCES) {
        const perm = overrideData[r.key];
        if (!perm) continue;
        const { error } = await supabase
          .from("permission_overrides")
          .upsert({
            tenant_id: profile.tenant_id,
            user_id: overrideMember.user_id,
            resource: r.key,
            can_view: perm.view,
            can_create: perm.create,
            can_edit: perm.edit,
            can_delete: perm.delete,
          }, { onConflict: "tenant_id,user_id,resource" });
        if (error) throw error;
      }
      toast.success("Permissões salvas com sucesso!");
      setIsPermOverrideOpen(false);
    } catch (error: any) {
      toast.error(error.message || "Erro ao salvar permissões");
    } finally {
      setIsSaving(false);
    }
  };

  // 12G.2 — Clone permissions
  const handleClonePermissions = async () => {
    if (!cloneSource || !cloneTarget || !profile?.tenant_id) return;
    setIsSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc("clone_permission_overrides", {
        p_source_user_id: cloneSource.user_id,
        p_target_user_id: cloneTarget,
      });
      if (error) throw error;
      toast.success(`${data ?? 0} permissões copiadas com sucesso!`);
      setIsCloneOpen(false);
      setCloneSource(null);
      setCloneTarget("");
    } catch (error: any) {
      toast.error(error.message || "Erro ao clonar permissões");
    } finally {
      setIsSaving(false);
    }
  };

  // 12G.4 — Toggle readonly mode
  const handleToggleReadonly = async () => {
    if (!readonlyMember || !profile?.tenant_id) return;
    setIsSaving(true);
    const newReadonly = !readonlyMember.is_readonly;
    try {
      const { error } = await (supabase as any).rpc("set_user_readonly", {
        p_target_user_id: readonlyMember.user_id,
        p_readonly: newReadonly,
        p_reason: newReadonly ? readonlyReason || null : null,
      });
      if (error) throw error;
      toast.success(newReadonly ? "Modo somente leitura ativado" : "Modo somente leitura desativado");
      setIsReadonlyOpen(false);
      setReadonlyMember(null);
      setReadonlyReason("");
      fetchTeam();
    } catch (error: any) {
      toast.error(error.message || "Erro ao alterar modo");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateProfessionalType = async (member: TeamMember, newType: ProfessionalType) => {
    if (!profile?.tenant_id) return;
    try {
      const council = COUNCIL_BY_TYPE[newType] || null;
      const { error } = await supabase
        .from("profiles")
        .update({
          professional_type: newType,
          council_type: council,
          council_number: null,
          council_state: null,
        })
        .eq("id", member.id);
      if (error) throw error;
      toast.success("Tipo profissional atualizado!");
      fetchTeam();
    } catch (error: any) {
      toast.error(error.message || "Erro ao atualizar tipo");
    }
  };

  const undefinedTypeCount = team.filter(
    (m) => !m.user_roles.some((r) => r.role === "admin") && (!m.professional_type || m.professional_type === "secretaria")
  ).length;

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

  const professionalsLimit = getLimit('professionals');
  const canAddProfessional = isWithinLimit('professionals', team.length);

  const handleOpenInviteDialog = () => {
    if (!canAddProfessional) {
      toast.error("Você atingiu o limite de profissionais do seu plano. Faça upgrade para adicionar mais.");
      return;
    }
    setIsDialogOpen(true);
  };

  return (
    <MainLayout
      title="Equipe"
      subtitle="Gerencie os membros da clínica"
      actions={
        <>
          <Button className="gradient-primary text-primary-foreground" onClick={handleOpenInviteDialog} data-tour="team-invite-open">
            <Plus className="mr-2 h-4 w-4" />
            Cadastrar profissional
          </Button>
          <FormDrawer
            open={isDialogOpen}
            onOpenChange={setIsDialogOpen}
            title="Cadastrar profissional"
            description="O profissional poderá acessar o sistema com o e-mail e a senha definidos abaixo."
            width="lg"
            onSubmit={handleInvite}
            isSubmitting={isSaving}
            submitLabel="Cadastrar profissional"
          >
            <FormDrawerSection title="Dados Pessoais">
              <div className="space-y-4">
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
                <div className="grid grid-cols-2 gap-4">
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
                    <Label>Telefone</Label>
                    <Input
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      placeholder="(11) 99999-9999"
                      data-tour="team-invite-phone"
                    />
                  </div>
                </div>
              </div>
            </FormDrawerSection>

            <FormDrawerSection title="Credenciais de Acesso">
              <div className="grid grid-cols-2 gap-4">
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
                </div>
              </div>
              {passwordError && (
                <p className="text-sm text-destructive mt-2">{passwordError}</p>
              )}
            </FormDrawerSection>

            <FormDrawerSection title="Função e Tipo Profissional">
              <div className="space-y-4">
                <div className="space-y-2">
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
                    Administradores têm acesso total. Profissionais têm acesso baseado no tipo.
                  </p>
                </div>

                {formData.role === "staff" && (
                  <>
                    <div className="space-y-2">
                      <Label>Tipo Profissional</Label>
                      <Select
                        value={formData.professional_type}
                        onValueChange={(v) => {
                          const pt = v as ProfessionalType;
                          const council = COUNCIL_BY_TYPE[pt] || "";
                          setFormData({ ...formData, professional_type: pt, council_type: council, council_number: "", council_state: "" });
                        }}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Selecione o tipo" />
                        </SelectTrigger>
                        <SelectContent>
                          {PROFESSIONAL_TYPES_OPTIONS.map((pt) => (
                            <SelectItem key={pt} value={pt}>{PROFESSIONAL_TYPE_LABELS[pt]}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {formData.professional_type && COUNCIL_BY_TYPE[formData.professional_type as ProfessionalType] && (
                      <div className="grid grid-cols-3 gap-3">
                        <div className="space-y-2">
                          <Label>Conselho</Label>
                          <Input value={formData.council_type} disabled className="bg-muted" />
                        </div>
                        <div className="space-y-2">
                          <Label>Número</Label>
                          <Input
                            value={formData.council_number}
                            onChange={(e) => setFormData({ ...formData, council_number: e.target.value })}
                            placeholder="12345"
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>UF</Label>
                          <Select
                            value={formData.council_state}
                            onValueChange={(v) => setFormData({ ...formData, council_state: v })}
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="UF" />
                            </SelectTrigger>
                            <SelectContent>
                              {UF_OPTIONS.map((uf) => (
                                <SelectItem key={uf} value={uf}>{uf}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    )}

                    {formData.professional_type && (
                      <div className="rounded-lg border p-3 space-y-2 bg-muted/50">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Preview de Permissões</p>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                          {PERMISSION_PREVIEW_RESOURCES.map((r) => {
                            const hasAccess = getTypeDefaultAccess(formData.professional_type as ProfessionalType, r.key);
                            return (
                              <div key={r.key} className="flex items-center gap-1.5 text-xs">
                                {hasAccess ? (
                                  <Check className="h-3.5 w-3.5 text-green-600 shrink-0" />
                                ) : (
                                  <X className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                                )}
                                <span className={hasAccess ? "text-foreground" : "text-muted-foreground/60"}>{r.label}</span>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            </FormDrawerSection>
          </FormDrawer>
        </>
      }
    >

      {/* 12D.7 — Dialog de Override de Permissões */}
      <Dialog open={isPermOverrideOpen} onOpenChange={setIsPermOverrideOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Personalizar Permissões</DialogTitle>
            <DialogDescription>
              Ajuste as permissões individuais de {overrideMember?.full_name}. Essas configurações sobrescrevem o template do tipo profissional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1 py-2">
            <div className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 text-xs font-semibold text-muted-foreground uppercase px-1 pb-1">
              <span>Recurso</span>
              <span className="w-10 text-center">Ver</span>
              <span className="w-10 text-center">Criar</span>
              <span className="w-10 text-center">Editar</span>
              <span className="w-10 text-center">Excluir</span>
            </div>
            {PERMISSION_PREVIEW_RESOURCES.map((r) => {
              const perm = overrideData[r.key] || { view: false, create: false, edit: false, delete: false };
              return (
                <div key={r.key} className="grid grid-cols-[1fr_auto_auto_auto_auto] gap-1 items-center px-1 py-1 rounded hover:bg-muted/50">
                  <span className="text-sm">{r.label}</span>
                  {(["view", "create", "edit", "delete"] as const).map((action) => (
                    <button
                      key={action}
                      type="button"
                      className={`w-10 h-7 flex items-center justify-center rounded border text-xs transition-colors ${perm[action] ? "bg-green-100 border-green-300 text-green-700 dark:bg-green-900/30 dark:text-green-300" : "bg-muted/50 border-border text-muted-foreground/40"}`}
                      onClick={() => setOverrideData((prev) => ({
                        ...prev,
                        [r.key]: { ...prev[r.key], [action]: !perm[action] },
                      }))}
                    >
                      {perm[action] ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                    </button>
                  ))}
                </div>
              );
            })}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsPermOverrideOpen(false)}>Cancelar</Button>
            <Button onClick={handleSavePermOverride} disabled={isSaving} className="gradient-primary text-primary-foreground">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : "Salvar Permissões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12G.2 — Dialog de Clonagem de Permissões */}
      <Dialog open={isCloneOpen} onOpenChange={setIsCloneOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Clonar Permissões</DialogTitle>
            <DialogDescription>
              Copie as permissões personalizadas de {cloneSource?.full_name} para outro profissional.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Origem</Label>
              <Input value={cloneSource?.full_name ?? ""} disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Destino</Label>
              <Select value={cloneTarget} onValueChange={setCloneTarget}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o profissional" />
                </SelectTrigger>
                <SelectContent>
                  {team
                    .filter((m) => m.user_id !== cloneSource?.user_id && m.user_id !== profile?.user_id)
                    .map((m) => (
                      <SelectItem key={m.user_id} value={m.user_id}>
                        {m.full_name}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                As permissões existentes do destino serão substituídas.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCloneOpen(false)}>Cancelar</Button>
            <Button onClick={handleClonePermissions} disabled={isSaving || !cloneTarget} className="gradient-primary text-primary-foreground">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Copiando...</> : "Copiar Permissões"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12G.4 — Dialog de Modo Somente Leitura */}
      <Dialog open={isReadonlyOpen} onOpenChange={setIsReadonlyOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {readonlyMember?.is_readonly ? "Desativar Modo Somente Leitura" : "Ativar Modo Somente Leitura"}
            </DialogTitle>
            <DialogDescription>
              {readonlyMember?.is_readonly
                ? `${readonlyMember?.full_name} voltará a ter permissões normais de criação, edição e exclusão.`
                : `${readonlyMember?.full_name} só poderá visualizar dados, sem criar, editar ou excluir.`}
            </DialogDescription>
          </DialogHeader>
          {!readonlyMember?.is_readonly && (
            <div className="space-y-2 py-4">
              <Label>Motivo (opcional)</Label>
              <Input
                value={readonlyReason}
                onChange={(e) => setReadonlyReason(e.target.value)}
                placeholder="Ex: Investigação interna"
              />
              <p className="text-xs text-muted-foreground">
                O motivo ficará registrado para auditoria.
              </p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsReadonlyOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleToggleReadonly}
              disabled={isSaving}
              variant={readonlyMember?.is_readonly ? "default" : "destructive"}
            >
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Processando...</>
              ) : readonlyMember?.is_readonly ? (
                <><LockOpen className="mr-2 h-4 w-4" />Desativar</>
              ) : (
                <><Lock className="mr-2 h-4 w-4" />Ativar</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 12D.8 — Banner de migração */}
      {!isLoading && undefinedTypeCount > 0 && (
        <div className="mb-4 rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-700 p-4 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {undefinedTypeCount} profissional{undefinedTypeCount > 1 ? "is" : ""} sem tipo definido
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
              Defina o tipo profissional de cada membro para ativar o controle de acessos granular (RBAC).
              Enquanto o tipo não for definido, esses profissionais terão acesso de secretária (mais restrito).
            </p>
          </div>
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
          <CardTitle>{isLoading ? "Membros da Equipe" : `Membros da Equipe (${team.length})`}</CardTitle>
          {!isLoading && (
            <UsageIndicator 
              limit="professionals" 
              currentValue={team.length} 
              showLabel={false} 
              size="sm" 
              className="w-48"
            />
          )}
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
                        {getRoleBadge(currentRole, member)}
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="font-normal">
                          {formatCommission(member.commission)}
                        </Badge>
                      </div>
                      {!isCurrentUser && (
                        <div className="flex flex-wrap gap-2 pt-2 border-t">
                          {member.is_readonly && (
                            <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                              <Lock className="mr-1 h-3 w-3" />
                              Somente leitura
                            </Badge>
                          )}
                          <Button
                            variant="outline"
                            size="sm"
                            asChild
                            className="gap-1"
                            data-tour="team-item-compensation"
                          >
                            <Link to={`/repasses/regras?profissional=${member.user_id}`}>
                              <DollarSign className="h-3 w-3" />
                              Comissão
                            </Link>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPermOverride(member)}
                            className="gap-1"
                          >
                            <KeyRound className="h-3 w-3" />
                            Permissões
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setCloneSource(member);
                              setCloneTarget("");
                              setIsCloneOpen(true);
                            }}
                            className="gap-1"
                          >
                            <Copy className="h-3 w-3" />
                            Clonar
                          </Button>
                          <Button
                            variant={member.is_readonly ? "outline" : "ghost"}
                            size="sm"
                            onClick={() => {
                              setReadonlyMember(member);
                              setReadonlyReason("");
                              setIsReadonlyOpen(true);
                            }}
                            className={member.is_readonly ? "gap-1 border-amber-300 text-amber-700" : "gap-1"}
                          >
                            {member.is_readonly ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                            {member.is_readonly ? "Desbloquear" : "Bloquear"}
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
                      <TableCell>{getRoleBadge(currentRole, member)}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-normal">
                          {formatCommission(member.commission)}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-2">
                          {!isCurrentUser && (
                            <>
                              {member.is_readonly && (
                                <Badge variant="outline" className="bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-300">
                                  <Lock className="mr-1 h-3 w-3" />
                                  Somente leitura
                                </Badge>
                              )}
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => handleOpenPermOverride(member)}
                                className="gap-1"
                              >
                                <KeyRound className="h-3 w-3" />
                                Permissões
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  setCloneSource(member);
                                  setCloneTarget("");
                                  setIsCloneOpen(true);
                                }}
                                className="gap-1"
                                title="Clonar permissões"
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                              <Button
                                variant={member.is_readonly ? "outline" : "ghost"}
                                size="sm"
                                onClick={() => {
                                  setReadonlyMember(member);
                                  setReadonlyReason("");
                                  setIsReadonlyOpen(true);
                                }}
                                className={member.is_readonly ? "gap-1 border-amber-300 text-amber-700" : "gap-1"}
                                title={member.is_readonly ? "Desativar modo somente leitura" : "Ativar modo somente leitura"}
                              >
                                {member.is_readonly ? <LockOpen className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                asChild
                                className="gap-1"
                                data-tour="team-item-compensation"
                              >
                                <Link to={`/repasses/regras?profissional=${member.user_id}`}>
                                  <DollarSign className="h-3 w-3" />
                                  Comissão
                                </Link>
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
