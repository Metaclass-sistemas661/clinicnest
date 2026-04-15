import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Building2,
  Plus,
  Search,
  Pencil,
  Phone,
  CreditCard,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface Convenio {
  id: string;
  name: string;
  ans_code: string;
  contact_phone: string;
  contact_email: string;
  reimbursement_days: number;
  requires_authorization: boolean;
  tiss_version: string;
  notes: string;
  is_active: boolean;
  created_at: string;
}

const TISS_VERSIONS = ["3.05.00", "4.00.00", "4.01.00"];

const emptyForm = {
  name: "",
  ans_code: "",
  contact_phone: "",
  contact_email: "",
  reimbursement_days: "30",
  requires_authorization: false,
  tiss_version: "3.05.00",
  notes: "",
  is_active: true,
};

export default function Convenios() {
  const { profile } = useAuth();
  const [convenios, setConvenios] = useState<Convenio[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (profile?.tenant_id) fetchConvenios();
  }, [profile?.tenant_id]);

  const fetchConvenios = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from("insurance_plans")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      const mapped: Convenio[] = (data || []).map((r: any) => ({
        id: r.id,
        name: r.name,
        ans_code: r.ans_code ?? "",
        contact_phone: r.contact_phone ?? "",
        contact_email: r.contact_email ?? "",
        reimbursement_days: r.reimbursement_days ?? 30,
        requires_authorization: r.requires_authorization ?? false,
        tiss_version: r.tiss_version ?? "3.05.00",
        notes: r.notes ?? "",
        is_active: r.is_active,
        created_at: r.created_at,
      }));
      setConvenios(mapped);
    } catch (err) {
      logger.error("Error fetching insurance plans:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const filtered = convenios.filter(
    (c) =>
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.ans_code.includes(searchQuery)
  );

  const handleOpen = (convenio?: Convenio) => {
    if (convenio) {
      setEditingId(convenio.id);
      setFormData({
        name: convenio.name,
        ans_code: convenio.ans_code,
        contact_phone: convenio.contact_phone,
        contact_email: convenio.contact_email,
        reimbursement_days: String(convenio.reimbursement_days),
        requires_authorization: convenio.requires_authorization,
        tiss_version: convenio.tiss_version,
        notes: convenio.notes,
        is_active: convenio.is_active,
      });
    } else {
      setEditingId(null);
      setFormData(emptyForm);
    }
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name.trim()) {
      toast.error("Nome do convênio é obrigatório");
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name: formData.name,
        ans_code: formData.ans_code || null,
        contact_phone: formData.contact_phone || null,
        contact_email: formData.contact_email || null,
        reimbursement_days: Number(formData.reimbursement_days),
        requires_authorization: formData.requires_authorization,
        tiss_version: formData.tiss_version || null,
        notes: formData.notes || null,
        is_active: formData.is_active,
      };
      if (editingId) {
        const { error } = await api
          .from("insurance_plans")
          .update(payload)
          .eq("id", editingId)
          .eq("tenant_id", profile!.tenant_id);
        if (error) throw error;
        toast.success("Convênio atualizado!");
      } else {
        const { error } = await api
          .from("insurance_plans")
          .insert({ ...payload, tenant_id: profile!.tenant_id });
        if (error) throw error;
        toast.success("Convênio cadastrado!");
      }
      setIsDialogOpen(false);
      fetchConvenios();
    } catch (err) {
      logger.error("Error saving insurance plan:", err);
      toast.error("Erro ao salvar convênio");
    } finally {
      setIsSaving(false);
    }
  };

  const toggleActive = async (id: string, current: boolean) => {
    try {
      const { error } = await api
        .from("insurance_plans")
        .update({ is_active: !current })
        .eq("id", id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      setConvenios((prev) =>
        prev.map((c) => (c.id === id ? { ...c, is_active: !current } : c))
      );
    } catch (err) {
      logger.error("Error toggling insurance plan:", err);
      toast.error("Erro ao atualizar status");
    }
  };

  const activeCount = convenios.filter((c) => c.is_active).length;

  return (
    <MainLayout
      title="Convênios & Planos de Saúde"
      subtitle="Gerencie os planos de saúde credenciados na clínica"
      actions={
        <Button variant="gradient" onClick={() => handleOpen()}>
          <Plus className="mr-2 h-4 w-4" />
          Novo Convênio
        </Button>
      }
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Convênios</p>
              <p className="text-2xl font-bold">{convenios.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-success/10">
              <CheckCircle2 className="h-5 w-5 text-success" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ativos</p>
              <p className="text-2xl font-bold">{activeCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
              <CreditCard className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Prazo Médio Reembolso</p>
              <p className="text-2xl font-bold">
                {convenios.length > 0
                  ? Math.round(
                      convenios.reduce((s, c) => s + c.reimbursement_days, 0) / convenios.length
                    )
                  : 0}{" "}
                dias
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Busca */}
      <div className="mb-4 relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por nome ou código ANS..."
          className="pl-10"
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Convênios Cadastrados ({filtered.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {filtered.length === 0 ? (
            <EmptyState
              icon={Building2}
              title="Nenhum convênio encontrado"
              description="Cadastre os planos de saúde credenciados na clínica."
              action={
                <Button variant="gradient" onClick={() => handleOpen()}>
                  <Plus className="mr-2 h-4 w-4" />
                  Novo Convênio
                </Button>
              }
            />
          ) : (
            <>
              {/* Mobile */}
              <div className="block md:hidden space-y-3">
                {filtered.map((c) => (
                  <div key={c.id} className={`rounded-lg border p-4 space-y-2 ${!c.is_active ? "opacity-60" : ""}`}>
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{c.name}</p>
                        {c.ans_code && (
                          <p className="text-xs text-muted-foreground font-mono">ANS: {c.ans_code}</p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={c.is_active ? "bg-success/20 text-success border-success/30" : "bg-muted text-muted-foreground"}
                      >
                        {c.is_active ? "Ativo" : "Inativo"}
                      </Badge>
                    </div>
                    {c.contact_phone && (
                      <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                        <Phone className="h-3.5 w-3.5" />{c.contact_phone}
                      </div>
                    )}
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CreditCard className="h-3.5 w-3.5" />
                      Reembolso em {c.reimbursement_days} dias
                    </div>
                    <div className="flex items-center gap-2 pt-2 border-t">
                      <Button variant="ghost" size="sm" onClick={() => handleOpen(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Convênio</TableHead>
                      <TableHead>Código ANS</TableHead>
                      <TableHead>Contato</TableHead>
                      <TableHead>Reembolso</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map((c) => (
                      <TableRow key={c.id} className={!c.is_active ? "opacity-60" : ""}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{c.name}</p>
                            {c.notes && (
                              <p className="text-xs text-muted-foreground line-clamp-1">{c.notes}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="font-mono text-sm">{c.ans_code || "—"}</TableCell>
                        <TableCell>
                          <div className="space-y-0.5">
                            {c.contact_phone && (
                              <div className="flex items-center gap-1 text-sm text-muted-foreground">
                                <Phone className="h-3.5 w-3.5" />{c.contact_phone}
                              </div>
                            )}
                            {c.contact_email && (
                              <div className="text-xs text-muted-foreground truncate max-w-[180px]">
                                {c.contact_email}
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                            {c.reimbursement_days} dias
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={c.is_active ? "bg-success/20 text-success border-success/30" : "bg-muted text-muted-foreground"}
                          >
                            {c.is_active ? "Ativo" : "Inativo"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon" onClick={() => handleOpen(c)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Switch checked={c.is_active} onCheckedChange={() => toggleActive(c.id, c.is_active)} />
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

      {/* FormDrawer */}
      <FormDrawer
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        title={editingId ? "Editar Convênio" : "Novo Convênio"}
        description={editingId ? "Atualize os dados do convênio" : "Cadastre um novo plano de saúde"}
        width="md"
        onSubmit={handleSubmit}
        isSubmitting={isSaving}
        submitLabel={editingId ? "Atualizar" : "Cadastrar"}
      >
        <FormDrawerSection title="Identificação">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Nome do Convênio *</Label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Ex: Unimed, Bradesco Saúde..."
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Código ANS</Label>
                <Input
                  value={formData.ans_code}
                  onChange={(e) => setFormData({ ...formData, ans_code: e.target.value })}
                  placeholder="000.000"
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label>Prazo de Reembolso (dias)</Label>
                <Input
                  type="number"
                  min="1"
                  max="90"
                  value={formData.reimbursement_days}
                  onChange={(e) => setFormData({ ...formData, reimbursement_days: e.target.value })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Versão TISS</Label>
              <Select
                value={formData.tiss_version}
                onValueChange={(v) => setFormData({ ...formData, tiss_version: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione a versão" />
                </SelectTrigger>
                <SelectContent>
                  {TISS_VERSIONS.map((v) => (
                    <SelectItem key={v} value={v}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Versão do padrão TISS usado pela operadora</p>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Exige Autorização Prévia</Label>
                <p className="text-sm text-muted-foreground">Requer número de autorização antes de agendar</p>
              </div>
              <Switch
                checked={formData.requires_authorization}
                onCheckedChange={(checked) => setFormData({ ...formData, requires_authorization: checked })}
              />
            </div>
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Contato">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Telefone de Contato</Label>
              <Input
                value={formData.contact_phone}
                onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                placeholder="0800 000 0000"
              />
            </div>
            <div className="space-y-2">
              <Label>E-mail de Contato</Label>
              <Input
                type="email"
                value={formData.contact_email}
                onChange={(e) => setFormData({ ...formData, contact_email: e.target.value })}
                placeholder="credenciamento@convenio.com.br"
              />
            </div>
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Observações e Status">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Observações / Instruções</Label>
              <Textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="Regras de faturamento, prazos especiais, documentações necessárias..."
                rows={3}
              />
            </div>
            <div className="flex items-center justify-between rounded-lg border p-4">
              <div>
                <Label>Convênio Ativo</Label>
                <p className="text-sm text-muted-foreground">Convênios inativos não aparecem no agendamento</p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
              />
            </div>
          </div>
        </FormDrawerSection>
      </FormDrawer>
    </MainLayout>
  );
}
