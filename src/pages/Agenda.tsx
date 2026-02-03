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
import { Plus, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";
import { format, addDays, startOfWeek, endOfWeek, startOfDay, endOfDay, isSameDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { toast } from "sonner";
import { AgendaFilters } from "@/components/agenda/AgendaFilters";
import { TimeSlotPicker } from "@/components/agenda/TimeSlotPicker";
import { AppointmentsTable, type EditAppointmentData } from "@/components/agenda/AppointmentsTable";
import type { Appointment, Client, Service, Profile, AppointmentStatus, Product } from "@/types/database";

export default function Agenda() {
  const { profile, isAdmin } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<"day" | "week">("week");
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [allAppointments, setAllAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
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
    commission_amount: "",
  });
  const [professionalCommissions, setProfessionalCommissions] = useState<Record<string, { type: "percentage" | "fixed"; value: number }>>({});

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
      const [commissionsRes, appointmentsRes, clientsRes, servicesRes, professionalsRes, productsRes] = await Promise.all([
        supabase
          .from("professional_commissions")
          .select("user_id, type, value")
          .eq("tenant_id", profile.tenant_id),
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
        supabase
          .from("products")
          .select("id, name, sale_price, quantity, is_active")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true)
          .order("name"),
      ]);

      const professionals = (professionalsRes.data as Profile[]) || [];
      const commissionsData = commissionsRes.data || [];

      // Mapa por profile.id (id do profissional no select) para reconhecer comissão definida na Equipe
      const commissionsMap: Record<string, { type: "percentage" | "fixed"; value: number }> = {};
      professionals.forEach((prof) => {
        const commission = commissionsData.find((c: { user_id: string }) => c.user_id === prof.user_id);
        if (commission) {
          commissionsMap[prof.id] = { type: commission.type, value: Number(commission.value) };
        }
      });
      setProfessionalCommissions(commissionsMap);

      setAppointments((appointmentsRes.data as Appointment[]) || []);
      setAllAppointments((appointmentsRes.data as Appointment[]) || []);
      setClients((clientsRes.data as Client[]) || []);
      setServices((servicesRes.data as Service[]) || []);
      setProfessionals(professionals);
      setProducts(((productsRes.data as Product[]) || []).filter((product) => product.is_active));
    } catch (error) {
      console.error("Error fetching data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Buscar todos agendamentos do dia selecionado para validação de conflitos
  const fetchAppointmentsForConflictCheck = async (date: string) => {
    if (!profile?.tenant_id || !date) return;

    const dayStart = startOfDay(new Date(date));
    const dayEnd = endOfDay(new Date(date));

    const { data } = await supabase
      .from("appointments")
      .select(`
        *,
        professional:profiles(id, full_name)
      `)
      .eq("tenant_id", profile.tenant_id)
      .gte("scheduled_at", dayStart.toISOString())
      .lte("scheduled_at", dayEnd.toISOString())
      .neq("status", "cancelled");

    setAllAppointments((data as Appointment[]) || []);
  };

  // Quando a data do formulário muda, buscar agendamentos para verificação de conflitos
  useEffect(() => {
    if (formData.scheduled_at) {
      fetchAppointmentsForConflictCheck(formData.scheduled_at);
    }
  }, [formData.scheduled_at, profile?.tenant_id]);

  // Verificar conflito de horário
  const checkConflict = (professionalId: string, scheduledAt: Date, durationMinutes: number) => {
    const endTime = new Date(scheduledAt.getTime() + durationMinutes * 60000);

    return allAppointments.some((apt) => {
      if (apt.professional_id !== professionalId) return false;
      if (apt.status === "cancelled") return false;

      const aptStart = new Date(apt.scheduled_at);
      const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);

      return scheduledAt < aptEnd && endTime > aptStart;
    });
  };

  const handleCreateAppointment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    setIsSaving(true);

    try {
      const selectedService = services.find((s) => s.id === formData.service_id);
      const scheduledAt = new Date(`${formData.scheduled_at}T${formData.scheduled_time}`);
      const durationMinutes = selectedService?.duration_minutes || 45;

      // Verificar conflito antes de criar
      if (formData.professional_id && checkConflict(formData.professional_id, scheduledAt, durationMinutes)) {
        toast.error("Conflito de horário! Este profissional já tem agendamento neste período.");
        setIsSaving(false);
        return;
      }

      // Calcular comissão se profissional e serviço foram selecionados (apenas para admins)
      let commissionAmount: number | null = null;
      if (isAdmin && formData.professional_id && selectedService && formData.commission_amount) {
        const commissionValue = parseFloat(formData.commission_amount);
        if (!isNaN(commissionValue) && commissionValue >= 0) {
          commissionAmount = commissionValue;
        }
      }

      const { error } = await supabase.from("appointments").insert({
        tenant_id: profile.tenant_id,
        client_id: formData.client_id || null,
        service_id: formData.service_id || null,
        professional_id: formData.professional_id || null,
        scheduled_at: scheduledAt.toISOString(),
        duration_minutes: durationMinutes,
        price: selectedService?.price || 0,
        commission_amount: commissionAmount,
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
        commission_amount: "",
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
      const { error, data } = await supabase
        .from("appointments")
        .update({ status })
        .eq("id", id)
        .select();

      if (error) {
        console.error("Error updating appointment status:", error);
        toast.error(`Erro ao atualizar status: ${error.message}`);
        return;
      }

      const statusMessages = {
        pending: "Agendamento marcado como pendente",
        confirmed: "Agendamento confirmado!",
        completed: "Agendamento concluído! Receita registrada.",
        cancelled: "Agendamento cancelado",
      };

      toast.success(statusMessages[status]);
      fetchData();
    } catch (error: any) {
      console.error("Exception updating appointment status:", error);
      toast.error(`Erro ao atualizar status: ${error?.message || "Erro desconhecido"}`);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const editAppointment = async (id: string, data: EditAppointmentData) => {
    try {
      const selectedService = services.find((s) => s.id === data.service_id);
      
      const { error } = await supabase
        .from("appointments")
        .update({
          client_id: data.client_id,
          service_id: data.service_id,
          professional_id: data.professional_id,
          scheduled_at: data.scheduled_at,
          notes: data.notes,
          price: selectedService?.price || 0,
          duration_minutes: selectedService?.duration_minutes || 45,
          commission_amount: data.commission_amount !== undefined && data.commission_amount !== null 
            ? (typeof data.commission_amount === "string" ? parseFloat(data.commission_amount) : data.commission_amount)
            : null,
        })
        .eq("id", id);

      if (error) throw error;

      toast.success("Agendamento atualizado com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao atualizar agendamento");
      console.error(error);
    }
  };

  const deleteAppointment = async (id: string) => {
    try {
      const { error } = await supabase
        .from("appointments")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Agendamento excluído com sucesso!");
      fetchData();
    } catch (error) {
      toast.error("Erro ao excluir agendamento");
      console.error(error);
    }
  };

  const handleCompleteAppointment = async (
    appointment: Appointment,
    sale?: { productId: string; quantity: number }
  ) => {
    if (!profile?.tenant_id) return;

    try {
      if (sale) {
        const product = products.find((p) => p.id === sale.productId);
        if (!product) {
          toast.error("Produto selecionado não encontrado.");
          throw new Error("Produto não encontrado");
        }

        if (product.quantity < sale.quantity) {
          toast.error("Estoque insuficiente para o produto selecionado.");
          throw new Error("Estoque insuficiente");
        }

        const saleAmount = Number(product.sale_price || 0) * sale.quantity;
        const transactionDate = formatInAppTz(new Date(), "yyyy-MM-dd");
        const appointmentData: any = appointment;
        const serviceName: string | undefined = appointmentData?.service?.name;
        const clientName: string | undefined = appointmentData?.client?.name;

        const { error: stockError } = await supabase.from("stock_movements").insert({
          tenant_id: profile.tenant_id,
          product_id: sale.productId,
          quantity: -sale.quantity,
          movement_type: "out",
          reason: serviceName
            ? `Venda durante o serviço ${serviceName}`
            : "Venda durante atendimento",
          out_reason_type: "sale",
          created_by: profile.id,
        });
        if (stockError) throw stockError;

        const { error: updateProductError } = await supabase
          .from("products")
          .update({ quantity: product.quantity - sale.quantity })
          .eq("id", sale.productId);
        if (updateProductError) throw updateProductError;

        setProducts((prev) =>
          prev.map((p) =>
            p.id === product.id
              ? { ...p, quantity: Math.max(0, p.quantity - sale.quantity) }
              : p
          )
        );

        const descriptionParts: string[] = [
          `Venda de ${product.name}`,
          `(${sale.quantity} un.)`,
        ];
        if (serviceName) {
          descriptionParts.push(`Serviço: ${serviceName}`);
        }
        if (clientName) {
          descriptionParts.push(`Cliente: ${clientName}`);
        }

        const { error: financialError } = await supabase.from("financial_transactions").insert({
          tenant_id: profile.tenant_id,
          type: "income",
          category: "Venda de Produto",
          amount: saleAmount,
          description: descriptionParts.join(" · "),
          transaction_date: transactionDate,
          product_id: sale.productId,
          appointment_id: appointment.id,
        });
        if (financialError) throw financialError;
      }

      const { error: appointmentError } = await supabase
        .from("appointments")
        .update({ status: "completed" })
        .eq("id", appointment.id);
      if (appointmentError) throw appointmentError;

      toast.success(
        sale ? "Agendamento concluído e venda registrada!" : "Agendamento concluído!"
      );
      fetchData();
    } catch (error: any) {
      console.error("Error completing appointment:", error);
      if (!error?.message?.includes("Estoque insuficiente") && !error?.message?.includes("Produto não encontrado")) {
        toast.error("Erro ao concluir agendamento.");
      }
      throw error;
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

  const getAppointmentsCountForDay = (date: Date) => {
    return filteredAppointments.filter((apt) =>
      isSameDay(new Date(apt.scheduled_at), date)
    ).length;
  };

  return (
    <MainLayout
      title="Agenda"
      subtitle="Gerencie os agendamentos do salão"
      actions={
        <div className="flex items-center gap-2 md:gap-3 flex-wrap justify-center sm:justify-end">
          <div className="flex items-center rounded-lg border border-border bg-card text-foreground">
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
              <Button className="gradient-primary text-primary-foreground text-sm">
                <Plus className="mr-1 md:mr-2 h-4 w-4" />
                <span className="hidden sm:inline">Novo Agendamento</span>
                <span className="sm:hidden">Novo</span>
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
                      onValueChange={(v) => {
                        const selectedService = services.find((s) => s.id === v);
                        let calculatedCommission = "";
                        // Reconhecer valor da Equipe: se profissional tem comissão definida, preencher; senão deixar em branco
                        const commission = formData.professional_id ? professionalCommissions[formData.professional_id] : undefined;
                        if (commission && selectedService) {
                          if (commission.type === "percentage") {
                            calculatedCommission = String((selectedService.price * commission.value) / 100);
                          } else {
                            calculatedCommission = String(commission.value);
                          }
                        }
                        setFormData({ 
                          ...formData, 
                          service_id: v,
                          commission_amount: calculatedCommission
                        });
                      }}
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
                      onValueChange={(v) => {
                        const selectedService = services.find((s) => s.id === formData.service_id);
                        let calculatedCommission = "";
                        
                        // Reconhecer valor da Equipe: se profissional tem comissão/valor fixo definido, preencher; senão deixar em branco
                        if (isAdmin) {
                          const commission = professionalCommissions[v];
                          if (commission && selectedService) {
                            if (commission.type === "percentage") {
                              calculatedCommission = String((selectedService.price * commission.value) / 100);
                            } else {
                              calculatedCommission = String(commission.value);
                            }
                          }
                        }
                        
                        setFormData({ 
                          ...formData, 
                          professional_id: v,
                          commission_amount: calculatedCommission
                        });
                      }}
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
                  {isAdmin && formData.professional_id && formData.service_id && (
                    <div className="space-y-2">
                      <Label>Comissão do Profissional (R$)</Label>
                      <Input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.commission_amount}
                        onChange={(e) => setFormData({ ...formData, commission_amount: e.target.value })}
                        placeholder={
                          professionalCommissions[formData.professional_id]
                            ? "Valor em R$ (edite se necessário)"
                            : "Informe o valor em R$ para este agendamento"
                        }
                      />
                      <p className="text-xs text-muted-foreground">
                        {(() => {
                          const selectedService = services.find((s) => s.id === formData.service_id);
                          const commission = professionalCommissions[formData.professional_id];
                          if (commission && selectedService) {
                            if (commission.type === "percentage") {
                              const calculated = (selectedService.price * commission.value) / 100;
                              return `Padrão da Equipe: comissão de ${commission.value}% do serviço = ${formatCurrency(calculated)}. Pode editar o valor acima.`;
                            } else {
                              return `Padrão da Equipe: valor fixo ${formatCurrency(commission.value)}. Pode editar o valor acima.`;
                            }
                          }
                          return "Este profissional ainda não tem comissão definida na Equipe. Informe o valor em R$ para este agendamento.";
                        })()}
                      </p>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={formData.scheduled_at}
                      onChange={(e) =>
                        setFormData({ ...formData, scheduled_at: e.target.value, scheduled_time: "" })
                      }
                      required
                    />
                  </div>
                  
                  {formData.scheduled_at && (
                    <TimeSlotPicker
                      selectedTime={formData.scheduled_time}
                      onTimeChange={(time) => setFormData({ ...formData, scheduled_time: time })}
                      selectedDate={formData.scheduled_at}
                      selectedProfessional={formData.professional_id}
                      professionals={professionals}
                      existingAppointments={allAppointments}
                      onProfessionalChange={(profId) => setFormData({ ...formData, professional_id: profId })}
                    />
                  )}
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
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row items-center justify-between gap-3 md:gap-4">
        <div className="flex items-center gap-2 md:gap-4">
          <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => setCurrentDate(addDays(currentDate, viewMode === "day" ? -1 : -7))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-sm md:text-lg font-semibold text-center min-w-0 text-foreground">
            {viewMode === "day"
              ? formatInAppTz(currentDate, "EEE, d 'de' MMM")
              : `${formatInAppTz(startOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")} - ${formatInAppTz(endOfWeek(currentDate, { weekStartsOn: 1 }), "d MMM")}`}
          </h2>
          <Button variant="outline" size="icon" className="h-8 w-8 md:h-10 md:w-10" onClick={() => setCurrentDate(addDays(currentDate, viewMode === "day" ? 1 : 7))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
        <Button variant="outline" size="sm" onClick={() => setCurrentDate(new Date())}>
          Hoje
        </Button>
      </div>

      {/* Week Overview - Mini Calendar */}
      {viewMode === "week" && (
        <div className="mb-4 md:mb-6 grid grid-cols-7 gap-1 md:gap-2">
          {getWeekDays().map((day) => {
            const count = getAppointmentsCountForDay(day);
            const isToday = isSameDay(day, new Date());
            const isSelected = isSameDay(day, currentDate);
            return (
              <button
                key={day.toISOString()}
                onClick={() => {
                  setCurrentDate(day);
                  setViewMode("day");
                }}
                className={`
                  flex flex-col items-center rounded-lg border p-1.5 md:p-3 transition-all hover:border-primary/50 hover:bg-accent
                  ${isToday ? "ring-2 ring-primary" : ""}
                  ${isSelected ? "bg-primary/10 border-primary" : "bg-card"}
                `}
              >
                <span className="text-[10px] md:text-xs text-muted-foreground capitalize">
                  {formatInAppTz(day, "EEE").slice(0, 3)}
                </span>
                <span className={`text-sm md:text-xl font-bold text-foreground ${isToday ? "text-primary" : ""}`}>
                  {formatInAppTz(day, "d")}
                </span>
                {count > 0 && (
                  <span className="mt-0.5 md:mt-1 rounded-full bg-primary/20 px-1 md:px-2 py-0.5 text-[10px] md:text-xs font-medium text-primary">
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

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

      {/* Appointments Table */}
      <Card className="border-border text-foreground">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">
            Agendamentos
            {viewMode === "day" && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                {formatInAppTz(currentDate, "dd 'de' MMMM")}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <AppointmentsTable
            appointments={filteredAppointments}
            clients={clients}
            services={services}
            professionals={professionals}
            allAppointments={allAppointments}
            onStatusChange={updateAppointmentStatus}
            onComplete={handleCompleteAppointment}
            onEdit={editAppointment}
            onDelete={deleteAppointment}
            isLoading={isLoading}
            isAdmin={isAdmin}
            products={products}
          />
        </CardContent>
      </Card>
    </MainLayout>
  );
}
