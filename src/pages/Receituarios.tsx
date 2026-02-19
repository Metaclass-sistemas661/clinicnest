import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import {
  FilePlus2,
  Plus,
  Loader2,
  Search,
  Printer,
  User,
  Calendar,
  Pill,
  Copy,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Client {
  id: string;
  name: string;
  phone?: string;
}

interface Prescription {
  id: string;
  client_id: string;
  client_name: string;
  professional_name: string;
  issued_at: string;
  medications: string;
  instructions: string;
  validity_days: number;
  prescription_type: "simples" | "especial_b" | "especial_a";
  status: "ativo" | "expirado" | "cancelado";
}


const typeLabel: Record<string, string> = {
  simples: "Simples",
  especial_b: "Especial B (Tarja Preta)",
  especial_a: "Especial A (Entorpecente)",
};

const typeColors: Record<string, string> = {
  simples: "bg-blue-500/10 text-blue-600 border-blue-500/20",
  especial_b: "bg-yellow-500/10 text-yellow-700 border-yellow-500/20",
  especial_a: "bg-red-500/10 text-red-600 border-red-500/20",
};

const emptyForm = {
  client_id: "",
  medications: "",
  instructions: "",
  validity_days: "30",
  prescription_type: "simples" as const,
};

export default function Receituarios() {
  const { profile } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [prescriptions, setPrescriptions] = useState<Prescription[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [formData, setFormData] = useState(emptyForm);

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
      fetchPrescriptions();
    }
  }, [profile?.tenant_id]);

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (err) {
      logger.error("Error fetching clients:", err);
    }
  };

  const fetchPrescriptions = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("prescriptions")
        .select(`*, clients(name), profiles(full_name)`)
        .eq("tenant_id", profile.tenant_id)
        .order("issued_at", { ascending: false });
      if (error) throw error;
      const mapped: Prescription[] = (data || []).map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients?.name ?? "—",
        professional_name: r.profiles?.full_name ?? "—",
        issued_at: r.issued_at,
        medications: r.medications,
        instructions: r.instructions ?? "",
        validity_days: r.validity_days,
        prescription_type: r.prescription_type,
        status: r.status,
      }));
      setPrescriptions(mapped);
    } catch (err) {
      logger.error("Error fetching prescriptions:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) { toast.error("Selecione um paciente"); return; }
    if (!formData.medications.trim()) { toast.error("Adicione ao menos um medicamento"); return; }

    setIsSaving(true);
    try {
      const { error } = await supabase.from("prescriptions").insert({
        tenant_id: profile!.tenant_id,
        client_id: formData.client_id,
        professional_id: profile!.id,
        medications: formData.medications,
        instructions: formData.instructions || null,
        validity_days: Number(formData.validity_days),
        prescription_type: formData.prescription_type,
        status: "ativo",
      });
      if (error) throw error;
      toast.success("Receituário emitido com sucesso!");
      setIsDialogOpen(false);
      setFormData(emptyForm);
      fetchPrescriptions();
    } catch (err) {
      logger.error("Error saving prescription:", err);
      toast.error("Erro ao emitir receituário");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async (text: string, id: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedId(id);
    toast.success("Copiado para a área de transferência");
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = prescriptions.filter(
    (p) =>
      p.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.medications.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const isExpired = (p: Prescription) => {
    const issued = new Date(p.issued_at);
    const expiry = new Date(issued.getTime() + p.validity_days * 24 * 60 * 60 * 1000);
    return expiry < new Date();
  };

  return (
    <MainLayout
      title="Receituários"
      subtitle="Emissão e controle de receitas médicas"
      actions={
        <Button className="gradient-primary text-primary-foreground" onClick={() => setIsDialogOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Nova Receita
        </Button>
      }
    >
      {/* Busca */}
      <div className="mb-4 relative w-full md:max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Buscar por paciente ou medicamento..."
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full rounded-xl" />)}
        </div>
      ) : filtered.length === 0 ? (
        <EmptyState
          icon={FilePlus2}
          title="Nenhum receituário encontrado"
          description="Emita receitas médicas para seus pacientes."
          action={
            <Button className="gradient-primary text-primary-foreground" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />Nova Receita
            </Button>
          }
        />
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => {
            const expired = isExpired(p);
            return (
              <Card key={p.id} className={expired ? "opacity-70" : ""}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                        <User className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{p.client_name}</CardTitle>
                        <CardDescription className="flex items-center gap-2 mt-0.5">
                          <Calendar className="h-3.5 w-3.5" />
                          {new Date(p.issued_at).toLocaleDateString("pt-BR")}
                          <span>·</span>
                          {p.professional_name}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={typeColors[p.prescription_type]}>
                        {typeLabel[p.prescription_type]}
                      </Badge>
                      {expired ? (
                        <Badge variant="outline" className="bg-muted text-muted-foreground">
                          Expirado
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-success/20 text-success border-success/30">
                          Válido por {p.validity_days} dias
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="pt-0 space-y-3">
                  <div className="rounded-lg bg-muted/50 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 text-sm font-medium">
                        <Pill className="h-4 w-4 text-primary" />
                        Medicamentos
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => handleCopy(p.medications, p.id)}
                      >
                        {copiedId === p.id ? (
                          <><CheckCheck className="h-3.5 w-3.5 mr-1 text-success" />Copiado</>
                        ) : (
                          <><Copy className="h-3.5 w-3.5 mr-1" />Copiar</>
                        )}
                      </Button>
                    </div>
                    <pre className="text-sm text-muted-foreground whitespace-pre-wrap font-sans leading-relaxed">
                      {p.medications}
                    </pre>
                  </div>
                  {p.instructions && (
                    <div className="text-sm text-muted-foreground">
                      <span className="font-medium text-foreground">Instruções: </span>
                      {p.instructions}
                    </div>
                  )}
                  <div className="flex justify-end">
                    <Button variant="outline" size="sm" onClick={() => window.print()}>
                      <Printer className="h-3.5 w-3.5 mr-1.5" />
                      Imprimir
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Nova Receita Médica</DialogTitle>
            <DialogDescription>Emita uma receita para o paciente</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Tipo de Receita</Label>
                  <Select
                    value={formData.prescription_type}
                    onValueChange={(v: any) => setFormData({ ...formData, prescription_type: v })}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="simples">Simples</SelectItem>
                      <SelectItem value="especial_b">Especial B (Tarja Preta)</SelectItem>
                      <SelectItem value="especial_a">Especial A (Entorpecente)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Validade (dias)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={formData.validity_days}
                    onChange={(e) => setFormData({ ...formData, validity_days: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Medicamentos e Posologia *</Label>
                <Textarea
                  value={formData.medications}
                  onChange={(e) => setFormData({ ...formData, medications: e.target.value })}
                  placeholder={"1. Amoxicilina 500mg\n   - 1 cápsula a cada 8h por 7 dias\n\n2. Dipirona 500mg\n   - 1 comprimido se dor (máx. 4x/dia)"}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
              <div className="space-y-2">
                <Label>Instruções ao Paciente</Label>
                <Textarea
                  value={formData.instructions}
                  onChange={(e) => setFormData({ ...formData, instructions: e.target.value })}
                  placeholder="Orientações gerais, cuidados, restrições alimentares..."
                  rows={3}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>Cancelar</Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Emitindo...</> : "Emitir Receita"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
