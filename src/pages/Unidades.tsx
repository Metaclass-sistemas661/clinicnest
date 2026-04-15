import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Building,
  Plus,
  Pencil,
  Trash2,
  Phone,
  MapPin,
  Hash,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";

interface ClinicUnit {
  id: string;
  name: string;
  phone: string | null;
  address_street: string | null;
  address_city: string | null;
  address_state: string | null;
  address_zip: string | null;
  cnes_code: string | null;
  is_active: boolean;
  created_at: string;
}

const emptyForm = {
  name: "",
  phone: "",
  address_street: "",
  address_city: "",
  address_state: "",
  address_zip: "",
  cnes_code: "",
  is_active: true,
};

export default function Unidades() {
  const { profile } = useAuth();
  const [units, setUnits] = useState<ClinicUnit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({ ...emptyForm });

  useEffect(() => {
    if (profile?.tenant_id) void fetchUnits();
  }, [profile?.tenant_id]);

  const fetchUnits = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("clinic_units")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setUnits(data ?? []);
    } catch (err) {
      logger.error("Unidades fetch:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openCreate = () => {
    setEditingId(null);
    setFormData({ ...emptyForm });
    setIsDialogOpen(true);
  };

  const openEdit = (unit: ClinicUnit) => {
    setEditingId(unit.id);
    setFormData({
      name: unit.name,
      phone: unit.phone ?? "",
      address_street: unit.address_street ?? "",
      address_city: unit.address_city ?? "",
      address_state: unit.address_state ?? "",
      address_zip: unit.address_zip ?? "",
      cnes_code: unit.cnes_code ?? "",
      is_active: unit.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      toast.error("Nome da unidade é obrigatório");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name.trim(),
        phone: formData.phone || null,
        address_street: formData.address_street || null,
        address_city: formData.address_city || null,
        address_state: formData.address_state || null,
        address_zip: formData.address_zip || null,
        cnes_code: formData.cnes_code || null,
        is_active: formData.is_active,
        tenant_id: profile!.tenant_id,
      };

      if (editingId) {
        const { error } = await api
          .from("clinic_units")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", profile!.tenant_id);
        if (error) throw error;
        toast.success("Unidade atualizada");
      } else {
        const { error } = await api.from("clinic_units").insert(payload);
        if (error) throw error;
        toast.success("Unidade criada");
      }
      setIsDialogOpen(false);
      void fetchUnits();
    } catch (err) {
      logger.error("Unidades save:", err);
      toast.error("Erro ao salvar unidade", { description: normalizeError(err, "Não foi possível salvar a unidade.") });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir esta unidade?")) return;
    try {
      const { error } = await api
        .from("clinic_units")
        .delete()
        .eq("id", id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      toast.success("Unidade excluída");
      void fetchUnits();
    } catch (err) {
      logger.error("Unidades delete:", err);
      toast.error("Erro ao excluir unidade", { description: normalizeError(err, "Não foi possível excluir a unidade.") });
    }
  };

  const field = (key: keyof typeof formData, val: string | boolean) =>
    setFormData((prev) => ({ ...prev, [key]: val }));

  return (
    <MainLayout
      title="Unidades"
      subtitle="Gerencie as unidades/filiais da clínica"
      actions={
        <Button onClick={openCreate} size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          Nova Unidade
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Card key={i}>
              <CardContent className="pt-6 space-y-2">
                <Skeleton className="h-5 w-40" />
                <Skeleton className="h-4 w-56" />
                <Skeleton className="h-4 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : units.length === 0 ? (
        <EmptyState
          icon={Building}
          title="Nenhuma unidade cadastrada"
          description="Cadastre a primeira unidade/filial da clínica."
          action={
            <Button onClick={openCreate} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Nova Unidade
            </Button>
          }
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {units.map((unit) => (
            <Card key={unit.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{unit.name}</CardTitle>
                  <Badge variant={unit.is_active ? "default" : "secondary"}>
                    {unit.is_active ? "Ativa" : "Inativa"}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                {unit.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5" />
                    {unit.phone}
                  </div>
                )}
                {(unit.address_street || unit.address_city) && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5" />
                    {[unit.address_street, unit.address_city, unit.address_state]
                      .filter(Boolean)
                      .join(", ")}
                  </div>
                )}
                {unit.cnes_code && (
                  <div className="flex items-center gap-2">
                    <Hash className="h-3.5 w-3.5" />
                    CNES: {unit.cnes_code}
                  </div>
                )}
                <div className="flex gap-2 pt-2">
                  <Button size="sm" variant="outline" onClick={() => openEdit(unit)} className="flex-1 gap-1">
                    <Pencil className="h-3.5 w-3.5" />
                    Editar
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => void handleDelete(unit.id)} className="gap-1 text-destructive hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editar Unidade" : "Nova Unidade"}</DialogTitle>
            <DialogDescription>Preencha os dados da unidade/filial.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
            <div className="space-y-1">
              <Label htmlFor="name">Nome *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => field("name", e.target.value)}
                placeholder="Ex: Unidade Centro"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => field("phone", e.target.value)}
                  placeholder="(11) 3333-4444"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="cnes">CNES</Label>
                <Input
                  id="cnes"
                  value={formData.cnes_code}
                  onChange={(e) => field("cnes_code", e.target.value)}
                  placeholder="0000000"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="street">Endereço</Label>
              <Input
                id="street"
                value={formData.address_street}
                onChange={(e) => field("address_street", e.target.value)}
                placeholder="Rua, número"
              />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="col-span-2 space-y-1">
                <Label htmlFor="city">Cidade</Label>
                <Input
                  id="city"
                  value={formData.address_city}
                  onChange={(e) => field("address_city", e.target.value)}
                  placeholder="São Paulo"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="state">UF</Label>
                <Input
                  id="state"
                  value={formData.address_state}
                  onChange={(e) => field("address_state", e.target.value.toUpperCase().substring(0, 2))}
                  placeholder="SP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(v) => field("is_active", v)}
              />
              <Label htmlFor="is_active">Unidade ativa</Label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? "Salvando..." : editingId ? "Salvar" : "Criar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
