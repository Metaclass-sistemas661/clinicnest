import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, addDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  CalendarClock,
  Calendar,
  CheckCircle,
  Clock,
  AlertTriangle,
  Phone,
  Mail,
  MessageSquare,
  XCircle,
  RefreshCw,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  usePendingReturns,
  useReturnStatistics,
  useUpdateReturnStatus,
  RETURN_STATUS_LABELS,
} from "@/hooks/useReturnReminders";
import { useProfessionals } from "@/hooks/useProfessionals";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "warning" | "success" | "danger";
}) {
  const variantClasses = {
    default: "bg-blue-50 text-blue-600",
    warning: "bg-yellow-50 text-yellow-600",
    success: "bg-green-50 text-green-600",
    danger: "bg-red-50 text-red-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${variantClasses[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function RetornosPendentes() {
  const navigate = useNavigate();
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [professionalFilter, setProfessionalFilter] = useState<string>("");
  const [dateRange, setDateRange] = useState({
    from: format(subDays(new Date(), 30), "yyyy-MM-dd"),
    to: format(addDays(new Date(), 90), "yyyy-MM-dd"),
  });

  const { data: returns, isLoading } = usePendingReturns(
    statusFilter || undefined,
    dateRange.from,
    dateRange.to,
    professionalFilter || undefined
  );
  const { data: stats } = useReturnStatistics();
  const { data: professionals } = useProfessionals();
  const updateStatusMutation = useUpdateReturnStatus();

  const overdueReturns = returns?.filter((r) => r.days_overdue > 0) || [];
  const upcomingReturns = returns?.filter((r) => r.days_until_return >= 0 && r.days_until_return <= 7) || [];

  const getContactIcon = (contact: string | null) => {
    switch (contact) {
      case "whatsapp":
        return <MessageSquare className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "phone":
      case "sms":
        return <Phone className="h-4 w-4" />;
      default:
        return null;
    }
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="shrink-0"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Retornos Pendentes</h1>
            <p className="text-muted-foreground">
              Acompanhamento de pacientes que precisam retornar
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <StatCard
          title="Pendentes"
          value={stats?.pending_count ?? 0}
          icon={Clock}
          description="Aguardando retorno"
          variant="warning"
        />
        <StatCard
          title="Atrasados"
          value={stats?.overdue_count ?? 0}
          icon={AlertTriangle}
          description="Passaram da data"
          variant="danger"
        />
        <StatCard
          title="Agendados"
          value={stats?.scheduled_count ?? 0}
          icon={Calendar}
          description="Com agendamento"
          variant="default"
        />
        <StatCard
          title="Concluídos"
          value={stats?.completed_count ?? 0}
          icon={CheckCircle}
          description="Retornaram"
          variant="success"
        />
        <StatCard
          title="Taxa de Retorno"
          value={stats?.completion_rate ? `${stats.completion_rate}%` : "—"}
          icon={RefreshCw}
          description="Pacientes que retornaram"
          variant={
            (stats?.completion_rate ?? 0) >= 70
              ? "success"
              : (stats?.completion_rate ?? 0) >= 50
              ? "warning"
              : "danger"
          }
        />
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-col lg:flex-row justify-between gap-4">
            <div>
              <CardTitle>Lista de Retornos</CardTitle>
              <CardDescription>
                Pacientes com retorno programado
              </CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Select value={statusFilter || "__all__"} onValueChange={(v) => setStatusFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="notified">Notificados</SelectItem>
                  <SelectItem value="scheduled">Agendados</SelectItem>
                  <SelectItem value="completed">Concluídos</SelectItem>
                  <SelectItem value="expired">Expirados</SelectItem>
                </SelectContent>
              </Select>

              <Select value={professionalFilter || "__all__"} onValueChange={(v) => setProfessionalFilter(v === "__all__" ? "" : v)}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Profissional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">Todos</SelectItem>
                  {professionals?.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Input
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                className="w-[150px]"
              />
              <Input
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                className="w-[150px]"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div class="flex items-center gap-2"><Spinner size="sm" /><span className="text-muted-foreground">Carregando...</span></div>
          ) : returns && returns.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Paciente</TableHead>
                  <TableHead>Profissional</TableHead>
                  <TableHead>Data Retorno</TableHead>
                  <TableHead>Situação</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Contato</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {returns.map((ret) => (
                  <TableRow
                    key={ret.id}
                    className={ret.days_overdue > 0 ? "bg-red-50" : undefined}
                  >
                    <TableCell>
                      <div>
                        <div className="font-medium">{ret.client_name}</div>
                        {ret.reason && (
                          <div className="text-xs text-muted-foreground">
                            {ret.reason}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{ret.professional_name || "—"}</TableCell>
                    <TableCell>
                      {format(new Date(ret.return_date), "dd/MM/yyyy")}
                    </TableCell>
                    <TableCell>
                      {ret.days_overdue > 0 ? (
                        <Badge variant="destructive">
                          {ret.days_overdue} dias atrasado
                        </Badge>
                      ) : ret.days_until_return === 0 ? (
                        <Badge variant="default">Hoje</Badge>
                      ) : ret.days_until_return <= 7 ? (
                        <Badge variant="secondary">
                          Em {ret.days_until_return} dias
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">
                          Em {ret.days_until_return} dias
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge
                        className={
                          RETURN_STATUS_LABELS[ret.status as keyof typeof RETURN_STATUS_LABELS]
                            ?.color
                        }
                      >
                        {RETURN_STATUS_LABELS[ret.status as keyof typeof RETURN_STATUS_LABELS]
                          ?.label || ret.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {ret.notify_patient && getContactIcon(ret.preferred_contact as string)}
                        {ret.client_phone && (
                          <a
                            href={`https://wa.me/55${ret.client_phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-green-600 hover:underline text-sm"
                          >
                            {ret.client_phone}
                          </a>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            Ações
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          {ret.status === "pending" && (
                            <>
                              <DropdownMenuItem
                                onClick={() =>
                                  updateStatusMutation.mutate({
                                    reminderId: ret.id,
                                    status: "notified",
                                  })
                                }
                              >
                                Marcar como Notificado
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() =>
                                  window.open(`/agenda?patient=${ret.patient_id}`, "_blank")
                                }
                              >
                                Agendar Retorno
                              </DropdownMenuItem>
                            </>
                          )}
                          {(ret.status === "pending" || ret.status === "notified") && (
                            <DropdownMenuItem
                              onClick={() =>
                                updateStatusMutation.mutate({
                                  reminderId: ret.id,
                                  status: "completed",
                                })
                              }
                            >
                              Marcar como Concluído
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() =>
                              updateStatusMutation.mutate({
                                reminderId: ret.id,
                                status: "cancelled",
                              })
                            }
                          >
                            Cancelar Retorno
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <CalendarClock className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>Nenhum retorno encontrado com os filtros selecionados</p>
            </div>
          )}
        </CardContent>
      </Card>

      {overdueReturns.length > 0 && (
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader>
            <CardTitle className="text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Retornos Atrasados ({overdueReturns.length})
            </CardTitle>
            <CardDescription>
              Pacientes que deveriam ter retornado mas não agendaram
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {overdueReturns.slice(0, 5).map((ret) => (
                <div
                  key={ret.id}
                  className="flex items-center justify-between p-3 bg-white rounded-lg border"
                >
                  <div>
                    <div className="font-medium">{ret.client_name}</div>
                    <div className="text-sm text-muted-foreground">
                      Deveria retornar em {format(new Date(ret.return_date), "dd/MM/yyyy")} —{" "}
                      <span className="text-red-600 font-medium">
                        {ret.days_overdue} dias atrasado
                      </span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ret.client_phone && (
                      <Button variant="outline" size="sm" asChild>
                        <a
                          href={`https://wa.me/55${ret.client_phone.replace(/\D/g, "")}?text=Olá ${ret.client_name}, notamos que você tinha um retorno agendado. Gostaria de remarcar?`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          WhatsApp
                        </a>
                      </Button>
                    )}
                    <Button
                      variant="default"
                      size="sm"
                      onClick={() => window.open(`/agenda?patient=${ret.patient_id}`, "_blank")}
                    >
                      Agendar
                    </Button>
                  </div>
                </div>
              ))}
              {overdueReturns.length > 5 && (
                <p className="text-sm text-muted-foreground text-center">
                  E mais {overdueReturns.length - 5} pacientes atrasados...
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
