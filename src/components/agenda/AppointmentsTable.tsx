import { useState } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  MoreHorizontal,
  Pencil,
  Trash2,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  User,
  Scissors,
  Phone,
  CalendarDays,
} from "lucide-react";
import { format } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import type { Appointment, AppointmentStatus, Client, Service, Profile } from "@/types/database";
import { TimeSlotPicker } from "./TimeSlotPicker";

interface AppointmentsTableProps {
  appointments: Appointment[];
  clients: Client[];
  services: Service[];
  professionals: Profile[];
  allAppointments: Appointment[];
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
  onEdit: (id: string, data: EditAppointmentData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
  isAdmin?: boolean;
}

export interface EditAppointmentData {
  client_id: string | null;
  service_id: string | null;
  professional_id: string | null;
  scheduled_at: string;
  notes: string | null;
  commission_amount?: number | null;
}

const statusConfig = {
  pending: {
    label: "Pendente",
    className: "bg-warning/20 text-warning border-warning/30",
    icon: Clock,
  },
  confirmed: {
    label: "Confirmado",
    className: "bg-info/20 text-info border-info/30",
    icon: CheckCircle2,
  },
  completed: {
    label: "Concluído",
    className: "bg-success/20 text-success border-success/30",
    icon: CheckCircle2,
  },
  cancelled: {
    label: "Cancelado",
    className: "bg-destructive/20 text-destructive border-destructive/30",
    icon: XCircle,
  },
};

export function AppointmentsTable({
  appointments,
  clients,
  services,
  professionals,
  allAppointments,
  onStatusChange,
  onEdit,
  onDelete,
  isLoading,
  isAdmin = false,
}: AppointmentsTableProps) {
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [editFormData, setEditFormData] = useState({
    client_id: "",
    service_id: "",
    professional_id: "",
    scheduled_at: "",
    scheduled_time: "",
    notes: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format(value);
  };

  const handleStatusChange = async (appointment: Appointment, status: AppointmentStatus) => {
    setUpdatingId(appointment.id);
    try {
      await onStatusChange(appointment.id, status);
    } finally {
      setUpdatingId(null);
    }
  };

  const openDeleteDialog = (appointment: Appointment) => {
    setAppointmentToDelete(appointment);
    setDeleteDialogOpen(true);
  };

  const handleDelete = async () => {
    if (!appointmentToDelete) return;
    setUpdatingId(appointmentToDelete.id);
    try {
      await onDelete(appointmentToDelete.id);
    } finally {
      setUpdatingId(null);
      setDeleteDialogOpen(false);
      setAppointmentToDelete(null);
    }
  };

  const openEditDialog = (appointment: Appointment) => {
    setAppointmentToEdit(appointment);
    const scheduledDate = new Date(appointment.scheduled_at);
    setEditFormData({
      client_id: appointment.client_id || "",
      service_id: appointment.service_id || "",
      professional_id: appointment.professional_id || "",
      scheduled_at: format(scheduledDate, "yyyy-MM-dd"),
      scheduled_time: format(scheduledDate, "HH:mm"),
      notes: appointment.notes || "",
      commission_amount: (appointment as any).commission_amount 
        ? String((appointment as any).commission_amount) 
        : "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentToEdit) return;

    setIsSaving(true);
    try {
      const scheduledAt = new Date(`${editFormData.scheduled_at}T${editFormData.scheduled_time}`);
      // Apenas admins podem definir commission_amount
      let commissionAmount: number | null = null;
      if (isAdmin && editFormData.commission_amount) {
        const parsed = parseFloat(editFormData.commission_amount);
        if (!isNaN(parsed) && parsed >= 0) {
          commissionAmount = parsed;
        }
      }
      
      await onEdit(appointmentToEdit.id, {
        client_id: editFormData.client_id || null,
        service_id: editFormData.service_id || null,
        professional_id: editFormData.professional_id || null,
        scheduled_at: scheduledAt.toISOString(),
        notes: editFormData.notes || null,
        commission_amount: commissionAmount,
      });
      setEditDialogOpen(false);
      setAppointmentToEdit(null);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <div className="flex gap-2 overflow-hidden">
          <Skeleton className="h-10 flex-1 min-w-[120px]" />
          <Skeleton className="h-10 flex-1 min-w-[80px]" />
          <Skeleton className="h-10 flex-1 min-w-[100px]" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full" />
        ))}
      </div>
    );
  }

  if (appointments.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-border bg-card py-12 text-foreground">
        <CalendarDays className="mb-4 h-12 w-12 text-muted-foreground/50" />
        <p className="text-lg font-medium text-muted-foreground">
          Nenhum agendamento encontrado
        </p>
        <p className="text-sm text-muted-foreground">
          Clique em 'Novo Agendamento' para começar
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="block md:hidden space-y-3">
        {appointments.map((appointment) => {
          const status = statusConfig[appointment.status];
          const StatusIcon = status.icon;
          const isUpdating = updatingId === appointment.id;

          return (
            <div key={appointment.id} className="rounded-lg border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center rounded-lg bg-primary/10 px-3 py-1.5 text-primary">
                    <span className="text-lg font-bold">
                      {format(new Date(appointment.scheduled_at), "HH:mm")}
                    </span>
                    <span className="text-[10px]">
                      {format(new Date(appointment.scheduled_at), "dd/MM")}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">
                      {appointment.client?.name || "Cliente não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.service?.name || "Serviço não informado"}
                    </p>
                  </div>
                </div>
                <Badge variant="outline" className={`${status.className} text-xs`}>
                  <StatusIcon className="mr-1 h-3 w-3" />
                  {status.label}
                </Badge>
              </div>
              
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">
                  {appointment.professional?.full_name || "Sem profissional"}
                </span>
                <span className="font-bold text-primary">
                  {formatCurrency(appointment.price)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-border">
                {isUpdating ? (
                  <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                ) : (
                  <>
                    {appointment.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-success border-success/30 hover:bg-success/10"
                        onClick={() => handleStatusChange(appointment, "confirmed")}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Confirmar
                      </Button>
                    )}
                    {appointment.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => handleStatusChange(appointment, "completed")}
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Concluir
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(appointment)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(appointment, "pending")}
                          disabled={appointment.status === "pending"}
                        >
                          <Clock className="mr-2 h-4 w-4 text-warning" />
                          Pendente
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(appointment, "cancelled")}
                          disabled={appointment.status === "cancelled"}
                        >
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                          Cancelar
                        </DropdownMenuItem>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                          onClick={() => openDeleteDialog(appointment)}
                          className="text-destructive focus:text-destructive"
                        >
                          <Trash2 className="mr-2 h-4 w-4" />
                          Excluir
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Desktop: Table Layout */}
      <div className="hidden md:block rounded-lg border border-border bg-card text-foreground">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="w-[180px]">Data/Hora</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead>Serviço</TableHead>
              <TableHead>Profissional</TableHead>
              <TableHead className="text-right">Valor</TableHead>
              <TableHead className="w-[120px]">Status</TableHead>
              <TableHead className="w-[100px] text-center">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {appointments.map((appointment) => {
              const status = statusConfig[appointment.status];
              const StatusIcon = status.icon;
              const isUpdating = updatingId === appointment.id;

              return (
                <TableRow key={appointment.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="font-semibold text-primary">
                        {formatInAppTz(appointment.scheduled_at, "HH:mm")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatInAppTz(appointment.scheduled_at, "dd/MM/yyyy")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {appointment.duration_minutes} min
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground" />
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">
                          {appointment.client?.name || "Não informado"}
                        </span>
                        {appointment.client?.phone && (
                          <a
                            href={`tel:${appointment.client.phone}`}
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                          >
                            <Phone className="h-3 w-3" />
                            {appointment.client.phone}
                          </a>
                        )}
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Scissors className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{appointment.service?.name || "Não informado"}</span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-muted-foreground">
                      {appointment.professional?.full_name || "Não atribuído"}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-bold text-primary">
                      {formatCurrency(appointment.price)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={status.className}>
                      <StatusIcon className="mr-1 h-3 w-3" />
                      {status.label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      {isUpdating ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          {/* Quick actions */}
                          {appointment.status === "pending" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success hover:bg-success/10 hover:text-success"
                              onClick={() => handleStatusChange(appointment, "confirmed")}
                              title="Confirmar"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {appointment.status === "confirmed" && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleStatusChange(appointment, "completed")}
                              title="Concluir"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}

                          {/* More options */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button size="icon" variant="ghost" className="h-8 w-8">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEditDialog(appointment)}>
                                <Pencil className="mr-2 h-4 w-4" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "pending")}
                                disabled={appointment.status === "pending"}
                              >
                                <Clock className="mr-2 h-4 w-4 text-warning" />
                                Marcar Pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "confirmed")}
                                disabled={appointment.status === "confirmed"}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-info" />
                                Confirmar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "completed")}
                                disabled={appointment.status === "completed"}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                                Concluir
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "cancelled")}
                                disabled={appointment.status === "cancelled"}
                              >
                                <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                Cancelar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => openDeleteDialog(appointment)}
                                className="text-destructive focus:text-destructive"
                              >
                                <Trash2 className="mr-2 h-4 w-4" />
                                Excluir
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Delete Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir agendamento?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir o agendamento de{" "}
              <strong>{appointmentToDelete?.client?.name || "Cliente"}</strong> para{" "}
              <strong>
                {appointmentToDelete &&
                  formatInAppTz(appointmentToDelete.scheduled_at, "dd/MM/yyyy 'às' HH:mm")}
              </strong>
              ? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {updatingId ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere os dados do agendamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label>Cliente</Label>
                <Select
                  value={editFormData.client_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, client_id: v })}
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
                  value={editFormData.service_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, service_id: v })}
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
                  value={editFormData.professional_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, professional_id: v })}
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
              {isAdmin && editFormData.professional_id && editFormData.service_id && (
                <div className="space-y-2">
                  <Label>Comissão do Profissional (R$)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={editFormData.commission_amount}
                    onChange={(e) => setEditFormData({ ...editFormData, commission_amount: e.target.value })}
                    placeholder="Valor da comissão"
                  />
                  <p className="text-xs text-muted-foreground">
                    Valor que o profissional receberá por este serviço específico
                  </p>
                </div>
              )}
              <div className="space-y-2">
                <Label>Data</Label>
                <Input
                  type="date"
                  value={editFormData.scheduled_at}
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, scheduled_at: e.target.value, scheduled_time: "" })
                  }
                  required
                />
              </div>

              {editFormData.scheduled_at && (
                <TimeSlotPicker
                  selectedTime={editFormData.scheduled_time}
                  onTimeChange={(time) => setEditFormData({ ...editFormData, scheduled_time: time })}
                  selectedDate={editFormData.scheduled_at}
                  selectedProfessional={editFormData.professional_id}
                  professionals={professionals}
                  existingAppointments={allAppointments.filter(
                    (apt) => apt.id !== appointmentToEdit?.id
                  )}
                  onProfessionalChange={(profId) =>
                    setEditFormData({ ...editFormData, professional_id: profId })
                  }
                />
              )}

              <div className="space-y-2">
                <Label>Observações</Label>
                <Textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Observações opcionais..."
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar Alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
