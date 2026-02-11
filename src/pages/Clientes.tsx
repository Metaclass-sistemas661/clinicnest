import { useState, useEffect, useMemo } from "react";
import { useDebounce } from "@/hooks/useDebounce";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Users, Plus, Loader2, Phone, Mail, Search, Pencil, Scissors, Package, DollarSign, Info } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { z } from "zod";
import type { Client } from "@/types/database";
import { fetchClientSpendingAllTime, type ClientSpendingRow } from "@/lib/clientSpending";

const clientFormSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório").max(200, "Nome muito longo"),
  phone: z.string().optional(),
  email: z.union([z.string().email("E-mail inválido"), z.literal("")]),
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
  const [myClientIds, setMyClientIds] = useState<Set<string>>(new Set());
  const [clientFilter, setClientFilter] = useState<"all" | "mine">("all");

  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    notes: "",
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
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

  const filteredClients = useMemo(() => {
    if (!debouncedSearchQuery.trim()) return clients;
    const q = debouncedSearchQuery.toLowerCase().trim();
    return clients.filter(
      (client) =>
        client.name.toLowerCase().includes(q) ||
        client.phone?.includes(debouncedSearchQuery) ||
        client.email?.toLowerCase().includes(q)
    );
  }, [clients, debouncedSearchQuery]);

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
      setFormData({
        name: "",
        phone: "",
        email: "",
        notes: "",
      });
    }
    setIsDialogOpen(true);
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
      const msg = parsed.error.errors[0]?.message ?? "Verifique os dados";
      toast.error(msg);
      return;
    }

    setIsSaving(true);

    try {
      const clientData = {
        tenant_id: profile.tenant_id,
        name: parsed.data.name,
        phone: parsed.data.phone || null,
        email: parsed.data.email || null,
        notes: parsed.data.notes || null,
      };

      if (editingClient) {
        const { error } = await supabase
          .from("clients")
          .update(clientData)
          .eq("id", editingClient.id);

        if (error) throw error;
        toast.success("Cliente atualizado com sucesso!");
      } else {
        const { error } = await supabase.from("clients").insert(clientData);

        if (error) throw error;
        toast.success("Cliente cadastrado com sucesso!");
      }

      setIsDialogOpen(false);
      setFormData({
        name: "",
        phone: "",
        email: "",
        notes: "",
      });
      setEditingClient(null);
      fetchClients();
    } catch (error) {
      toast.error(editingClient ? "Erro ao atualizar cliente" : "Erro ao cadastrar cliente");
      logger.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout
      title="Clientes"
      subtitle={isAdmin ? "Gerencie seus clientes" : "Clientes do salão"}
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
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
                  <Input
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="Nome completo"
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label>Telefone</Label>
                  <Input
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="(11) 99999-9999"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Email</Label>
                  <Input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="email@exemplo.com"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>Observações</Label>
                  <Textarea
                    value={formData.notes}
                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                    placeholder="Anotações sobre o cliente, preferências, alergias..."
                    rows={3}
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
                  ) : editingClient ? (
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
      {/* Search + Staff filter */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-10"
            aria-label="Buscar clientes por nome, telefone ou email"
          />
        </div>
        {!isAdmin && (
          <div className="flex rounded-lg border border-border bg-card">
            <Button
              variant={clientFilter === "all" ? "default" : "ghost"}
              size="sm"
              className={clientFilter === "all" ? "gradient-primary text-primary-foreground" : ""}
              onClick={() => setClientFilter("all")}
            >
              Todos
            </Button>
            <Button
              variant={clientFilter === "mine" ? "default" : "ghost"}
              size="sm"
              className={clientFilter === "mine" ? "gradient-primary text-primary-foreground" : ""}
              onClick={() => setClientFilter("mine")}
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
            <CardDescription>
              Ordenado por consumo — clientes que mais consomem no topo
            </CardDescription>
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
              description={
                searchQuery
                  ? "Tente ajustar os termos da busca."
                  : "Cadastre seu primeiro cliente para começar a organizar sua agenda."
              }
              action={
                !searchQuery && (
                  <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
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
                    <div
                      key={client.id}
                      className="rounded-lg border p-4 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {isAdmin && clientSpending.length > 0 && (
                            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                              {index + 1}
                            </span>
                          )}
                          <p className="font-medium">{client.name}</p>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleOpenDialog(client)}
                          aria-label={`Editar cliente ${client.name}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                      </div>
                      {client.phone && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Phone className="h-4 w-4" />
                          {client.phone}
                        </div>
                      )}
                      {client.email && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <Mail className="h-4 w-4" />
                          <span className="truncate">{client.email}</span>
                        </div>
                      )}
                      {isAdmin && spending && (spending.services_count > 0 || spending.products_count > 0) && (
                        <div className="flex flex-wrap gap-1.5 pt-2">
                          {spending.services_count > 0 && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Scissors className="h-3 w-3" />
                              {spending.services_count} serviço{spending.services_count !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          {spending.products_count > 0 && (
                            <Badge variant="outline" className="gap-1 text-xs">
                              <Package className="h-3 w-3" />
                              {spending.products_count} produto{spending.products_count !== 1 ? "s" : ""}
                            </Badge>
                          )}
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <DollarSign className="h-3 w-3" />
                            {formatCurrency(spending.total_amount)}
                          </Badge>
                          <Badge variant="outline" className="gap-1 text-xs">
                            Ticket médio: {formatCurrency(spending.ticket_medio)}
                          </Badge>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => {
                              setDetailClient(client);
                              setIsDetailOpen(true);
                            }}
                          >
                            <Info className="h-3 w-3 mr-1" />
                            Detalhes
                          </Button>
                        </div>
                      )}
                      {client.notes && (
                        <p className="text-sm text-muted-foreground line-clamp-2">
                          {client.notes}
                        </p>
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
                      {isAdmin && clientSpending.length > 0 && (
                        <TableHead className="w-10">#</TableHead>
                      )}
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead>Email</TableHead>
                      {isAdmin && clientSpending.length > 0 && (
                        <TableHead>Consumo</TableHead>
                      )}
                      <TableHead>Observações</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sortedAndFilteredClients.map((client, index) => {
                      const spending = getSpendingForClient(client.id);
                      return (
                        <TableRow key={client.id}>
                          {isAdmin && clientSpending.length > 0 && (
                            <TableCell className="font-bold text-primary">
                              {index + 1}
                            </TableCell>
                          )}
                          <TableCell className="font-medium">{client.name}</TableCell>
                          <TableCell>
                            {client.phone ? (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Phone className="h-4 w-4" />
                                {client.phone}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell>
                            {client.email ? (
                              <div className="flex items-center gap-1 text-muted-foreground">
                                <Mail className="h-4 w-4" />
                                {client.email}
                              </div>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          {isAdmin && clientSpending.length > 0 && (
                            <TableCell>
                              {spending ? (
                                <div className="flex flex-wrap items-center gap-1.5">
                                  {spending.services_count > 0 && (
                                    <Badge variant="outline" className="gap-1 text-xs">
                                      <Scissors className="h-3 w-3" />
                                      {spending.services_count} serv.
                                    </Badge>
                                  )}
                                  {spending.products_count > 0 && (
                                    <Badge variant="outline" className="gap-1 text-xs">
                                      <Package className="h-3 w-3" />
                                      {spending.products_count} prod.
                                    </Badge>
                                  )}
                                  <Badge variant="secondary" className="text-xs">
                                    {formatCurrency(spending.total_amount)}
                                  </Badge>
                                  <Badge variant="outline" className="text-xs">
                                    Ticket: {formatCurrency(spending.ticket_medio)}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-xs px-1"
                                    onClick={() => {
                                      setDetailClient(client);
                                      setIsDetailOpen(true);
                                    }}
                                    aria-label={`Ver detalhes e consumo de ${client.name}`}
                                  >
                                    <Info className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <span className="text-muted-foreground text-sm">—</span>
                              )}
                            </TableCell>
                          )}
                          <TableCell className="max-w-xs truncate text-muted-foreground">
                            {client.notes || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => handleOpenDialog(client)}
                              aria-label={`Editar cliente ${client.name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
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

      {/* Modal de detalhes do cliente (consumo) */}
      {detailClient && (
        <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{detailClient.name}</DialogTitle>
              <DialogDescription>
                Consumo e ticket médio
              </DialogDescription>
            </DialogHeader>
            {(() => {
              const spending = getSpendingForClient(detailClient.id);
              if (!spending) {
                return (
                  <p className="text-muted-foreground text-sm py-4">
                    Nenhum consumo registrado.
                  </p>
                );
              }
              const formatDate = (d: string) => {
                try {
                  return new Date(d + "T12:00:00").toLocaleDateString("pt-BR", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  });
                } catch {
                  return d;
                }
              };
              return (
                <div className="space-y-4 py-2">
                  <div className="flex flex-wrap gap-2">
                    <Badge variant="secondary" className="text-sm">
                      Total: {formatCurrency(spending.total_amount)}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      Ticket médio: {formatCurrency(spending.ticket_medio)}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {spending.services_count} serviço{spending.services_count !== 1 ? "s" : ""}
                    </Badge>
                    <Badge variant="outline" className="text-sm">
                      {spending.products_count} produto{spending.products_count !== 1 ? "s" : ""}
                    </Badge>
                  </div>

                  {spending.services_detail.length > 0 && (
                    <div>
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Scissors className="h-4 w-4" />
                        Serviços realizados
                      </h4>
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
                      <h4 className="font-medium text-sm mb-2 flex items-center gap-2">
                        <Package className="h-4 w-4" />
                        Produtos comprados
                      </h4>
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
                </div>
              );
            })()}
          </DialogContent>
        </Dialog>
      )}
    </MainLayout>
  );
}
