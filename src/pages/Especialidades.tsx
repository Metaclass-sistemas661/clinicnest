import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  HeartPulse,
  Plus,
  Loader2,
  Search,
  Pencil,
  Stethoscope,
  Clock,
  Users,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";

interface Especialidade {
  id: string;
  name: string;
  description: string;
  avg_consultation_minutes: number;
  professionals_count: number;
  color: string;
  is_active: boolean;
}


const emptyForm = {
  name: "",
  description: "",
  avg_consultation_minutes: "30",
  color: "#3B82F6",
  is_active: true,
};

export default function Especialidades() {
  const { profile } = useAuth();
  const [especialidades, setEspecialidades] = useState<Especialidade[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (profile?.tenant_id) fetchEspecialidades();
  }, [profile?.tenant_id]);

  const fetchEspecialidades = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("specialties")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      const mapped: Especialidade[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        description: r.description ?? "",
        avg_consultation_minutes: r.avg_duration_minutes ?? 30,
        professionals_count: 0,
        color: r.color ?? "#3B82F6",
        is_active: r.is_active,
      }));
      setEspecialidades(mapped);
    } catch (err) {
      logger.error("Error fetching specialties:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = especialidades.filter(
    (e) =>
      e.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleOpen = (esp?: Especialidade) => {
    if (esp) {
      setEditingId(esp.id);
      setFormData({
        name: esp.name,
        description: esp.description,
        avg_consultation_minutes: String(esp.avg_consultation_minutes),
        color: esp.color,
        is_active: esp.is_active,
      });
    } else {
      setEditingId(null);
      setFormData(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) { toast.error("Nome da especialidade é obrigatório"); return; }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        description: formData.description || null,
        avg_duration_minutes: Number(formData.avg_consultation_minutes),
        color: formData.color,
        is_active: formData.is_active,
      };
      if (editingId) {
        const { error } = await api
          .from("specialties")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", profile!.tenant_id);
        if (error) throw error;
        toast.success("Especialidade atualizada!");
      } else {
        const { error } = await api
          .from("specialties")
          .insert({ ...payload, tenant_id: profile!.tenant_id });
        if (error) throw error;
        toast.success("Especialidade cadastrada!");
      }
      setIsDialogOpen(false);
      fetchEspecialidades();
    } catch (err) {
      logger.error("Erro ao salvar especialidade:", err);
      toast.error("Erro ao salvar especialidade", { description: normalizeError(err, "Não foi possível salvar a especialidade.") });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await api
        .from("specialties")
        .update({ is_active: !current })
        .eq("id", id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      setEspecialidades((prev) =>
        prev.map((e) => (e.id === id ? { ...e, is_active: !current } : e))
      );
    } catch (err) {
      logger.error("Erro ao alternar especialidade:", err);
      toast.error("Erro ao atualizar status", { description: normalizeError(err, "Não foi possível alterar o status da especialidade.") });
    }
  };

  const activeCount = especialidades.filter((e) => e.is_active).length;

  return (
    <MainLayout
      title="Especialidades Médicas"
      subtitle="Gerencie as especialidades oferecidas pela clínica"
      actions={
        <Button variant="gradient" onClick={() => handleOpen()}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Especialidade
        </Button>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Stethoscope className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Especialidades</p>
              <p className="text-2xl font-bold">{especialidades.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10">
              <HeartPulse className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativas</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Profissionais</p>
              <p className="text-2xl font-bold">
                {especialidades.reduce((s, e) => s + e.professionals_count, 0)}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="mb-4 relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar especialidade..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 w-full rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={Stethoscope}
          title="Nenhuma especialidade encontrada"
          description="Cadastre as especialidades médicas da clínica."
          action={
            <Button variant="gradient" onClick={() => handleOpen()}>
              <Plus className="mr-2 h-4 w-4" />
              Nova Especialidade
            </Button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((esp) => (
            <Card key={esp.id} className={`overflow-hidden transition-all hover:shadow-md ${!esp.is_active ? "opacity-60" : ""}`}>
              <div className="h-1.5 w-full" style={{ backgroundColor: esp.color }} />
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-xl"
                      style={{ backgroundColor: esp.color + "20" }}
                    >
                      <Stethoscope className="h-4 w-4" style={{ color: esp.color }} />
                    </div>
                    <div>
                      <CardTitle className="text-sm">{esp.name}</CardTitle>
                      <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />{esp.avg_consultation_minutes} min
                        </span>
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />{esp.professionals_count} prof.
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleOpen(esp)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-0 pb-4 space-y-3">
                {esp.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{esp.description}</p>
                )}
                <div className="flex items-center justify-between">
                  <Badge
                    variant="outline"
                    className={esp.is_active ? "bg-success/20 text-success border-success/30" : "bg-muted text-muted-foreground"}
                  >
                    {esp.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                  <Switch checked={esp.is_active} onCheckedChange={() => toggleActive(esp.id, esp.is_active)} />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Especialidade" : "Nova Especialidade"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Atualize os dados da especialidade" : "Adicione uma nova especialidade médica"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Nome da Especialidade *</Label>
                <Input
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Cardiologia, Dermatologia..."
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Descrição</Label>
                <Textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Breve descrição da especialidade..."
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duração Média (min)</Label>
                  <Input
                    type="number"
                    min="10"
                    max="180"
                    step="5"
                    value={formData.avg_consultation_minutes}
                    onChange={(e) => setFormData({ ...formData, avg_consultation_minutes: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Cor de Identificação</Label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="h-10 w-10 cursor-pointer rounded-lg border p-1"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="font-mono text-sm"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div>
                  <Label>Especialidade Ativa</Label>
                  <p className="text-sm text-muted-foreground">Visível no agendamento de consultas</p>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} variant="gradient">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editingId ? "Atualizar" : "Cadastrar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
