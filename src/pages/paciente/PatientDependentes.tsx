import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Users,
  UserPlus,
  User,
  Calendar,
  Phone,
  Mail,
  Trash2,
  AlertCircle,
  Loader2,
  Heart,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Dependent, getRelationshipLabel, RELATIONSHIP_LABELS } from "@/hooks/useDependents";

interface DependentDetails extends Dependent {
  email?: string;
  phone?: string;
  birth_date?: string;
}

export default function PatientDependentes() {
  const [dependents, setDependents] = useState<DependentDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showRemoveDialog, setShowRemoveDialog] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formBirthDate, setFormBirthDate] = useState("");
  const [formRelationship, setFormRelationship] = useState("");

  const loadDependents = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_dependents");
      if (error) throw error;
      setDependents((data as DependentDetails[]) || []);
    } catch (err) {
      logger.error("[PatientDependentes] Error loading:", err);
      toast.error("Erro ao carregar dependentes");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void loadDependents();
  }, []);

  const resetForm = () => {
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormBirthDate("");
    setFormRelationship("");
  };

  const handleAddDependent = async () => {
    if (!formName.trim() || !formRelationship) {
      toast.error("Preencha o nome e o parentesco");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("add_patient_dependent", {
        p_name: formName.trim(),
        p_email: formEmail.trim() || null,
        p_phone: formPhone.trim() || null,
        p_birth_date: formBirthDate || null,
        p_relationship: formRelationship,
      });

      if (error) throw error;

      const result = data as { success?: boolean; message?: string };
      if (result?.success) {
        toast.success(result.message || "Dependente adicionado com sucesso!");
        setShowAddDialog(false);
        resetForm();
        await loadDependents();
      } else {
        toast.error(result?.message || "Erro ao adicionar dependente");
      }
    } catch (err: any) {
      logger.error("[PatientDependentes] Error adding:", err);
      toast.error(err?.message || "Erro ao adicionar dependente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemoveDependent = async () => {
    if (!showRemoveDialog) return;

    setIsSubmitting(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("remove_patient_dependent", {
        p_dependent_id: showRemoveDialog,
      });

      if (error) throw error;

      const result = data as { success?: boolean; message?: string };
      if (result?.success) {
        toast.success(result.message || "Dependente removido");
        setShowRemoveDialog(null);
        await loadDependents();
      } else {
        toast.error(result?.message || "Erro ao remover dependente");
      }
    } catch (err: any) {
      logger.error("[PatientDependentes] Error removing:", err);
      toast.error(err?.message || "Erro ao remover dependente");
    } finally {
      setIsSubmitting(false);
    }
  };

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .slice(0, 2)
      .join("")
      .toUpperCase();
  };

  return (
    <PatientLayout
      title="Meus Dependentes"
      subtitle="Gerencie familiares vinculados à sua conta"
      actions={
        <Button onClick={() => setShowAddDialog(true)} className="gap-2 bg-teal-600 hover:bg-teal-700">
          <UserPlus className="h-4 w-4" />
          <span className="hidden sm:inline">Adicionar Dependente</span>
        </Button>
      }
    >
      {/* Info card */}
      <Card className="mb-6 border-teal-200 bg-teal-50/50 dark:border-teal-800 dark:bg-teal-950/30">
        <CardContent className="py-4">
          <div className="flex gap-3">
            <Heart className="h-5 w-5 text-teal-600 dark:text-teal-400 shrink-0 mt-0.5" />
            <div className="text-sm text-teal-700 dark:text-teal-300">
              <p className="font-medium mb-1">Agendamento para a família</p>
              <p className="text-xs opacity-90">
                Adicione seus dependentes (filhos, cônjuge, pais) para poder agendar consultas em nome deles.
                Ao agendar, você poderá escolher para quem é a consulta.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dependents list */}
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : dependents.length === 0 ? (
        <EmptyState
          icon={Users}
          title="Nenhum dependente cadastrado"
          description="Adicione familiares para poder agendar consultas em nome deles."
          action={
            <Button onClick={() => setShowAddDialog(true)} className="gap-2">
              <UserPlus className="h-4 w-4" />
              Adicionar Dependente
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {dependents.map((dep) => (
            <Card key={dep.dependent_id} className="hover:shadow-md transition-shadow">
              <CardContent className="pt-5 pb-4">
                <div className="flex items-start gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarFallback className="bg-teal-100 text-teal-700 dark:bg-teal-900 dark:text-teal-300 text-sm font-medium">
                      {getInitials(dep.dependent_name)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold text-foreground truncate">
                        {dep.dependent_name}
                      </h3>
                      <Badge variant="secondary" className="text-[10px]">
                        {getRelationshipLabel(dep.relationship)}
                      </Badge>
                    </div>
                    <div className="mt-2 space-y-1">
                      {dep.email && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Mail className="h-3 w-3" />
                          {dep.email}
                        </p>
                      )}
                      {dep.phone && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Phone className="h-3 w-3" />
                          {dep.phone}
                        </p>
                      )}
                      {dep.birth_date && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(dep.birth_date).toLocaleDateString("pt-BR")}
                        </p>
                      )}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={() => setShowRemoveDialog(dep.dependent_id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Add Dialog */}
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-teal-600" />
              Adicionar Dependente
            </DialogTitle>
            <DialogDescription>
              Preencha os dados do familiar que deseja vincular à sua conta.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Nome do dependente"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="relationship">Parentesco *</Label>
              <Select value={formRelationship} onValueChange={setFormRelationship}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecione o parentesco" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RELATIONSHIP_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="email">E-mail (opcional)</Label>
              <Input
                id="email"
                type="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="email@exemplo.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone (opcional)</Label>
              <Input
                id="phone"
                value={formPhone}
                onChange={(e) => setFormPhone(e.target.value)}
                placeholder="(11) 99999-9999"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="birthDate">Data de nascimento (opcional)</Label>
              <Input
                id="birthDate"
                type="date"
                value={formBirthDate}
                onChange={(e) => setFormBirthDate(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddDialog(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleAddDependent}
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Adicionando...
                </>
              ) : (
                <>
                  <UserPlus className="mr-2 h-4 w-4" />
                  Adicionar
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Dialog */}
      <Dialog open={!!showRemoveDialog} onOpenChange={() => setShowRemoveDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Remover Dependente
            </DialogTitle>
            <DialogDescription>
              Tem certeza que deseja remover este dependente? Você não poderá mais agendar consultas em nome dele.
            </DialogDescription>
          </DialogHeader>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRemoveDialog(null)}>
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRemoveDependent}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Removendo...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Remover
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PatientLayout>
  );
}
