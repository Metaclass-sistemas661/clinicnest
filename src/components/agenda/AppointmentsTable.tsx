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
import { ConfirmDeleteDialog } from "@/components/ui/confirm-delete-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
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
  Stethoscope,
  Phone,
  CalendarDays,
  ClipboardList,
  UserCheck,
  DollarSign,
  ShieldCheck,
} from "lucide-react";
import { format } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { formatCurrency } from "@/lib/formatCurrency";
import type { Appointment, AppointmentStatus, Patient, Procedure, Profile, Product, InsurancePlan, ConsultationType } from "@/types/database";
import { supabase } from "@/integrations/supabase/client";
import { TimeSlotPicker } from "./TimeSlotPicker";
import { NoCommissionWarningDialog } from "./NoCommissionWarningDialog";
import { RegisterPaymentDialog } from "./RegisterPaymentDialog";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { useGamificationEnabled } from "@/hooks/useGamificationEnabled";
import { AiNoShowBadge, AiCancelPrediction } from "@/components/ai";

interface AppointmentsTableProps {
  appointments: Appointment[];
  clients: Client[];
  procedures: Procedure[];
  professionals: Profile[];
  allAppointments: Appointment[];
  insurancePlans?: InsurancePlan[];
  onStatusChange: (id: string, status: AppointmentStatus) => Promise<void>;
  onComplete: (
    appointment: Appointment,
    sale?: { productId: string; quantity: number }
  ) => Promise<
    | { type: "no_commission" }
    | { type: "goal_motivation" }
    | undefined
  >;
  onEdit: (id: string, data: EditAppointmentData) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isLoading?: boolean;
  isAdmin?: boolean;
  products: Product[];
  currentProfileId?: string;
  onStartConsultation?: (appointment: Appointment) => void;
}

export interface EditAppointmentData {
  patient_id: string | null;
  procedure_id: string | null;
  professional_id: string | null;
  scheduled_at: string;
  notes: string | null;
  telemedicine: boolean;
  consultation_type: string | null;
  insurance_plan_id: string | null;
  insurance_authorization: string | null;
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
  arrived: {
    label: "Chegou",
    className: "bg-violet-500/20 text-violet-600 border-violet-500/30",
    icon: UserCheck,
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
  procedures,
  professionals,
  allAppointments,
  insurancePlans = [],
  onStatusChange,
  onComplete,
  onEdit,
  onDelete,
  isLoading,
  isAdmin = false,
  products,
  currentProfileId,
  onStartConsultation,
}: AppointmentsTableProps) {
  const gamificationEnabled = useGamificationEnabled();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [appointmentToDelete, setAppointmentToDelete] = useState<Appointment | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [appointmentToEdit, setAppointmentToEdit] = useState<Appointment | null>(null);
  const [editFormData, setEditFormData] = useState({
    patient_id: "",
    procedure_id: "",
    professional_id: "",
    scheduled_at: "",
    scheduled_time: "",
    notes: "",
    telemedicine: false,
    consultation_type: "primeira" as string,
    insurance_plan_id: "",
    insurance_authorization: "",
  });
  const [isSaving, setIsSaving] = useState(false);
  const [completeDialogOpen, setCompleteDialogOpen] = useState(false);
  const [appointmentToComplete, setAppointmentToComplete] = useState<Appointment | null>(null);
  const [saleOption, setSaleOption] = useState<"no" | "yes">("no");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [saleQuantity, setSaleQuantity] = useState("1");
  const [isCompleting, setIsCompleting] = useState(false);
  const [noCommissionDialogOpen, setNoCommissionDialogOpen] = useState(false);
  const [missingRecordWarning, setMissingRecordWarning] = useState(false);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [appointmentForPayment, setAppointmentForPayment] = useState<Appointment | null>(null);

  const availableProducts = products.filter((product) => product.quantity > 0);

  const resetCompleteDialog = () => {
    setCompleteDialogOpen(false);
    setAppointmentToComplete(null);
    setSaleOption("no");
    setSelectedProductId("");
    setSaleQuantity("1");
  };

  const openCompleteDialog = async (appointment: Appointment) => {
    const defaultProductId = availableProducts[0]?.id ?? "";
    setAppointmentToComplete(appointment);
    setSaleOption("no");
    setSelectedProductId(defaultProductId);
    setSaleQuantity("1");
    setMissingRecordWarning(false);

    if (appointment.id) {
      try {
        const { count } = await supabase
          .from("medical_records")
          .select("id", { count: "exact", head: true })
          .eq("appointment_id", appointment.id);
        if ((count ?? 0) === 0) {
          setMissingRecordWarning(true);
        }
      } catch {
        // silently ignore — don't block the flow
      }
    }

    setCompleteDialogOpen(true);
  };

  const handleStatusChange = async (appointment: Appointment, status: AppointmentStatus) => {
    if (status === "completed") {
      openCompleteDialog(appointment);
      return;
    }

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
      patient_id: appointment.patient_id || "",
      procedure_id: appointment.procedure_id || "",
      professional_id: !isAdmin && currentProfileId ? currentProfileId : (appointment.professional_id || ""),
      scheduled_at: format(scheduledDate, "yyyy-MM-dd"),
      scheduled_time: format(scheduledDate, "HH:mm"),
      notes: appointment.notes || "",
      telemedicine: Boolean(appointment.telemedicine),
      consultation_type: appointment.consultation_type || "primeira",
      insurance_plan_id: appointment.insurance_plan_id || "",
      insurance_authorization: appointment.insurance_authorization || "",
    });
    setEditDialogOpen(true);
  };

  const handleEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentToEdit) return;

    setIsSaving(true);
    try {
      const scheduledAt = new Date(`${editFormData.scheduled_at}T${editFormData.scheduled_time}`);
      
      const professionalId = !isAdmin ? (currentProfileId ?? null) : (editFormData.professional_id || null);
      await onEdit(appointmentToEdit.id, {
        patient_id: editFormData.patient_id || null,
        procedure_id: editFormData.procedure_id || null,
        professional_id: professionalId,
        scheduled_at: scheduledAt.toISOString(),
        notes: editFormData.notes || null,
        telemedicine: Boolean(editFormData.telemedicine),
        consultation_type: editFormData.consultation_type || null,
        insurance_plan_id: editFormData.insurance_plan_id || null,
        insurance_authorization: editFormData.insurance_authorization || null,
      });
      setEditDialogOpen(false);
      setAppointmentToEdit(null);
    } finally {
      setIsSaving(false);
    }
  };

  const handleCompleteConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!appointmentToComplete) return;

    let salePayload: { productId: string; quantity: number } | undefined;

    if (saleOption === "yes") {
      if (availableProducts.length === 0) {
        toast.error("Não há produtos com estoque disponível.");
        return;
      }

      if (!selectedProductId) {
        toast.error("Selecione o produto vendido.");
        return;
      }

      const quantity = parseInt(saleQuantity, 10);
      if (!Number.isInteger(quantity) || quantity <= 0) {
        toast.error("Informe uma quantidade válida.");
        return;
      }

      const product = products.find((p) => p.id === selectedProductId);
      if (!product) {
        toast.error("Produto selecionado não encontrado.");
        return;
      }

      if (product.quantity < quantity) {
        toast.error("Estoque insuficiente para o produto selecionado.");
        return;
      }

      salePayload = { productId: selectedProductId, quantity };
    }

    setUpdatingId(appointmentToComplete.id);
    setIsCompleting(true);
    try {
      const result = await onComplete(appointmentToComplete, salePayload);
      resetCompleteDialog();
      if (result && gamificationEnabled) {
        if (result.type === "goal_motivation") {
          // Popup de meta já foi mostrado via GoalMotivationContext
        } else if (result.type === "no_commission") {
          setNoCommissionDialogOpen(true);
        }
      }
    } catch (error) {
      logger.error("Error completing appointment:", error);
    } finally {
      setIsCompleting(false);
      setUpdatingId(null);
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
          Clique em 'Novo agendamento' para começar
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Mobile: Card Layout */}
      <div className="block md:hidden space-y-3 max-h-[520px] overflow-y-auto pr-1">
        {appointments.map((appointment) => {
          const status = statusConfig[appointment.status];
          const StatusIcon = status.icon;
          const isUpdating = updatingId === appointment.id;
          const _canEdit = isAdmin || appointment.professional_id === currentProfileId;

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
                      {appointment.patient?.name || "Paciente não informado"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {appointment.procedure?.name || "Procedimento não informado"}
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
                        data-tour="agenda-action-confirm"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Confirmar
                      </Button>
                    )}
                    {appointment.status === "confirmed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-violet-600 border-violet-500/30 hover:bg-violet-500/10"
                        onClick={() => handleStatusChange(appointment, "arrived")}
                      >
                        <UserCheck className="mr-1 h-4 w-4" />
                        Chegou
                      </Button>
                    )}
                    {(appointment.status === "confirmed" || appointment.status === "arrived") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-primary border-primary/30 hover:bg-primary/10"
                        onClick={() => handleStatusChange(appointment, "completed")}
                        data-tour="agenda-action-complete"
                      >
                        <CheckCircle2 className="mr-1 h-4 w-4" />
                        Concluir
                      </Button>
                    )}
                    {isAdmin && appointment.status === "completed" && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10"
                        onClick={() => {
                          setAppointmentForPayment(appointment);
                          setPaymentDialogOpen(true);
                        }}
                      >
                        <DollarSign className="mr-1 h-4 w-4" />
                        Pagamento
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditDialog(appointment)}
                      data-tour="agenda-action-edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button size="sm" variant="outline" data-tour="agenda-action-more">
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(appointment, "pending")}
                          disabled={appointment.status === "pending"}
                          data-tour="agenda-action-mark-pending"
                        >
                          <Clock className="mr-2 h-4 w-4 text-warning" />
                          Pendente
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => handleStatusChange(appointment, "cancelled")}
                          disabled={appointment.status === "cancelled"}
                          data-tour="agenda-action-cancel"
                        >
                          <XCircle className="mr-2 h-4 w-4 text-destructive" />
                          Cancelar
                        </DropdownMenuItem>
                        {isAdmin && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              onClick={() => openDeleteDialog(appointment)}
                              className="text-destructive focus:text-destructive"
                              data-tour="agenda-action-delete"
                            >
                              <Trash2 className="mr-2 h-4 w-4" />
                              Excluir
                            </DropdownMenuItem>
                          </>
                        )}
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
              <TableHead>Paciente</TableHead>
              <TableHead>Procedimento</TableHead>
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
              const canEdit = isAdmin || appointment.professional_id === currentProfileId;

              return (
                <TableRow key={appointment.id} className="group">
                  <TableCell>
                    <div className="flex flex-col">
                      <span className="text-sm font-medium">
                        {formatInAppTz(appointment.scheduled_at, "HH:mm")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatInAppTz(appointment.scheduled_at, "dd/MM/yyyy")}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    <div className="flex flex-col">
                      <span>{appointment.patient?.name || "Paciente não informado"}</span>
                      {appointment.patient?.phone && (
                        <a
                          href={`tel:${appointment.patient.phone}`}
                          className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary"
                        >
                          <Phone className="h-3 w-3" />
                          {appointment.patient.phone}
                        </a>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Stethoscope className="h-4 w-4 text-muted-foreground" />
                      <span className="text-foreground">{appointment.procedure?.name || "Não informado"}</span>
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
                    <div className="flex items-center gap-1.5">
                      <Badge variant="outline" className={status.className}>
                        <StatusIcon className="mr-1 h-3 w-3" />
                        {status.label}
                      </Badge>
                      {(appointment.status === "pending" || appointment.status === "confirmed") && (
                        <AiNoShowBadge appointmentId={appointment.id} tenantId={appointment.tenant_id} />
                      )}
                      {(appointment.status === "pending" || appointment.status === "confirmed") && (
                        <AiCancelPrediction appointmentId={appointment.id} compact />
                      )}
                    </div>
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
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-success hover:bg-success/10 hover:text-success"
                              onClick={() => handleStatusChange(appointment, "confirmed")}
                              title="Confirmar"
                              aria-label="Confirmar agendamento"
                              data-tour="agenda-action-confirm"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          {appointment.status === "confirmed" && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-violet-600 hover:bg-violet-500/10 hover:text-violet-600"
                              onClick={() => handleStatusChange(appointment, "arrived")}
                              title="Marcar chegada"
                              aria-label="Marcar chegada do paciente"
                            >
                              <UserCheck className="h-4 w-4" />
                            </Button>
                          )}
                          {appointment.status === "arrived" && (
                            <Button
                              type="button"
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-primary hover:bg-primary/10 hover:text-primary"
                              onClick={() => handleStatusChange(appointment, "completed")}
                              title="Concluir"
                              aria-label="Concluir agendamento"
                              data-tour="agenda-action-complete"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}

                          {/* More options */}
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                aria-label="Mais ações"
                                data-tour="agenda-action-more"
                              >
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              {canEdit && (
                                <DropdownMenuItem onClick={() => openEditDialog(appointment)} data-tour="agenda-action-edit">
                                  <Pencil className="mr-2 h-4 w-4" />
                                  Editar
                                </DropdownMenuItem>
                              )}
                              {canEdit && <DropdownMenuSeparator />}
                              {onStartConsultation && (appointment.status === "confirmed" || appointment.status === "pending" || appointment.status === "arrived") && (
                                <>
                                  <DropdownMenuItem
                                    onClick={() => onStartConsultation(appointment)}
                                  >
                                    <ClipboardList className="mr-2 h-4 w-4 text-primary" />
                                    Iniciar Atendimento
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                </>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "pending")}
                                disabled={appointment.status === "pending"}
                                data-tour="agenda-action-mark-pending"
                              >
                                <Clock className="mr-2 h-4 w-4 text-warning" />
                                Marcar Pendente
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "confirmed")}
                                disabled={appointment.status === "confirmed"}
                                data-tour="agenda-action-confirm"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-info" />
                                Confirmar
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "arrived")}
                                disabled={appointment.status === "arrived" || appointment.status === "completed"}
                              >
                                <UserCheck className="mr-2 h-4 w-4 text-violet-600" />
                                Chegou (Check-in)
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "completed")}
                                disabled={appointment.status !== "confirmed" && appointment.status !== "arrived"}
                                data-tour="agenda-action-complete"
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4 text-success" />
                                Concluir
                              </DropdownMenuItem>
                              {isAdmin && appointment.status === "completed" && (
                                <DropdownMenuItem
                                  onClick={() => {
                                    setAppointmentForPayment(appointment);
                                    setPaymentDialogOpen(true);
                                  }}
                                  className="text-emerald-600 focus:text-emerald-600"
                                >
                                  <DollarSign className="mr-2 h-4 w-4" />
                                  Registrar Pagamento
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={() => handleStatusChange(appointment, "cancelled")}
                                disabled={appointment.status === "cancelled"}
                                data-tour="agenda-action-cancel"
                              >
                                <XCircle className="mr-2 h-4 w-4 text-destructive" />
                                Cancelar
                              </DropdownMenuItem>
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    onClick={() => openDeleteDialog(appointment)}
                                    className="text-destructive focus:text-destructive"
                                    data-tour="agenda-action-delete"
                                  >
                                    <Trash2 className="mr-2 h-4 w-4" />
                                    Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
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

      {/* Complete Appointment Dialog */}
      <Dialog
        open={completeDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            resetCompleteDialog();
          }
        }}
      >
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Concluir agendamento</DialogTitle>
            <DialogDescription>
              Confirme a conclusão e registre possíveis vendas de produtos.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCompleteConfirm} className="space-y-4">
            {missingRecordWarning && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-500/40 dark:bg-amber-500/10">
                <ClipboardList className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <div>
                  <p className="font-medium text-amber-800 dark:text-amber-300">Prontuário não preenchido</p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-400/80">Nenhum prontuário foi registrado para esta consulta. Deseja concluir mesmo assim?</p>
                </div>
              </div>
            )}
            {appointmentToComplete && (
              <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm text-muted-foreground space-y-1">
                <p>
                  <span className="font-medium text-foreground">Paciente:</span>{" "}
                  {appointmentToComplete?.patient?.name ?? "Não informado"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Procedimento:</span>{" "}
                  {appointmentToComplete?.procedure?.name ?? "Não informado"}
                </p>
                <p>
                  <span className="font-medium text-foreground">Valor do procedimento:</span>{" "}
                  {formatCurrency(appointmentToComplete.price)}
                </p>
              </div>
            )}

            <div className="space-y-3">
              <Label>O paciente comprou algum produto?</Label>
              <RadioGroup
                value={saleOption}
                onValueChange={(value) => {
                  const option = value as "no" | "yes";
                  setSaleOption(option);
                  if (
                    option === "yes" &&
                    !selectedProductId &&
                    availableProducts.length > 0
                  ) {
                    setSelectedProductId(availableProducts[0].id);
                  }
                }}
                className="flex gap-4"
              >
                <div className="flex items-center space-x-2">
                  <RadioGroupItem value="no" id="complete-sale-no" />
                  <Label htmlFor="complete-sale-no" className="font-normal cursor-pointer">
                    Não
                  </Label>
                </div>
                <div className="flex items-center space-x-2">
                  <RadioGroupItem
                    value="yes"
                    id="complete-sale-yes"
                    disabled={availableProducts.length === 0}
                  />
                  <Label
                    htmlFor="complete-sale-yes"
                    className={`font-normal cursor-pointer ${availableProducts.length === 0 ? "text-muted-foreground/60 cursor-not-allowed" : ""}`}
                  >
                    Sim
                  </Label>
                </div>
              </RadioGroup>
              {availableProducts.length === 0 && (
                <p className="text-xs text-muted-foreground">
                  Nenhum produto com estoque disponível para venda.
                </p>
              )}
            </div>

            {saleOption === "yes" && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Produto</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o produto" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableProducts.map((product) => (
                        <SelectItem key={product.id} value={product.id}>
                          {product.name} — {formatCurrency(product.cost)} (estoque: {product.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Quantidade</Label>
                  <Input
                    type="number"
                    min="1"
                    value={saleQuantity}
                    onChange={(e) => setSaleQuantity(e.target.value)}
                  />
                </div>
              </div>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetCompleteDialog}>
                Cancelar
              </Button>
              <Button
                type="submit"
                className="gradient-primary text-primary-foreground"
                disabled={isCompleting}
                data-tour="agenda-complete-confirm"
              >
                {isCompleting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Registrando...
                  </>
                ) : (
                  "Concluir"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <ConfirmDeleteDialog
        open={deleteDialogOpen}
        onConfirm={handleDelete}
        onCancel={() => setDeleteDialogOpen(false)}
        itemName={appointmentToDelete?.patient?.name || "Paciente"}
        itemType="agendamento"
        warningText={appointmentToDelete ? `Agendamento para ${formatInAppTz(appointmentToDelete.scheduled_at, "dd/MM/yyyy 'às' HH:mm")}` : undefined}
        isDeleting={!!updatingId}
      />

      {/* Edit Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Agendamento</DialogTitle>
            <DialogDescription>
              Altere os dados do agendamento
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleEdit}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-4">
              <div className="space-y-2">
                <Label>Paciente</Label>
                <Select
                  value={editFormData.patient_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, patient_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
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
                <Label>Procedimento</Label>
                <Select
                  value={editFormData.procedure_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, procedure_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o procedimento" />
                  </SelectTrigger>
                  <SelectContent>
                    {procedures.map((service) => (
                      <SelectItem key={service.id} value={service.id}>
                        {service.name} - {formatCurrency(service.price)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Profissional</Label>
                {isAdmin ? (
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
                ) : (
                  <>
                    <Input
                      value={professionals.find((p) => p.id === currentProfileId)?.full_name ?? "Você"}
                      disabled
                      className="bg-muted"
                    />
                    <p className="text-xs text-muted-foreground">Você não pode direcionar agendamentos para outros</p>
                  </>
                )}
              </div>
              <div className="space-y-2 sm:col-span-2">
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
                <div className="sm:col-span-2">
                <TimeSlotPicker
                  selectedTime={editFormData.scheduled_time}
                  onTimeChange={(time) => setEditFormData({ ...editFormData, scheduled_time: time })}
                  selectedDate={editFormData.scheduled_at}
                  selectedProfessional={editFormData.professional_id}
                  professionals={professionals}
                  existingAppointments={allAppointments.filter(
                    (apt) => apt.id !== appointmentToEdit?.id
                  )}
                  onProfessionalChange={isAdmin ? (profId) =>
                    setEditFormData({ ...editFormData, professional_id: profId })
                  : undefined}
                />
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label>Tipo de Consulta</Label>
                <Select
                  value={editFormData.consultation_type}
                  onValueChange={(v) => setEditFormData({ ...editFormData, consultation_type: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o tipo" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="primeira">Primeira Consulta</SelectItem>
                    <SelectItem value="retorno">Retorno</SelectItem>
                    <SelectItem value="urgencia">Urgência</SelectItem>
                    <SelectItem value="procedimento">Procedimento</SelectItem>
                    <SelectItem value="exame">Exame</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>Convênio / Plano de Saúde</Label>
                <Select
                  value={editFormData.insurance_plan_id}
                  onValueChange={(v) => setEditFormData({ ...editFormData, insurance_plan_id: v === "none" ? "" : v, insurance_authorization: v === "none" ? "" : editFormData.insurance_authorization })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Particular (sem convênio)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Particular (sem convênio)</SelectItem>
                    {insurancePlans.map((plan) => (
                      <SelectItem key={plan.id} value={plan.id}>
                        {plan.name}{plan.ans_code ? ` (ANS: ${plan.ans_code})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {editFormData.insurance_plan_id && (
                <div className="space-y-2 sm:col-span-2">
                  <Label>
                    Nº Autorização do Convênio
                    {insurancePlans.find((p) => p.id === editFormData.insurance_plan_id)?.requires_authorization && (
                      <span className="text-destructive ml-1">*</span>
                    )}
                  </Label>
                  <Input
                    value={editFormData.insurance_authorization}
                    onChange={(e) => setEditFormData({ ...editFormData, insurance_authorization: e.target.value })}
                    placeholder="Número da autorização emitida pela operadora"
                    className="font-mono"
                  />
                  {insurancePlans.find((p) => p.id === editFormData.insurance_plan_id)?.requires_authorization && (
                    <div className="flex items-center gap-1.5 text-xs text-warning">
                      <ShieldCheck className="h-3.5 w-3.5" />
                      Este convênio exige autorização prévia
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label>Observações</Label>
                <Textarea
                  value={editFormData.notes}
                  onChange={(e) => setEditFormData({ ...editFormData, notes: e.target.value })}
                  placeholder="Observações opcionais..."
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <div className="flex items-center justify-between rounded-lg border border-border bg-card px-3 py-2">
                  <div className="flex flex-col">
                    <Label>Teleconsulta</Label>
                    <span className="text-xs text-muted-foreground">Atendimento remoto via vídeo</span>
                  </div>
                  <Switch
                    checked={editFormData.telemedicine}
                    onCheckedChange={(checked) => setEditFormData({ ...editFormData, telemedicine: checked })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground" data-tour="agenda-edit-save">
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Salvando...
                  </>
                ) : (
                  "Salvar alterações"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <NoCommissionWarningDialog
        open={noCommissionDialogOpen}
        onOpenChange={setNoCommissionDialogOpen}
      />

      <RegisterPaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        appointment={appointmentForPayment}
        onSuccess={() => {
          setAppointmentForPayment(null);
          toast.success("Receita gerada no financeiro!");
        }}
      />
    </>
  );
}
