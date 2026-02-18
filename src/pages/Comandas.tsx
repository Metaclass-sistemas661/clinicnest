import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  Search,
  Plus,
  Receipt,
  Eye,
  Loader2,
  UserPlus,
  CalendarCheck,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toastRpcError } from "@/lib/rpc-error";
import { logger } from "@/lib/logger";
import {
  createWalkinOrderV1,
  createOrderForAppointmentV1,
} from "@/lib/supabase-typed-rpc";
import { ComandaDetail } from "@/components/comandas/ComandaDetail";
import type { Order, Client, Appointment } from "@/types/database";

type OrderWithJoins = Order & {
  client?: Client | null;
  professional?: { full_name: string } | null;
};

const statusLabels: Record<string, string> = {
  draft: "Rascunho",
  open: "Aberta",
  paid: "Paga",
  cancelled: "Cancelada",
  refunded: "Reembolsada",
};

const statusColors: Record<string, string> = {
  draft: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300",
  open: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
  paid: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
  refunded: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
};

export default function Comandas() {
  const { profile, isAdmin } = useAuth();
  const [orders, setOrders] = useState<OrderWithJoins[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // New order dialog
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [newOrderMode, setNewOrderMode] = useState<"walkin" | "appointment">("walkin");
  const [isCreating, setIsCreating] = useState(false);

  // Walk-in fields
  const [clients, setClients] = useState<Client[]>([]);
  const [professionals, setProfessionals] = useState<{ id: string; full_name: string }[]>([]);
  const [selectedClientId, setSelectedClientId] = useState("");
  const [selectedProfessionalId, setSelectedProfessionalId] = useState("");
  const [newOrderNotes, setNewOrderNotes] = useState("");

  // From appointment fields
  const [pendingAppointments, setPendingAppointments] = useState<(Appointment & { client?: Client; service?: { name: string } })[]>([]);
  const [selectedAppointmentId, setSelectedAppointmentId] = useState("");

  // Detail sheet
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchOrders();
    }
  }, [profile?.tenant_id]);

  const fetchOrders = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("orders")
        .select("*, client:clients(*), professional:profiles!orders_professional_id_fkey(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setOrders((data as unknown as OrderWithJoins[]) || []);
    } catch (error) {
      logger.error("Error fetching orders:", error);
      toast.error("Erro ao carregar comandas.");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchReferenceData = async () => {
    if (!profile?.tenant_id) return;
    try {
      const [cRes, pRes, aRes] = await Promise.all([
        supabase.from("clients").select("*").eq("tenant_id", profile.tenant_id).order("name"),
        supabase.from("profiles").select("id, full_name").eq("tenant_id", profile.tenant_id).order("full_name"),
        supabase
          .from("appointments")
          .select("*, client:clients(*), service:services(name)")
          .eq("tenant_id", profile.tenant_id)
          .in("status", ["pending", "confirmed"])
          .order("scheduled_at", { ascending: false })
          .limit(50),
      ]);
      setClients((cRes.data as unknown as Client[]) || []);
      setProfessionals(pRes.data || []);
      setPendingAppointments((aRes.data as any) || []);
    } catch (error) {
      logger.error("Error fetching reference data:", error);
    }
  };

  const filteredOrders = useMemo(() => {
    let result = orders;
    if (statusFilter !== "all") {
      result = result.filter((o) => o.status === statusFilter);
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      result = result.filter(
        (o) =>
          o.client?.name?.toLowerCase().includes(q) ||
          o.professional?.full_name?.toLowerCase().includes(q) ||
          o.id.toLowerCase().includes(q)
      );
    }
    return result;
  }, [orders, statusFilter, debouncedSearch]);

  const handleOpenNewDialog = () => {
    setNewOrderMode("walkin");
    setSelectedClientId("");
    setSelectedProfessionalId("");
    setNewOrderNotes("");
    setSelectedAppointmentId("");
    fetchReferenceData();
    setNewDialogOpen(true);
  };

  const handleCreateOrder = async () => {
    if (!profile?.tenant_id) return;
    setIsCreating(true);
    try {
      if (newOrderMode === "walkin") {
        const { data, error } = await createWalkinOrderV1({
          p_client_id: selectedClientId || null,
          p_professional_id: selectedProfessionalId || null,
          p_notes: newOrderNotes || null,
        });
        if (error) {
          toastRpcError(toast, error as any, "Erro ao criar comanda");
          return;
        }
        toast.success("Comanda criada!");
        setNewDialogOpen(false);
        fetchOrders();
        if (data?.order_id) {
          setSelectedOrderId(data.order_id);
          setDetailOpen(true);
        }
      } else {
        if (!selectedAppointmentId) {
          toast.error("Selecione um agendamento.");
          return;
        }
        const { data, error } = await createOrderForAppointmentV1({
          p_appointment_id: selectedAppointmentId,
        });
        if (error) {
          toastRpcError(toast, error as any, "Erro ao criar comanda");
          return;
        }
        toast.success("Comanda criada a partir do agendamento!");
        setNewDialogOpen(false);
        fetchOrders();
        if (data?.order_id) {
          setSelectedOrderId(data.order_id);
          setDetailOpen(true);
        }
      }
    } catch {
      toast.error("Erro ao criar comanda");
    } finally {
      setIsCreating(false);
    }
  };

  const handleOpenDetail = (orderId: string) => {
    setSelectedOrderId(orderId);
    setDetailOpen(true);
  };

  const formatCurrency = (v: number) =>
    v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });

  return (
    <MainLayout
      title="Comandas"
      subtitle="Gerencie as comandas do sal&atilde;o"
      actions={
        <Button className="gradient-primary text-primary-foreground" onClick={handleOpenNewDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Comanda
        </Button>
      }
    >
      {/* Filters */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por cliente ou profissional..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-40">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="draft">Rascunho</SelectItem>
            <SelectItem value="open">Aberta</SelectItem>
            <SelectItem value="paid">Paga</SelectItem>
            <SelectItem value="cancelled">Cancelada</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Orders list */}
      <Card>
        <CardHeader>
          <CardTitle>Comandas ({filteredOrders.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredOrders.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="Nenhuma comanda encontrada"
              description="Crie uma nova comanda para come&ccedil;ar a registrar vendas."
              action={
                <Button className="gradient-primary text-primary-foreground" onClick={handleOpenNewDialog}>
                  <Plus className="mr-2 h-4 w-4" />
                  Nova Comanda
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile cards */}
              <div className="block md:hidden space-y-3">
                {filteredOrders.map((order) => (
                  <div
                    key={order.id}
                    className="rounded-lg border p-4 space-y-2 cursor-pointer hover:bg-muted/50 transition-colors"
                    onClick={() => handleOpenDetail(order.id)}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium truncate">
                        {order.client?.name ?? "Walk-in"}
                      </span>
                      <Badge className={statusColors[order.status] ?? ""}>
                        {statusLabels[order.status] ?? order.status}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span>{order.professional?.full_name ?? "-"}</span>
                      <span className="font-semibold text-foreground">
                        {formatCurrency(order.total_amount)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(order.created_at)}
                    </p>
                  </div>
                ))}
              </div>

              {/* Desktop table */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Cliente</TableHead>
                      <TableHead>Profissional</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead className="text-right">A&ccedil;&otilde;es</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredOrders.map((order) => (
                      <TableRow key={order.id} className="cursor-pointer" onClick={() => handleOpenDetail(order.id)}>
                        <TableCell className="font-medium">
                          {order.client?.name ?? "Walk-in"}
                        </TableCell>
                        <TableCell>{order.professional?.full_name ?? "-"}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[order.status] ?? ""}>
                            {statusLabels[order.status] ?? order.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatCurrency(order.total_amount)}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(order.created_at)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); handleOpenDetail(order.id); }}>
                            <Eye className="h-4 w-4" />
                          </Button>
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

      {/* New Order Dialog */}
      <Dialog open={newDialogOpen} onOpenChange={setNewDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Comanda</DialogTitle>
            <DialogDescription>
              Crie uma comanda para um atendimento avulso (walk-in) ou a partir de um agendamento existente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Mode selector */}
            <div className="grid grid-cols-2 gap-2">
              <Button
                type="button"
                variant={newOrderMode === "walkin" ? "default" : "outline"}
                className={newOrderMode === "walkin" ? "gradient-primary text-primary-foreground" : ""}
                onClick={() => setNewOrderMode("walkin")}
              >
                <UserPlus className="mr-2 h-4 w-4" />
                Walk-in
              </Button>
              <Button
                type="button"
                variant={newOrderMode === "appointment" ? "default" : "outline"}
                className={newOrderMode === "appointment" ? "gradient-primary text-primary-foreground" : ""}
                onClick={() => setNewOrderMode("appointment")}
              >
                <CalendarCheck className="mr-2 h-4 w-4" />
                Agendamento
              </Button>
            </div>

            {newOrderMode === "walkin" ? (
              <>
                <div className="space-y-2">
                  <Label>Cliente (opcional)</Label>
                  <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um cliente..." /></SelectTrigger>
                    <SelectContent>
                      {clients.map((c) => (
                        <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Profissional (opcional)</Label>
                  <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                    <SelectTrigger><SelectValue placeholder="Selecione um profissional..." /></SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.full_name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Observa&ccedil;&otilde;es</Label>
                  <Textarea
                    placeholder="Observa&ccedil;&otilde;es opcionais..."
                    value={newOrderNotes}
                    onChange={(e) => setNewOrderNotes(e.target.value)}
                    rows={2}
                  />
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <Label>Agendamento</Label>
                <Select value={selectedAppointmentId} onValueChange={setSelectedAppointmentId}>
                  <SelectTrigger><SelectValue placeholder="Selecione um agendamento..." /></SelectTrigger>
                  <SelectContent>
                    {pendingAppointments.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.client?.name ?? "Sem cliente"} - {a.service?.name ?? "Servi\u00e7o"} ({new Date(a.scheduled_at).toLocaleDateString("pt-BR")})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {pendingAppointments.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nenhum agendamento pendente/confirmado encontrado.</p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setNewDialogOpen(false)}>Cancelar</Button>
            <Button
              onClick={handleCreateOrder}
              disabled={isCreating || (newOrderMode === "appointment" && !selectedAppointmentId)}
              className="gradient-primary text-primary-foreground"
            >
              {isCreating ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</>
              ) : (
                "Criar Comanda"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Sheet */}
      <ComandaDetail
        open={detailOpen}
        onOpenChange={setDetailOpen}
        orderId={selectedOrderId}
        onUpdated={fetchOrders}
      />
    </MainLayout>
  );
}
