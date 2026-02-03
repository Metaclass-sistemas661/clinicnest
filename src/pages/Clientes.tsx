import { useState, useEffect } from "react";
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
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Users, Plus, Loader2, Phone, Mail, Search, Pencil, Scissors, Package, DollarSign } from "lucide-react";
import { toast } from "sonner";
import type { Client } from "@/types/database";
import { fetchClientSpendingAllTime, type ClientSpendingRow } from "@/lib/clientSpending";

export default function Clientes() {
  const { profile, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const [clientSpending, setClientSpending] = useState<ClientSpendingRow[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);

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

  useEffect(() => {
    const filtered = clients.filter(
      (client) =>
        client.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        client.phone?.includes(searchQuery) ||
        client.email?.toLowerCase().includes(searchQuery.toLowerCase())
    );
    setFilteredClients(filtered);
  }, [clients, searchQuery]);

  const fetchClientSpending = async () => {
    if (!profile?.tenant_id) return;
    try {
      const data = await fetchClientSpendingAllTime(profile.tenant_id);
      setClientSpending(data);
    } catch (err) {
      console.error("Error fetching client spending:", err);
      toast.error("Erro ao carregar consumo dos clientes.");
    }
  };

  const getSpendingForClient = (clientId: string): ClientSpendingRow | undefined =>
    clientSpending.find((s) => s.client_id === clientId);

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(value);

  const sortedAndFilteredClients = [...filteredClients].sort((a, b) => {
    if (!isAdmin || clientSpending.length === 0) return 0;
    const sa = getSpendingForClient(a.id)?.total_amount ?? 0;
    const sb = getSpendingForClient(b.id)?.total_amount ?? 0;
    return sb - sa;
  });

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data, error } = await supabase
        .from("clients")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");

      if (error) throw error;
      setClients((data as Client[]) || []);
      setFilteredClients((data as Client[]) || []);
    } catch (error) {
      console.error("Error fetching clients:", error);
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

    setIsSaving(true);

    try {
      const clientData = {
        tenant_id: profile.tenant_id,
        name: formData.name,
        phone: formData.phone || null,
        email: formData.email || null,
        notes: formData.notes || null,
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
      console.error(error);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <MainLayout
      title="Clientes"
      subtitle="Gerencie seus clientes"
      actions={
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gradient-primary text-primary-foreground" onClick={() => handleOpenDialog()}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Cliente
            </Button>
          </DialogTrigger>
          <DialogContent>
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
                <div className="space-y-2">
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
      {/* Search */}
      <div className="mb-4 md:mb-6">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nome, telefone ou email..."
            className="pl-10"
          />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            {isLoading ? "Clientes Cadastrados" : `Clientes Cadastrados (${filteredClients.length})`}
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
            <div className="flex flex-col items-center justify-center py-12">
              <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-muted-foreground">
                {searchQuery ? "Nenhum cliente encontrado" : "Nenhum cliente cadastrado"}
              </p>
            </div>
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
                                <div className="flex flex-wrap gap-1.5">
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
    </MainLayout>
  );
}
