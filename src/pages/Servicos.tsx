import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { Switch } from "@/components/ui/switch";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
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
import { setServiceActiveV2, upsertServiceV2 } from "@/lib/supabase-typed-rpc";
import { Stethoscope, Plus, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import { z } from "zod";
import type { Service } from "@/types/database";

const serviceFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  description: z.string().optional(),
  duration_minutes: z.coerce.number().min(5, "Mínimo 5 minutos").max(480, "Máximo 8 horas"),
  price: z.union([
    z.string().refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, "Preço inválido"),
    z.number().min(0),
  ]),
  is_active: z.boolean(),
});

export default function Servicos() {
  const { profile, isAdmin } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingService, setEditingService] = useState<Service | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    duration_minutes: "30",
    price: "",
    is_active: true,
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchServices();
    }
  }, [profile?.tenant_id]);

  const fetchServices = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from("services")
        .select("id,tenant_id,name,description,duration_minutes,price,is_active,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      setServices((data as Service[]) || []);
    } catch (error) {
      logger.error("Error fetching services:", error);
      toast.error("Erro ao carregar serviços. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (service?: Service) => {
    if (service) {
      setEditingService(service);
      setFormData({
        name: service.name,
        description: service.description || "",
        duration_minutes: service.duration_minutes.toString(),
        price: service.price.toString(),
        is_active: service.is_active,
      });
    } else {
      setEditingService(null);
      setFormData({
        name: "",
        description: "",
        duration_minutes: "30",
        price: "",
        is_active: true,
      });
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!profile?.tenant_id) return;

    const parsed = serviceFormSchema.safeParse({
      name: formData.name.trim(),
      description: formData.description,
      duration_minutes: formData.duration_minutes,
      price: formData.price,
      is_active: formData.is_active,
    });
    if (!parsed.success) {
      const msg = parsed.error.errors[0]?.message ?? "Verifique os dados";
      toast.error(msg);
      return;
    }

    setIsSaving(true);

    try {
      const price = parseFloat(parsed.data.price as string) || 0;
      const { error } = await upsertServiceV2({
        p_service_id: editingService?.id ?? null,
        p_name: parsed.data.name,
        p_description: parsed.data.description || null,
        p_duration_minutes: parsed.data.duration_minutes,
        p_price: price,
        p_is_active: parsed.data.is_active,
      });

      if (error) {
        toastRpcError(toast, error as any, editingService ? "Erro ao atualizar procedimento" : "Erro ao cadastrar procedimento");
        return;
      }

      toast.success(editingService ? "Procedimento atualizado com sucesso!" : "Procedimento cadastrado com sucesso!");

      setIsDialogOpen(false);
      setFormData({
        name: "",
        description: "",
        duration_minutes: "30",
        price: "",
        is_active: true,
      });
      setEditingService(null);
      fetchServices();
    } catch (error) {
      toast.error(editingService ? "Erro ao atualizar procedimento" : "Erro ao cadastrar procedimento");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      const { error } = await setServiceActiveV2({
        p_service_id: service.id,
        p_is_active: !service.is_active,
      });

      if (error) {
        toastRpcError(toast, error as any, "Erro ao alterar status do procedimento");
        return;
      }

      toast.success(service.is_active ? "Procedimento desativado" : "Procedimento ativado");
      fetchServices();
    } catch (_error) {
      toast.error("Erro ao alterar status do procedimento");
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout
      title="Procedimentos & Consultas"
      subtitle={isAdmin ? "Gerencie os procedimentos e consultas oferecidos" : "Consulte os procedimentos da clínica"}
      actions={
        isAdmin ? (
          <>
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="services-new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Procedimento
            </Button>
            <FormDrawer
              open={isDialogOpen}
              onOpenChange={setIsDialogOpen}
              title={editingService ? "Editar Procedimento" : "Novo Procedimento"}
              description={editingService
                ? "Atualize os dados do procedimento"
                : "Cadastre um novo procedimento ou consulta na clínica"}
              width="md"
              onSubmit={handleSubmit}
              isSubmitting={isSaving}
              submitLabel={editingService ? "Atualizar" : "Cadastrar"}
            >
              <FormDrawerSection title="Informações Básicas">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Nome do Procedimento</Label>
                    <Input
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="Ex: Consulta Clínica, Eletrocardiograma..."
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Descrição</Label>
                    <Input
                      value={formData.description}
                      onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                      placeholder="Descrição opcional..."
                    />
                  </div>
                </div>
              </FormDrawerSection>

              <FormDrawerSection title="Duração e Preço">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Duração (minutos)</Label>
                    <Input
                      type="number"
                      min="5"
                      step="5"
                      value={formData.duration_minutes}
                      onChange={(e) =>
                        setFormData({ ...formData, duration_minutes: e.target.value })
                      }
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Preço (R$)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      placeholder="0,00"
                      required
                    />
                  </div>
                </div>
              </FormDrawerSection>

              <FormDrawerSection title="Status">
                <div className="flex items-center justify-between rounded-lg border p-4">
                  <div>
                    <Label>Procedimento Ativo</Label>
                    <p className="text-sm text-muted-foreground">
                      Procedimentos inativos não aparecem no agendamento
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                </div>
              </FormDrawerSection>
            </FormDrawer>
          </>
        ) : null
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Procedimentos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : services.length === 0 ? (
            <EmptyState
              icon={Stethoscope}
              title="Nenhum procedimento cadastrado"
              description={isAdmin ? "Cadastre os procedimentos e consultas oferecidos pela clínica para usar na agenda." : "Ainda não há procedimentos cadastrados."}
              action={isAdmin ? (
                <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="services-new-empty">
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Serviço
                </Button>
              ) : undefined}
            />
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="block md:hidden space-y-3">
                {services.map((service) => (
                  <div
                    key={service.id}
                    className={`rounded-lg border p-4 space-y-3 ${!service.is_active ? "opacity-60" : ""}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{service.description}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          service.is_active
                            ? "bg-success/20 text-success border-success/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {service.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {service.duration_minutes} min
                      </span>
                      <span className="font-semibold">{formatCurrency(service.price)}</span>
                    </div>
                    {isAdmin && (
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(service)} aria-label={`Editar serviço ${service.name}`} data-tour="services-item-edit">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={() => toggleActive(service)}
                        data-tour="services-item-toggle-active"
                      />
                      <span className="text-xs text-muted-foreground">
                        {service.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Serviço</TableHead>
                  <TableHead>Duração</TableHead>
                  <TableHead>Preço</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {services.map((service) => (
                  <TableRow key={service.id} className={!service.is_active ? "opacity-60" : ""}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="text-sm text-muted-foreground">{service.description}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        {service.duration_minutes} min
                      </div>
                    </TableCell>
                    <TableCell className="font-semibold">
                      {formatCurrency(service.price)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          service.is_active
                            ? "bg-success/20 text-success border-success/30"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {service.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin && (
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(service)}
                          aria-label={`Editar serviço ${service.name}`}
                          data-tour="services-item-edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={service.is_active}
                          onCheckedChange={() => toggleActive(service)}
                          data-tour="services-item-toggle-active"
                        />
                      </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
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
