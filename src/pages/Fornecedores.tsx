import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { z } from "zod";
import {
  Plus,
  Pencil,
  Trash2,
  Loader2,
  Truck,
  Search,
  Phone,
  Mail,
  FileText,
  RefreshCw,
} from "lucide-react";

/* ── Types ─────────────────────────────────────────── */

type SupplierRow = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  document: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
};

type SupplierFormState = {
  name: string;
  phone: string;
  email: string;
  document: string;
  notes: string;
};

const emptyForm: SupplierFormState = {
  name: "",
  phone: "",
  email: "",
  document: "",
  notes: "",
};

const supplierSchema = z.object({
  name: z.string().min(1, "Nome é obrigatório"),
  phone: z.string().optional(),
  email: z.string().email("Email inválido").or(z.literal("")).optional(),
  document: z.string().optional(),
  notes: z.string().optional(),
});

/* ── Component ─────────────────────────────────────── */

export default function Fornecedores() {
  const { profile, isAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [rows, setRows] = useState<SupplierRow[]>([]);
  const [query, setQuery] = useState("");

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);
  const [form, setForm] = useState<SupplierFormState>(emptyForm);

  const [deleteTarget, setDeleteTarget] = useState<SupplierRow | null>(null);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        (r.phone || "").toLowerCase().includes(q) ||
        (r.email || "").toLowerCase().includes(q) ||
        (r.document || "").toLowerCase().includes(q)
    );
  }, [rows, query]);

  /* ── Data fetching ── */

  const fetchSuppliers = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("suppliers")
        .select("id,name,phone,email,document,notes,created_at,updated_at")
        .eq("tenant_id", profile.tenant_id)
        .order("name", { ascending: true });

      if (error) throw error;
      setRows((data || []) as SupplierRow[]);
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao carregar fornecedores");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!profile?.tenant_id || !isAdmin) return;
    fetchSuppliers().catch(() => {});
  }, [profile?.tenant_id, isAdmin]);

  /* ── CRUD actions ── */

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (row: SupplierRow) => {
    setEditing(row);
    setForm({
      name: row.name || "",
      phone: row.phone || "",
      email: row.email || "",
      document: row.document || "",
      notes: row.notes || "",
    });
    setDialogOpen(true);
  };

  const submitSupplier = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.tenant_id || !isAdmin) return;

    const parsed = supplierSchema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.errors[0]?.message ?? "Verifique os dados");
      return;
    }

    const name = form.name.trim();
    setIsSaving(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("suppliers")
          .update({
            name,
            phone: form.phone.trim() || null,
            email: form.email.trim() || null,
            document: form.document.trim() || null,
            notes: form.notes.trim() || null,
          })
          .eq("id", editing.id)
          .eq("tenant_id", profile.tenant_id);

        if (error) throw error;
        toast.success("Fornecedor atualizado!");
      } else {
        const { error } = await supabase.from("suppliers").insert({
          tenant_id: profile.tenant_id,
          name,
          phone: form.phone.trim() || null,
          email: form.email.trim() || null,
          document: form.document.trim() || null,
          notes: form.notes.trim() || null,
        });

        if (error) throw error;
        toast.success("Fornecedor cadastrado!");
      }

      setDialogOpen(false);
      setEditing(null);
      setForm(emptyForm);
      await fetchSuppliers();
    } catch (e) {
      logger.error(e);
      toast.error(editing ? "Erro ao atualizar fornecedor" : "Erro ao criar fornecedor");
    } finally {
      setIsSaving(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleteTarget || !profile?.tenant_id || !isAdmin) return;

    setIsSaving(true);
    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", deleteTarget.id)
        .eq("tenant_id", profile.tenant_id);

      if (error) throw error;
      toast.success("Fornecedor excluído");
      setDeleteTarget(null);
      await fetchSuppliers();
    } catch (e) {
      logger.error(e);
      toast.error("Erro ao excluir fornecedor. Verifique se não há compras vinculadas.");
    } finally {
      setIsSaving(false);
    }
  };

  /* ── Guard: admin only ── */

  if (!isAdmin) {
    return (
      <MainLayout title="Fornecedores" subtitle="Acesso restrito">
        <EmptyState
          icon={Truck}
          title="Acesso restrito"
          description="Apenas administradores podem gerenciar fornecedores."
        />
      </MainLayout>
    );
  }

  /* ── Render ── */

  return (
    <MainLayout
      title="Fornecedores"
      subtitle="Cadastre e gerencie seus fornecedores"
      actions={
        <Button
          className="gradient-primary text-primary-foreground"
          onClick={openCreate}
          disabled={isSaving}
          data-tour="suppliers-new"
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Fornecedor
        </Button>
      }
    >
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Truck}
          title="Nenhum fornecedor cadastrado"
          description="Cadastre seu primeiro fornecedor para vincular às compras de produtos."
          action={
            <Button className="gradient-primary text-primary-foreground" onClick={openCreate}>
              <Plus className="mr-2 h-4 w-4" />
              Cadastrar Fornecedor
            </Button>
          }
        />
      ) : (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Fornecedores ({filteredRows.length})</CardTitle>
              <div className="flex items-center gap-2">
                <div className="relative flex-1 sm:w-64">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar por nome, telefone..."
                    className="pl-9"
                  />
                </div>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchSuppliers}
                  disabled={isLoading}
                  aria-label="Atualizar lista"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {filteredRows.length === 0 ? (
              <EmptyState
                icon={Search}
                title="Nenhum resultado"
                description={`Nenhum fornecedor encontrado para "${query}".`}
              />
            ) : (
              <>
                {/* Mobile: Card Layout */}
                <div className="block md:hidden space-y-3">
                  {filteredRows.map((r) => (
                    <div
                      key={r.id}
                      className="rounded-lg border p-4 space-y-2 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <p className="font-medium truncate">{r.name}</p>
                        <div className="flex gap-1 shrink-0">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEdit(r)}
                            aria-label={`Editar ${r.name}`}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget(r)}
                            aria-label={`Excluir ${r.name}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        {r.phone && (
                          <p className="flex items-center gap-1.5">
                            <Phone className="h-3 w-3" />
                            {r.phone}
                          </p>
                        )}
                        {r.email && (
                          <p className="flex items-center gap-1.5 truncate">
                            <Mail className="h-3 w-3" />
                            {r.email}
                          </p>
                        )}
                        {r.document && (
                          <p className="flex items-center gap-1.5">
                            <FileText className="h-3 w-3" />
                            {r.document}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop: Table Layout */}
                <div className="hidden md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Nome</TableHead>
                        <TableHead>Telefone</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead className="w-28 text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRows.map((r) => (
                        <TableRow key={r.id}>
                          <TableCell className="font-medium">{r.name}</TableCell>
                          <TableCell className="text-muted-foreground">{r.phone || "—"}</TableCell>
                          <TableCell className="text-muted-foreground max-w-[260px] truncate">
                            {r.email || "—"}
                          </TableCell>
                          <TableCell className="text-muted-foreground max-w-[180px] truncate">
                            {r.document || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                onClick={() => openEdit(r)}
                                disabled={isSaving}
                                aria-label={`Editar ${r.name}`}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="text-destructive hover:text-destructive"
                                onClick={() => setDeleteTarget(r)}
                                disabled={isSaving}
                                aria-label={`Excluir ${r.name}`}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
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
      )}

      {/* Dialog: Create / Edit */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar Fornecedor" : "Novo Fornecedor"}</DialogTitle>
            <DialogDescription>
              {editing
                ? "Atualize as informações do fornecedor."
                : "Preencha os dados para cadastrar um novo fornecedor."}
            </DialogDescription>
          </DialogHeader>

          <form className="space-y-4 py-2" onSubmit={submitSupplier}>
            <div className="space-y-2">
              <Label>
                Nome <span className="text-destructive">*</span>
              </Label>
              <Input
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                placeholder="Ex: Distribuidora ABC"
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Telefone</Label>
                <Input
                  value={form.phone}
                  onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="(11) 99999-9999"
                />
              </div>
              <div className="space-y-2">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contato@fornecedor.com"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label>CPF/CNPJ</Label>
              <Input
                value={form.document}
                onChange={(e) => setForm((p) => ({ ...p, document: e.target.value }))}
                placeholder="Somente números"
                inputMode="numeric"
              />
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))}
                rows={3}
                placeholder="Informações adicionais sobre o fornecedor..."
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isSaving}
                className="gradient-primary text-primary-foreground"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Salvando...
                  </>
                ) : editing ? (
                  "Salvar Alterações"
                ) : (
                  "Cadastrar Fornecedor"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* AlertDialog: Confirm Delete */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir fornecedor</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? Esta ação não pode
              ser desfeita. Fornecedores com compras vinculadas não podem ser excluídos.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={confirmDelete}
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Excluindo...
                </>
              ) : (
                "Excluir"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
