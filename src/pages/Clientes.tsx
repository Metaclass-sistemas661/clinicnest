import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { createClientPackageV1, getClientTimelineV1, revertPackageConsumptionForAppointmentV1, upsertClientV2 } from "@/lib/supabase-typed-rpc";
import { Users, Plus, Loader2, Phone, Mail, Search, Pencil, Scissors, Package, DollarSign, Info, Gift, Clock } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import { z } from "zod";
import type { Client } from "@/types/database";
import { fetchClientSpendingAllTime, type ClientSpendingRow } from "@/lib/clientSpending";
import type { ClientTimelineEventRow, CashbackLedgerRow } from "@/types/supabase-extensions";

const clientFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  phone: z.string().optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]),
  notes: z.string().optional(),
});

const packageFormSchema = z.object({
  service_id: z.string().min(1, "Selecione um serviço"),
  total_sessions: z.coerce.number().int().min(1, "Mínimo 1 sessão").max(100, "Máximo 100 sessões"),
  expires_at: z.string().optional(),
  notes: z.string().optional(),
});

export default function Clientes() {
  const { profile, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [clientSpending, setClientSpending] = useState<ClientSpendingRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [detailClient, setDetailClient] = useState<Client | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [detailTimeline, setDetailTimeline] = useState<ClientTimelineEventRow[]>([]);
  const [detailPackages, setDetailPackages] = useState<
    Array<{
      id: string;
      service_id: string;
      service_name: string;
      total_sessions: number;
      remaining_sessions: number;
      status: string;
      purchased_at: string;
      expires_at: string | null;
    }>
  >([]);
  const [isDetailLoadingExtras, setIsDetailLoadingExtras] = useState(false);
  const [myClientIds, setMyClientIds] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<"all" | "mine">("all");

  // Package creation
  const [packageDialog, setPackageDialog] = useState(false);
  const [packageClientId, setPackageClientId] = useState<string>("");
  const [services, setServices] = useState<Array<{ id: string; name: string }>>([]);
  const [packageForm, setPackageForm] = useState({ service_id: "", total_sessions: "5", expires_at: "", notes: "" });
  const [isSavingPackage, setIsSavingPackage] = useState(false);

  // Cashback
  const [cashbackWallet, setCashbackWallet] = useState<{ balance: number } | null>(null);
  const [cashbackLedger, setCashbackLedger] = useState<CashbackLedgerRow[]>([]);

  // Marketing opt-out
  const [marketingOptOut, setMarketingOptOut] = useState(false);
  const [isUpdatingMarketing, setIsUpdatingMarketing] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
      fetchServices();
      if (isAdmin) {
        fetchClientSpending();
      }
    }
  }, [profile?.tenant_id, isAdmin]);

  // Staff: buscar IDs de clientes que o profissional já atendeu
  useEffect(() => {
    if (!profile?.tenant_id || !profile?.id || isAdmin) return;
    const fetchMyClientIds = async () => {
      try {
        const { data } = await supabase
          .from("appointments")
          .select("client_id")
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .not("client_id", "is", null);
        const ids = new Set((data || []).map((r: { client_id: string }) => r.client_id));
        setMyClientIds(ids);
      } catch (err) {
        logger.error("Error fetching my clients:", err);
      }
    };

    fetchMyClientIds();
  }, [profile?.tenant_id, profile?.id, isAdmin]);

  useEffect(() => {
    const loadExtras = async (clientId: string) => {
      if (!profile?.tenant_id) return;

      setIsDetailLoadingExtras(true);
      try {
        const [{ data: timelineData, error: timelineError }, packagesRes, walletRes, ledgerRes, mktPrefRes] = await Promise.all([
          getClientTimelineV1({ p_client_id: clientId, p_limit: 50 }),
          supabase
            .from("client_packages")
            .select("id, service_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, services(name)")
            .eq("tenant_id", profile.tenant_id)
            .eq("client_id", clientId)
            .order("purchased_at", { ascending: false }),
          supabase
            .from("cashback_wallets")
            .select("balance")
            .eq("tenant_id", profile.tenant_id)
            .eq("client_id", clientId)
            .maybeSingle(),
          supabase
            .from("cashback_ledger")
            .select("id, delta_amount, reason, notes, created_at")
            .eq("tenant_id", profile.tenant_id)
            .eq("client_id", clientId)
            .order("created_at", { ascending: false })
            .limit(20),
          supabase
            .from("client_marketing_preferences")
            .select("marketing_opt_out")
            .eq("tenant_id", profile.tenant_id)
            .eq("client_id", clientId)
            .maybeSingle(),
        ]);

        if (timelineError) {
          toastRpcError(toast, timelineError as any, "Erro ao carregar histórico");
        } else {
          setDetailTimeline((timelineData || []) as ClientTimelineEventRow[]);
        }

        if (packagesRes.error) {
          logger.error("Error loading client packages:", packagesRes.error);
        } else {
          const normalized = (packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            service_id: String(p.service_id),
            service_name: String(p?.services?.name ?? "Serviço"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          }));
          setDetailPackages(normalized);
        }

        setCashbackWallet(walletRes.data ? { balance: Number(walletRes.data.balance ?? 0) } : null);
        setCashbackLedger((ledgerRes.data as unknown as CashbackLedgerRow[]) ?? []);
        setMarketingOptOut(mktPrefRes.data?.marketing_opt_out ?? false);
      } catch (err) {
        logger.error("Error loading client extras:", err);
        toast.error("Erro ao carregar detalhes do cliente");
      } finally {
        setIsDetailLoadingExtras(false);
      }
    };

    if (isDetailOpen && detailClient?.id) {
      loadExtras(detailClient.id);
    } else {
      setDetailTimeline([]);
      setDetailPackages([]);
      setCashbackWallet(null);
      setCashbackLedger([]);
      setMarketingOptOut(false);
      setIsDetailLoadingExtras(false);
    }
  }, [isDetailOpen, detailClient?.id, profile?.tenant_id]);

  const fetchServices = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data } = await supabase
        .from("services")
        .select("id, name")
        .eq("tenant_id", profile.tenant_id)
        .eq("is_active", true)
        .order("name");
      setServices((data || []) as Array<{ id: string; name: string }>);
    } catch (err) {
      logger.error("Error fetching services:", err);
    }
  };

  const handleRevertPackageConsumption = async (appointmentId: string) => {
    if (!isAdmin) return;
    const id = String(appointmentId || "").trim();
    if (!id) return;

    try {
      const { data, error } = await revertPackageConsumptionForAppointmentV1({
        p_appointment_id: id,
        p_reason: "Estorno manual via CRM",
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao estornar pacote");
        return;
      }
      if (!data?.success) {
        toast.error("Não foi possível estornar");
        return;
      }
      if (data.reverted) {
        toast.success("Sessão estornada com sucesso");
      } else {
        toast.message("Nenhum consumo para estornar");
      }

      // Refresh detail
      if (detailClient?.id) {
        setIsDetailLoadingExtras(true);
        const [{ data: timelineData }, packagesRes] = await Promise.all([
          getClientTimelineV1({ p_client_id: detailClient.id, p_limit: 50 }),
          supabase
            .from("client_packages")
            .select("id, service_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, services(name)")
            .eq("tenant_id", profile?.tenant_id)
            .eq("client_id", detailClient.id)
            .order("purchased_at", { ascending: false }),
        ]);
        setDetailTimeline((timelineData || []) as ClientTimelineEventRow[]);
        if (!packagesRes.error) {
          const normalized = (packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            service_id: String(p.service_id),
            service_name: String(p?.services?.name ?? "Serviço"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          }));
          setDetailPackages(normalized);
        }
      }
    } catch (err) {
      logger.error("Error reverting package consumption:", err);
      toast.error("Erro ao estornar pacote");
    } finally {
      setIsDetailLoadingExtras(false);
    }
  };

  const handleCreatePackage = async () => {
    const parsed = packageFormSchema.safeParse(packageForm);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }
    setIsSavingPackage(true);
    try {
      const { error } = await createClientPackageV1({
        p_client_id: packageClientId,
        p_service_id: parsed.data.service_id,
        p_total_sessions: parsed.data.total_sessions,
        p_expires_at: parsed.data.expires_at || null,
        p_notes: parsed.data.notes || null,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao criar pacote");
        return;
      }
      toast.success("Pacote criado com sucesso!");
      setPackageDialog(false);
      setPackageForm({ service_id: "", total_sessions: "5", expires_at: "", notes: "" });

      // Reload packages if detail is open for same client
      if (isDetailOpen && detailClient?.id === packageClientId && profile?.tenant_id) {
        const packagesRes = await supabase
          .from("client_packages")
          .select("id, service_id, total_sessions, remaining_sessions, status, purchased_at, expires_at, services(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("client_id", packageClientId)
          .order("purchased_at", { ascending: false });
        if (!packagesRes.error) {
          const normalized = (packagesRes.data || []).map((p: any) => ({
            id: String(p.id),
            service_id: String(p.service_id),
            service_name: String(p?.services?.name ?? "Serviço"),
            total_sessions: Number(p.total_sessions ?? 0),
            remaining_sessions: Number(p.remaining_sessions ?? 0),
            status: String(p.status ?? ""),
            purchased_at: String(p.purchased_at ?? ""),
            expires_at: p.expires_at ? String(p.expires_at) : null,
          }));
          setDetailPackages(normalized);
        }
      }
    } catch (err) {
      logger.error("[Clientes] createPackage error", err);
      toast.error("Erro ao criar pacote");
    } finally {
      setIsSavingPackage(false);
    }
  };

  const handleToggleMarketingOptOut = async (checked: boolean) => {
    if (!detailClient || !profile?.tenant_id || !isAdmin) return;
    setIsUpdatingMarketing(true);
    try {
      const { error } = await supabase
        .from("client_marketing_preferences")
        .upsert(
          { tenant_id: profile.tenant_id, client_id: detailClient.id, marketing_opt_out: checked, updated_at: new Date().toISOString() },
          { onConflict: "tenant_id,client_id" }
        );
      if (error) throw error;
      setMarketingOptOut(checked);
      toast.success(checked ? "Cliente optou por não receber marketing" : "Preferência de marketing atualizada");
    } catch (err) {
      logger.error("[Clientes] toggleMarketing error", err);
      toast.error("Erro ao atualizar preferência");
    } finally {
      setIsUpdatingMarketing(false);
    }
  };

  const filteredClients = useMemo(() => {
    let list = clients;
    if (!isAdmin && clientFilter === "mine") {
      list = list.filter((c) => myClientIds.has(c.id));
    }
    if (!debouncedSearchQuery.trim()) return list;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return list.filter(
      (client) =>
        client.name.toLowerCase().includes(q) ||
        client.phone?.includes(debouncedSearchQuery) ||
        client.email?.toLowerCase().includes(q)
    );
  }, [clients, debouncedSearchQuery, isAdmin, clientFilter, myClientIds]);

  const fetchClientSpending = async () => {
    if (!profile?.tenant_id) return;
    try {
      const data = await fetchClientSpendingAllTime(profile.tenant_id);
      setClientSpending(data);
    } catch (err) {
      logger.error("Error fetching client spending:", err);
      toast.error("Erro ao carregar consumo dos clientes.");
    }
  };

  const getSpendingForClient = (clientId: string): ClientSpendingRow | undefined =>
    clientSpending.find((s) => s.client_id === clientId);

  const sortedAndFilteredClients = useMemo(() => {
    if (!isAdmin || clientSpending.length === 0) return [...filteredClients];
    return [...filteredClients].sort((a, b) => {
      const sa = getSpendingForClient(a.id)?.total_amount ?? 0;
      const sb = getSpendingForClient(b.id)?.total_amount ?? 0;
      return sb - sa;
    });
  }, [filteredClients, isAdmin, clientSpending]);

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id,tenant_id,name,phone,email,notes,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (error) {
      logger.error("Error fetching clients:", error);
      toast.error("Erro ao carregar clientes. Tente novamente.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenDialog = (client?: Client) => {
    if (client) {
      setEditingClient(client);
      setFormData({
        name: client.name,
        phone: client.phone || "",
        email: client.email || "",
        notes: client.notes || "",
      });
    } else {
      setEditingClient(null);
      setFormData({ name: "", phone: "", email: "", notes: "" });
    }
    setIsDialogOpen(true);
  };

  const openPackageDialog = (clientId: string) => {
    setPackageClientId(clientId);
    setPackageForm({ service_id: "", total_sessions: "5", expires_at: "", notes: "" });
    setPackageDialog(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id) return;

    const parsed = clientFormSchema.safeParse({
      name: formData.name.trim(),
      phone: formData.phone,
      email: formData.email || "",
      notes: formData.notes,
    });
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }

    setIsSaving(true);

    try {
      const { error } = await upsertClientV2({
        p_client_id: editingClient?.id ?? null,
        p_name: parsed.data.name,
        p_phone: parsed.data.phone || null,
        p_email: parsed.data.email || null,
        p_notes: parsed.data.notes || null,
      });

      if (error) {
        toastRpcError(toast, error as any, editingClient ? "Erro ao atualizar cliente" : "Erro ao cadastrar cliente");
        return;
      }

      toast.success(editingClient ? "Cliente atualizado com sucesso!" : "Cliente cadastrado com sucesso!");
      setIsDialogOpen(false);
      setFormData({ name: "", phone: "", email: "", notes: "" });
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      toast.error(editingClient ? "Erro ao atualizar cliente" : "Erro ao cadastrar cliente");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (d: string) => {
    try {
      return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
    } catch {
      return d;
    }
  };

  const cashbackReasonLabel: Record<string, string> = { earn: "Crédito", redeem: "Resgate", adjust: "Ajuste", revert: "Estorno" };

  return (
    <MainLayout
      title="Clientes"
      subtitle={isAdmin ? "Gerencie seus clientes" : "Clientes do salão"}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="clients-new">
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingClient ? "Editar Cliente" : "Novo Cliente"}</DialogTitle>
              <DialogDescription>
                {editingClient ? "Atualize os dados do cliente" : "Cadastre um novo cliente"}
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleSubmit}>
              <div className="grid gap-4 py-4">
                <div className="space-y-2">
                  <Label>Nome</Label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="Nome completo" required />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value })} placeholder="(11) 99999-9999" />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} placeholder="email@exemplo.com" />
                </div>
                <div className="space-y-2">
                  <Label>Observações</Label>
                  <Textarea value={formData.notes} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} placeholder="Anotações sobre o cliente..." rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
                <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground" data-tour="clients-save">
                  {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : editingClient ? "Atualizar" : "Cadastrar"}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      }
    >
      {/* Search + Staff filter */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-10"
            aria-label="Buscar clientes"
          />
        </div>
        {!isAdmin && (
          <div className="flex rounded-lg border border-border bg-card">
            <Button
              variant={clientFilter === "all" ? "default" : "ghost"}
              size="sm"
              className={clientFilter === "all" ? "gradient-primary text-primary-foreground" : ""}
              onClick={() => setClientFilter("all")}
              data-tour="clients-filter-all"
            >
              Todos
            </Button>
            <Button
              variant={clientFilter === "mine" ? "default" : "ghost"}
              size="sm"
              className={clientFilter === "mine" ? "gradient-primary text-primary-foreground" : ""}
              onClick={() => setClientFilter("mine")}
              data-tour="clients-filter-mine"
            >
              Meus clientes ({myClientIds.size})
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? "Clientes Cadastrados" : `Clientes Cadastrados (${sortedAndFilteredClients.length})`}
          </CardTitle>
          {isAdmin && clientSpending.length > 0 && (
            <CardDescription>Ordenado por consumo — clientes que mais consomem no topo</CardDescription>
          )}
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 p-4">
              <Skeleton className="h-10 w-full" />
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : filteredClients.length === 0 ? (
            <EmptyState
              icon={Users}
              title={searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              description={searchQuery ? "Tente ajustar os termos da busca." : "Cadastre seu primeiro cliente para começar."}
              action={
                !searchQuery && (
                  <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()} data-tour="clients-new-empty">
                    <Plus className="mr-2 h-4 w-4" />
                    Novo Cliente
                  </Button>
                )
              }
            />
          ) : (
            <>
              {/* Mobile: Card Layout */}
              <div className="block md:hidden space-y-3">
                {sortedAndFilteredClients.map((client, index) => {
                  const spending = getSpendingForClient(client.id);
                  return (
                    <div key={client.id} className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAdmin && clientSpending.length > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                          )}
                          <p className="font-medium">{client.name}</p>
                        </div>
                        <div className="flex items-center gap-1">
                          {isAdmin && (
                            <Button variant="ghost" size="icon" onClick={() => openPackageDialog(client.id)} aria-label={`Vender pacote para ${client.name}`} data-tour="clients-item-package">
                              <Package className="h-4 w-4" />
                            </Button>
                          )}
                          <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(client)} aria-label={`Editar cliente ${client.name}`} data-tour="clients-item-edit">
                            <Pencil className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />{client.phone}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" /><span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {isAdmin && spending && (spending.services_count > 0 || spending.products_count > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          <Badge variant="secondary" className="gap-1 text-xs"><DollarSign className="h-3 w-3" />{formatCurrency(spending.total_amount)}</Badge>
                          <Badge variant="outline" className="gap-1 text-xs">Ticket: {formatCurrency(spending.ticket_medio)}</Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => { setDetailClient(client); setIsDetailOpen(true); }}
                            data-tour="clients-item-details"
                          >
                            <Info className="h-3 w-3 mr-1" />Detalhes
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Desktop: Table Layout */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {isAdmin && clientSpending.length > 0 && <TableHead className="w-10">#</TableHead>}
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      {isAdmin && clientSpending.length > 0 && <TableHead>Consumo</TableHead>}
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredClients.map((client, index) => {
                      const spending = getSpendingForClient(client.id);
                      return (
                        <TableRow key={client.id}>
                          {isAdmin && clientSpending.length > 0 && <TableCell className="font-bold text-primary">{index + 1}</TableCell>}
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>{client.phone ? <div className="flex items-center gap-1 text-muted-foreground"><Phone className="h-4 w-4" />{client.phone}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                          <TableCell>{client.email ? <div className="flex items-center gap-1 text-muted-foreground"><Mail className="h-4 w-4" />{client.email}</div> : <span className="text-muted-foreground">—</span>}</TableCell>
                          {isAdmin && clientSpending.length > 0 && (
                            <TableCell>
                              {spending ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  <Badge variant="secondary" className="text-xs">{formatCurrency(spending.total_amount)}</Badge>
                                  <Badge variant="outline" className="text-xs">Ticket: {formatCurrency(spending.ticket_medio)}</Badge>
                                  <Button variant="ghost" size="sm" className="h-6 text-xs px-1" onClick={() => { setDetailClient(client); setIsDetailOpen(true); }} aria-label={`Ver detalhes de ${client.name}`} data-tour="clients-item-details">
                                    <Info className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : <span className="text-muted-foreground text-sm">—</span>}
                            </TableCell>
                          )}
                          <TableCell className="max-w-xs truncate text-muted-foreground">{client.notes || "—"}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              {isAdmin && (
                                <Button variant="ghost" size="icon" onClick={() => openPackageDialog(client.id)} aria-label={`Vender pacote para ${client.name}`} data-tour="clients-item-package">
                                  <Package className="h-4 w-4" />
                                </Button>
                              )}
                              <Button variant="ghost" size="icon" onClick={() => handleOpenDialog(client)} aria-label={`Editar cliente ${client.name}`} data-tour="clients-item-edit">
                                <Pencil className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {/* Modal de detalhes do cliente com tabs */}
      {detailClient && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailClient.name}</DialogTitle>
              <DialogDescription>Histórico, pacotes e fidelidade</DialogDescription>
            </DialogHeader>

            {isDetailLoadingExtras ? (
              <div className="space-y-3 py-4">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-24 w-full" />
              </div>
            ) : (
              <Tabs defaultValue="consumo" className="w-full">
                <TabsList className="grid w-full grid-cols-4 h-auto gap-1 p-1">
                  <TabsTrigger value="consumo" className="text-xs py-2"><DollarSign className="h-3 w-3 mr-1" />Consumo</TabsTrigger>
                  <TabsTrigger value="pacotes" className="text-xs py-2"><Package className="h-3 w-3 mr-1" />Pacotes</TabsTrigger>
                  <TabsTrigger value="timeline" className="text-xs py-2"><Clock className="h-3 w-3 mr-1" />Timeline</TabsTrigger>
                  <TabsTrigger value="cashback" className="text-xs py-2"><Gift className="h-3 w-3 mr-1" />Cashback</TabsTrigger>
                </TabsList>

                {/* Tab: Consumo */}
                <TabsContent value="consumo" className="mt-4 space-y-4">
                  {(() => {
                    const spending = getSpendingForClient(detailClient.id);
                    if (!spending) return <p className="text-muted-foreground text-sm py-4">Nenhum consumo registrado.</p>;
                    return (
                      <>
                        <div className="flex flex-wrap gap-2">
                          <Badge variant="secondary" className="text-sm">Total: {formatCurrency(spending.total_amount)}</Badge>
                          <Badge variant="outline" className="text-sm">Ticket médio: {formatCurrency(spending.ticket_medio)}</Badge>
                          <Badge variant="outline" className="text-sm">{spending.services_count} serviço{spending.services_count !== 1 ? "s" : ""}</Badge>
                          <Badge variant="outline" className="text-sm">{spending.products_count} produto{spending.products_count !== 1 ? "s" : ""}</Badge>
                        </div>

                        {spending.services_detail.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2"><Scissors className="h-4 w-4" />Serviços realizados</h4>
                            <div className="rounded-lg border divide-y text-sm">
                              {spending.services_detail.map((s, i) => (
                                <div key={i} className="flex justify-between items-center px-3 py-2">
                                  <span>{s.name}</span>
                                  <span className="text-muted-foreground">{formatDate(s.date)}</span>
                                  <span className="font-medium">{formatCurrency(s.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {spending.products_detail.length > 0 && (
                          <div>
                            <h4 className="font-medium text-sm mb-2 flex items-center gap-2"><Package className="h-4 w-4" />Produtos comprados</h4>
                            <div className="rounded-lg border divide-y text-sm">
                              {spending.products_detail.map((p, i) => (
                                <div key={i} className="flex justify-between items-center px-3 py-2">
                                  <span>{p.name}</span>
                                  <span className="text-muted-foreground">{formatDate(p.date)}</span>
                                  <span className="font-medium">{formatCurrency(p.amount)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Marketing opt-out */}
                        {isAdmin && (
                          <div className="flex items-center justify-between rounded-lg border p-3">
                            <div>
                              <div className="text-sm font-medium">Opt-out de marketing</div>
                              <div className="text-xs text-muted-foreground">Cliente não deseja receber comunicações</div>
                            </div>
                            <Switch checked={marketingOptOut} onCheckedChange={handleToggleMarketingOptOut} disabled={isUpdatingMarketing} />
                          </div>
                        )}
                      </>
                    );
                  })()}
                </TabsContent>

                {/* Tab: Pacotes */}
                <TabsContent value="pacotes" className="mt-4 space-y-4">
                  {isAdmin && (
                    <Button size="sm" className="gradient-primary text-primary-foreground" onClick={() => openPackageDialog(detailClient.id)}>
                      <Plus className="mr-2 h-4 w-4" />Novo Pacote
                    </Button>
                  )}
                  {detailPackages.length === 0 ? (
                    <EmptyState icon={Package} title="Nenhum pacote" description="Este cliente ainda não possui pacotes de sessões." />
                  ) : (
                    <div className="rounded-lg border divide-y text-sm">
                      {detailPackages.map((p) => (
                        <div key={p.id} className="flex justify-between items-center px-3 py-2 gap-3">
                          <div className="min-w-0">
                            <div className="font-medium truncate">{p.service_name}</div>
                            <div className="text-xs text-muted-foreground">
                              {p.status === "active" ? "Ativo" : p.status === "depleted" ? "Esgotado" : p.status}
                              {p.purchased_at && ` · Comprado em ${new Date(p.purchased_at).toLocaleDateString("pt-BR")}`}
                            </div>
                          </div>
                          <Badge variant={p.remaining_sessions > 0 ? "secondary" : "outline"}>
                            {p.remaining_sessions}/{p.total_sessions}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Timeline */}
                <TabsContent value="timeline" className="mt-4 space-y-4">
                  {detailTimeline.length === 0 ? (
                    <EmptyState icon={Clock} title="Nenhum evento" description="O histórico do cliente aparecerá aqui." />
                  ) : (
                    <div className="rounded-lg border divide-y text-sm">
                      {detailTimeline.map((ev, i) => (
                        <div key={`${ev.kind}-${ev.event_at}-${i}`} className="px-3 py-2">
                          <div className="flex items-center justify-between gap-3">
                            <div className="font-medium truncate">{ev.title}</div>
                            <div className="text-xs text-muted-foreground shrink-0">
                              {new Date(ev.event_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                            </div>
                          </div>
                          {ev.body && <div className="text-xs text-muted-foreground mt-1">{ev.body}</div>}
                          {isAdmin && ev.kind === "appointment" && (
                            <div className="mt-2">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => {
                                  const aptId = String((ev as any)?.meta?.appointment_id ?? "");
                                  if (!aptId) { toast.error("appointment_id não encontrado"); return; }
                                  handleRevertPackageConsumption(aptId);
                                }}
                              >
                                Estornar sessão do pacote
                              </Button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>

                {/* Tab: Cashback */}
                <TabsContent value="cashback" className="mt-4 space-y-4">
                  <div className="rounded-lg border p-4 flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">Saldo atual</div>
                    <div className="text-lg font-bold text-primary">
                      {formatCurrency(cashbackWallet?.balance ?? 0)}
                    </div>
                  </div>
                  {cashbackLedger.length === 0 ? (
                    <EmptyState icon={Gift} title="Sem movimentações" description="Nenhum cashback gerado para este cliente." />
                  ) : (
                    <div className="rounded-lg border divide-y text-sm">
                      {cashbackLedger.map((entry) => (
                        <div key={entry.id} className="flex items-center justify-between px-3 py-2 gap-3">
                          <div>
                            <div className="font-medium">{cashbackReasonLabel[entry.reason] ?? entry.reason}</div>
                            {entry.notes && <div className="text-xs text-muted-foreground">{entry.notes}</div>}
                            <div className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString("pt-BR")}</div>
                          </div>
                          <div className={`font-semibold ${Number(entry.delta_amount) >= 0 ? "text-green-600 dark:text-green-400" : "text-destructive"}`}>
                            {Number(entry.delta_amount) >= 0 ? "+" : ""}{formatCurrency(Number(entry.delta_amount))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Dialog para criar pacote */}
      <Dialog open={packageDialog} onOpenChange={setPackageDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Vender Pacote</DialogTitle>
            <DialogDescription>Crie um pacote de sessões para o cliente</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Serviço</Label>
              <Select value={packageForm.service_id} onValueChange={(v) => setPackageForm({ ...packageForm, service_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                <SelectContent>
                  {services.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Total de sessões</Label>
              <Input type="number" min="1" max="100" value={packageForm.total_sessions} onChange={(e) => setPackageForm({ ...packageForm, total_sessions: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Validade (opcional)</Label>
              <Input type="date" value={packageForm.expires_at} onChange={(e) => setPackageForm({ ...packageForm, expires_at: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={packageForm.notes} onChange={(e) => setPackageForm({ ...packageForm, notes: e.target.value })} rows={2} placeholder="Notas sobre o pacote..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPackageDialog(false)}>Cancelar</Button>
            <Button className="gradient-primary text-primary-foreground" onClick={handleCreatePackage} disabled={isSavingPackage}>
              {isSavingPackage ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Criando...</> : "Criar Pacote"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
