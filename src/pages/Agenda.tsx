import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Plus, ChevronLeft, ChevronRight, Clock, User, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import type { Appointment, Client, Service, Profile, AppointmentStatus } from "@/types/database";

export default function Agenda() {
  const { profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    client_id: "",
    service_id: "",
    professional_id: "",
    scheduled_at: "",
    scheduled_time: "",
    notes: "",
    status: "pending" as AppointmentStatus,
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchData();
    }
  }, [profile?.tenant_id, currentDate, viewMode]);

  const fetchData = async () => {
    if (!profile?.tenant_id) return;

    let start: Date, end: Date;
    if (viewMode === "day") {
      start = startOfDay(currentDate);
      end = endOfDay(currentDate);
    } else {
      start = startOfWeek(currentDate, { weekStartsOn: 1 });
      end = endOfWeek(currentDate, { weekStartsOn: 1 });
    }

    try {
      const [appointmentsRes, clientsRes, servicesRes, professionalsRes] = await Promise.all([
        supabase
          .from("appointments")
          .select(`
            *,
            client:clients(id, name, phone),
            service:services(id, name, duration_minutes, price),
            professional:profiles(id, full_name)
          `)
          .eq("tenant_id", profile.tenant_id)
          .gte("scheduled_at", start.toISOString())
          .lte("scheduled_at", end.toISOString())
          .order("scheduled_at", { ascending: true }),
        supabase
          .from("clients")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("name"),
        supabase
          .from("services")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
        supabase
          .from("profiles")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
      ]);

      setAppointments((appointmentsRes.data as Appointment[]) || []);
      setClients((clientsRes.data as Client[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setProfessionals((professionalsRes.data as Profile[]) || []);
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setIsSaving(true);

    try {
      const selectedService = services.find((s) => s.id === formData.service_id);
      const scheduledAt = new Date(`${formData.scheduled_at}T${formData.scheduled_time}`);

      const { error } = await supabase.from("appointments").insert({
        tenant_id: profile.tenant_id,
        client_id: formData.client_id || null,
        service_id: formData.service_id || null,
        professional_id: formData.professional_id || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: selectedService?.duration_minutes || 30,
        price: selectedService?.price || 0,
        status: formData.status,
        notes: formData.notes || null,
      });

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      setIsDialogOpen(false);
      setFormData({
        client_id: "",
        service_id: "",
        professional_id: "",
        scheduled_at: "",
        scheduled_time: "",
        notes: "",
        status: "pending",
      });
      fetchData();
    } catch (error) {
      toast.error("Erro ao criar agendamento");
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const updateAppointmentStatus = async (id: string, status: AppointmentStatus) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id);

      if (error) throw error;

      toast.success("Status atualizado!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: "bg-warning/20 text-warning border-warning/30",
      confirmed: "bg-info/20 text-info border-info/30",
      completed: "bg-success/20 text-success border-success/30",
      cancelled: "bg-destructive/20 text-destructive border-destructive/30",
    };
    const labels = {
      pending: "Pendente",
      confirmed: "Confirmado",
      completed: "Concluído",
      cancelled: "Cancelado",
    };
    return (
      <Badge variant="outline" className={styles[status as keyof typeof styles]}>
        {labels[status as keyof typeof labels]}
      </Badge>
    );
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getAppointmentsForDay = (date: Date) => {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.scheduled_at), date)
    );
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  return (
    <MainLayout
      title="Agenda"
      subtitle="Gerencie os agendamentos do salão"
      actions={
        <div className="flex items-center gap-3">
          <div className="flex items-center rounded-lg border bg-card">
            <Button
              variant={viewMode === "day" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("day")}
              className={viewMode === "day" ? "gradient-primary text-primary-foreground" : ""}
            >
              Dia
            </Button>
            <Button
              variant={viewMode === "week" ? "default" : "ghost"}
              size="sm"
              onClick={() => setViewMode("week")}
              className={viewMode === "week" ? "gradient-primary text-primary-foreground" : ""}
            >
              Semana
            </Button>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gradient-primary text-primary-foreground">
                <Plus className="mr-2 h-4 w-4" />
                Novo Agendamento
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Novo Agendamento</DialogTitle>
                <DialogDescription>
                  Preencha os dados do agendamento
                </DialogDescription>
              </DialogHeader>
              <form onSubmit={handleCreateAppointment}>
                <div className="grid gap-4 py-4">
                  <div className="space-y-2">
                    <Label>Cliente</Label>
                    <Select
                      value={formData.client_id}
                      onValueChange={(v) => setFormData({ ...formData, client_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o cliente" />
                      </SelectTrigger>
                      <SelectContent>
                        {clients.map((client) => (
                          <SelectItem key={client.id} value={client.id}>
                            {client.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Serviço</Label>
                    <Select
                      value={formData.service_id}
                      onValueChange={(v) => setFormData({ ...formData, service_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o serviço" />
                      </SelectTrigger>
                      <SelectContent>
                        {services.map((service) => (
                          <SelectItem key={service.id} value={service.id}>
                            {service.name} - {formatCurrency(service.price)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Profissional</Label>
                    <Select
                      value={formData.professional_id}
                      onValueChange={(v) => setFormData({ ...formData, professional_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Selecione o profissional" />
                      </SelectTrigger>
                      <SelectContent>
                        {professionals.map((prof) => (
                          <SelectItem key={prof.id} value={prof.id}>
                            {prof.full_name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Data</Label>
                      <Input
                        type="date"
                        value={formData.scheduled_at}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduled_at: e.target.value })
                        }
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Horário</Label>
                      <Input
                        type="time"
                        value={formData.scheduled_time}
                        onChange={(e) =>
                          setFormData({ ...formData, scheduled_time: e.target.value })
                        }
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Observações</Label>
                    <Textarea
                      value={formData.notes}
                      onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                      placeholder="Observações opcionais..."
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
                    ) : (
                      "Criar Agendamento"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      {/* Navigation */}
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, viewMode === "day" ? -1 : -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold">
            {viewMode === "day"
              ? format(currentDate, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR })
              : `${format(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM", { locale: ptBR })} - ${format(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM yyyy", { locale: ptBR })}`}
          </h2>
          <Button variant="outline" size="icon" onClick={() => setCurrentDate(addDays(currentDate, viewMode === "day" ? 1 : 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" onClick={() => setCurrentDate(new Date())}>
          Hoje
        </Button>
      </div>

      {/* Calendar View */}
      {viewMode === "week" ? (
        <div className="grid gap-4 md:grid-cols-7">
          {getWeekDays().map((day) => {
            const dayAppointments = getAppointmentsForDay(day);
            const isToday = isSameDay(day, new Date());
            return (
              <Card key={day.toISOString()} className={isToday ? "ring-2 ring-primary" : ""}>
                <CardHeader className="p-3">
                  <CardTitle className="text-center text-sm">
                    <span className="block text-muted-foreground">
                      {format(day, "EEE", { locale: ptBR })}
                    </span>
                    <span className={`text-2xl ${isToday ? "text-primary" : ""}`}>
                      {format(day, "d")}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="max-h-96 space-y-2 overflow-y-auto p-2">
                  {dayAppointments.length === 0 ? (
                    <p className="py-4 text-center text-xs text-muted-foreground">
                      Sem agendamentos
                    </p>
                  ) : (
                    dayAppointments.map((apt) => (
                      <div
                        key={apt.id}
                        className="rounded-lg border bg-card p-2 text-xs transition-colors hover:bg-muted/50"
                      >
                        <div className="mb-1 flex items-center gap-1 font-medium">
                          <Clock className="h-3 w-3" />
                          {format(new Date(apt.scheduled_at), "HH:mm")}
                        </div>
                        <p className="truncate font-medium">{apt.client?.name || "—"}</p>
                        <p className="truncate text-muted-foreground">
                          {apt.service?.name || "—"}
                        </p>
                        <div className="mt-2">{getStatusBadge(apt.status)}</div>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : (
        <div className="space-y-4">
          {appointments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-muted-foreground">Nenhum agendamento para este dia</p>
              </CardContent>
            </Card>
          ) : (
            appointments.map((apt) => (
              <Card key={apt.id}>
                <CardContent className="flex items-center justify-between p-4">
                  <div className="flex items-center gap-4">
                    <div className="flex h-14 w-14 flex-col items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <span className="text-lg font-bold">
                        {format(new Date(apt.scheduled_at), "HH:mm")}
                      </span>
                    </div>
                    <div>
                      <p className="font-semibold">{apt.client?.name || "Cliente não informado"}</p>
                      <p className="text-sm text-muted-foreground">
                        {apt.service?.name} • {apt.service?.duration_minutes || apt.duration_minutes} min
                      </p>
                      <p className="text-sm text-muted-foreground">
                        <User className="mr-1 inline h-3 w-3" />
                        {apt.professional?.full_name || "Profissional não informado"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <p className="font-semibold">{formatCurrency(apt.price)}</p>
                    <Select
                      value={apt.status}
                      onValueChange={(v) => updateAppointmentStatus(apt.id, v as AppointmentStatus)}
                    >
                      <SelectTrigger className="w-36">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">Pendente</SelectItem>
                        <SelectItem value="confirmed">Confirmado</SelectItem>
                        <SelectItem value="completed">Concluído</SelectItem>
                        <SelectItem value="cancelled">Cancelado</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      )}
    </MainLayout>
  );
}
