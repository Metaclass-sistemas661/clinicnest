import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Scissors, Plus, Loader2, Clock, Pencil } from "lucide-react";
import { toast } from "sonner";
import type { Service } from "@/types/database";

export default function Servicos() {
  const { profile } = useAuth();
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
      console.error("Error fetching services:", error);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
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
      const serviceData = {
        tenant_id: profile.tenant_id,
        name: parsed.data.name,
        description: parsed.data.description || null,
        duration_minutes: parsed.data.duration_minutes,
        price: parsed.data.price,
        is_active: parsed.data.is_active,
      };

      if (editingService) {
        const { error } = await supabase
          .from("services")
          .update(serviceData)
          .eq("id", editingService.id);

        if (error) throw error;
        toast.success("Serviço atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("services").insert(serviceData);

        if (error) throw error;
        toast.success("Serviço cadastrado com sucesso!");
      }

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
      toast.error(editingService ? "Erro ao atualizar serviço" : "Erro ao cadastrar serviço");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (service: Service) => {
    try {
      const { error } = await supabase
        .from("services")
        .update({ is_active: !service.is_active })
        .eq("id", service.id);

      if (error) throw error;

      toast.success(service.is_active ? "Serviço desativado" : "Serviço ativado");
      fetchServices();
    } catch (error) {
      toast.error("Erro ao alterar status do serviço");
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
      title="Serviços"
      subtitle="Gerencie os serviços oferecidos"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Serviço
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingService ? "Editar Serviço" : "Novo Serviço"}</DialogTitle>
              <DialogDescription>
                {editingService
                  ? "Atualize os dados do serviço"
                  : "Cadastre um novo serviço no salão"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nome do Serviço</Label>
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Ex: Corte Feminino"
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
                <div className="flex items-center justify-between rounded-lg border p-4 sm:col-span-2">
                  <div>
                    <Label>Serviço Ativo</Label>
                    <p className="text-sm text-muted-foreground">
                      Serviços inativos não aparecem no agendamento
                    </p>
                  </div>
                  <Switch
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
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
                      Salvando...
                    </>
                  ) : editingService ? (
                    "Atualizar"
                  ) : (
                    "Cadastrar"
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
          <CardTitle>Serviços Cadastrados</CardTitle>
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
            <div className="flex flex-col items-center justify-center py-12">
              <Scissors className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">Nenhum serviço cadastrado</p>
            </div>
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
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={() => handleOpenDialog(service)} aria-label={`Editar serviço ${service.name}`}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Switch
                        checked={service.is_active}
                        onCheckedChange={() => toggleActive(service)}
                      />
                      <span className="text-xs text-muted-foreground">
                        {service.is_active ? "Ativo" : "Inativo"}
                      </span>
                    </div>
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
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(service)}
                          aria-label={`Editar serviço ${service.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Switch
                          checked={service.is_active}
                          onCheckedChange={() => toggleActive(service)}
                        />
                      </div>
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
