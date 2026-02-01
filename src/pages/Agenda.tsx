import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus, ChevronLeft, ChevronRight, Clock, Loader2, CalendarDays } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { AppointmentCard } from "@/components/agenda/AppointmentCard";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
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

  // Filters
  const [statusFilter, setStatusFilter] = useState<AppointmentStatus | "all">("all");
  const [professionalFilter, setProfessionalFilter] = useState<string>("all");

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

      const statusMessages = {
        pending: "Agendamento marcado como pendente",
        confirmed: "Agendamento confirmado!",
        completed: "Agendamento concluído! Receita registrada.",
        cancelled: "Agendamento cancelado",
      };

      toast.success(statusMessages[status]);
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  // Memoized filtered appointments
  const filteredAppointments = useMemo(() => {
    return appointments.filter((apt) => {
      const matchesStatus = statusFilter === "all" || apt.status === statusFilter;
      const matchesProfessional =
        professionalFilter === "all" || apt.professional_id === professionalFilter;
      return matchesStatus && matchesProfessional;
    });
  }, [appointments, statusFilter, professionalFilter]);

  // Appointment counts for filter badges
  const appointmentCounts = useMemo(() => {
    const counts = {
      total: appointments.length,
      pending: 0,
      confirmed: 0,
      completed: 0,
      cancelled: 0,
    };
    appointments.forEach((apt) => {
      counts[apt.status as keyof typeof counts]++;
    });
    return counts;
  }, [appointments]);

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getAppointmentsForDay = (date: Date) => {
    return filteredAppointments.filter((apt) =>
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
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
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

      {/* Filters */}
      <div className="mb-6">
        <AgendaFilters
          statusFilter={statusFilter}
          onStatusFilterChange={setStatusFilter}
          professionalFilter={professionalFilter}
          onProfessionalFilterChange={setProfessionalFilter}
          professionals={professionals}
          appointmentCounts={appointmentCounts}
        />
      </div>

      {/* Loading state */}
      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* Week View */}
          {viewMode === "week" ? (
            <div className="grid gap-4 md:grid-cols-7">
              {getWeekDays().map((day) => {
                const dayAppointments = getAppointmentsForDay(day);
                const isToday = isSameDay(day, new Date());
                return (
                  <Card key={day.toISOString()} className={isToday ? "ring-2 ring-primary" : ""}>
                    <CardHeader className="p-3">
                      <CardTitle className="text-center text-sm">
                        <span className="block text-muted-foreground capitalize">
                          {format(day, "EEE", { locale: ptBR })}
                        </span>
                        <span className={`text-2xl ${isToday ? "text-primary font-bold" : ""}`}>
                          {format(day, "d")}
                        </span>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="max-h-[400px] space-y-2 overflow-y-auto p-2">
                      {dayAppointments.length === 0 ? (
                        <p className="py-4 text-center text-xs text-muted-foreground">
                          Sem agendamentos
                        </p>
                      ) : (
                        dayAppointments.map((apt) => (
                          <AppointmentCard
                            key={apt.id}
                            appointment={apt}
                            onStatusChange={updateAppointmentStatus}
                            compact
                          />
                        ))
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            /* Day View */
            <div className="space-y-4">
              {filteredAppointments.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center justify-center py-12">
                    <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/50" />
                    <p className="text-lg font-medium text-muted-foreground">
                      Nenhum agendamento encontrado
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {statusFilter !== "all"
                        ? "Tente ajustar os filtros ou crie um novo agendamento"
                        : "Clique em 'Novo Agendamento' para começar"}
                    </p>
                  </CardContent>
                </Card>
              ) : (
                filteredAppointments.map((apt) => (
                  <AppointmentCard
                    key={apt.id}
                    appointment={apt}
                    onStatusChange={updateAppointmentStatus}
                  />
                ))
              )}
            </div>
          )}
        </>
      )}
    </MainLayout>
  );
}
