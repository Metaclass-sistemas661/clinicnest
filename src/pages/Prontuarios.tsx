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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  ClipboardList,
  Plus,
  Loader2,
  Search,
  Pencil,
  User,
  Calendar,
  FileText,
  AlertCircle,
  Pill,
  Heart,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

interface Client {
  id: string;
  name: string;
  phone?: string;
  email?: string;
}

interface MedicalRecord {
  id: string;
  client_id: string;
  client_name: string;
  appointment_date: string;
  professional_name: string;
  chief_complaint: string;
  anamnesis: string;
  physical_exam: string;
  diagnosis: string;
  cid_code: string;
  treatment_plan: string;
  prescriptions: string;
  notes: string;
  created_at: string;
}


export default function Prontuarios() {
  const { profile, isAdmin } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [records, setRecords] = useState<MedicalRecord[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null);
  const [selectedClientId, setSelectedClientId] = useState("");

  const [formData, setFormData] = useState({
    client_id: "",
    chief_complaint: "",
    anamnesis: "",
    physical_exam: "",
    diagnosis: "",
    cid_code: "",
    treatment_plan: "",
    prescriptions: "",
    notes: "",
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchClients();
      fetchRecords();
    }
  }, [profile?.tenant_id]);

  const fetchClients = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("clients")
        .select("id, name, phone, email")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setClients((data as Client[]) || []);
    } catch (err) {
      logger.error("Error fetching clients:", err);
    }
  };

  const fetchRecords = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .select(`*, clients(name), profiles(full_name)`)
        .eq("tenant_id", profile.tenant_id)
        .order("record_date", { ascending: false });
      if (error) throw error;
      const mapped: MedicalRecord[] = (data || []).map((r: any) => ({
        id: r.id,
        client_id: r.client_id,
        client_name: r.clients?.name ?? "—",
        appointment_date: r.record_date,
        professional_name: r.profiles?.full_name ?? "—",
        chief_complaint: r.chief_complaint ?? "",
        anamnesis: r.anamnesis ?? "",
        physical_exam: r.physical_exam ?? "",
        diagnosis: r.diagnosis ?? "",
        cid_code: r.cid_code ?? "",
        treatment_plan: r.treatment_plan ?? "",
        prescriptions: r.prescriptions ?? "",
        notes: r.notes ?? "",
        created_at: r.created_at,
      }));
      setRecords(mapped);
    } catch (err) {
      logger.error("Error fetching medical records:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.client_id) {
      toast.error("Selecione um paciente");
      return;
    }
    if (!formData.chief_complaint.trim()) {
      toast.error("Queixa principal é obrigatória");
      return;
    }
    setIsSaving(true);
    try {
      const { error } = await supabase.from("medical_records").insert({
        tenant_id: profile!.tenant_id,
        professional_id: profile!.id,
        client_id: formData.client_id,
        chief_complaint: formData.chief_complaint,
        anamnesis: formData.anamnesis || null,
        physical_exam: formData.physical_exam || null,
        diagnosis: formData.diagnosis || null,
        cid_code: formData.cid_code || null,
        treatment_plan: formData.treatment_plan || null,
        prescriptions: formData.prescriptions || null,
        notes: formData.notes || null,
      });
      if (error) throw error;
      toast.success("Prontuário salvo com sucesso!");
      setIsDialogOpen(false);
      setFormData({ client_id: "", chief_complaint: "", anamnesis: "", physical_exam: "", diagnosis: "", cid_code: "", treatment_plan: "", prescriptions: "", notes: "" });
      fetchRecords();
    } catch (err) {
      logger.error("Error saving medical record:", err);
      toast.error("Erro ao salvar prontuário");
    } finally {
      setIsSaving(false);
    }
  };

  const filteredRecords = records.filter((r) =>
    r.client_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.diagnosis.toLowerCase().includes(searchQuery.toLowerCase()) ||
    r.cid_code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const clientRecords = selectedClientId
    ? filteredRecords.filter((r) => r.client_id === selectedClientId)
    : filteredRecords;

  return (
    <MainLayout
      title="Prontuários Eletrônicos"
      subtitle="Histórico clínico completo dos pacientes"
      actions={
        <Button
          className="gradient-primary text-primary-foreground"
          onClick={() => setIsDialogOpen(true)}
        >
          <Plus className="mr-2 h-4 w-4" />
          Novo Prontuário
        </Button>
      }
    >
      {/* Busca + Filtro */}
      <div className="mb-4 md:mb-6 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por paciente, diagnóstico ou CID..."
            className="pl-10"
          />
        </div>
        <Select value={selectedClientId} onValueChange={setSelectedClientId}>
          <SelectTrigger className="w-full sm:w-64">
            <SelectValue placeholder="Filtrar por paciente" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">Todos os pacientes</SelectItem>
            {clients.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Lista de Prontuários */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      ) : clientRecords.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="Nenhum prontuário encontrado"
          description="Crie o primeiro prontuário clínico para seus pacientes."
          action={
            <Button className="gradient-primary text-primary-foreground" onClick={() => setIsDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Novo Prontuário
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {clientRecords.map((record) => (
            <Card key={record.id} className="overflow-hidden">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{record.client_name}</CardTitle>
                      <CardDescription className="flex items-center gap-2 mt-0.5">
                        <Calendar className="h-3.5 w-3.5" />
                        {new Date(record.appointment_date).toLocaleDateString("pt-BR")}
                        <span>·</span>
                        {record.professional_name}
                      </CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {record.cid_code && (
                      <Badge variant="outline" className="text-xs font-mono">
                        CID: {record.cid_code}
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setExpandedRecord(expandedRecord === record.id ? null : record.id)}
                    >
                      {expandedRecord === record.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="pt-0">
                {/* Resumo sempre visível */}
                <div className="rounded-lg bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-medium text-muted-foreground">Queixa: </span>
                  {record.chief_complaint}
                </div>

                {/* Detalhes expandíveis */}
                {expandedRecord === record.id && (
                  <Tabs defaultValue="anamnese" className="mt-4">
                    <TabsList className="grid w-full grid-cols-4 h-auto gap-1 p-1">
                      <TabsTrigger value="anamnese" className="text-xs py-2">
                        <FileText className="h-3 w-3 mr-1" />Anamnese
                      </TabsTrigger>
                      <TabsTrigger value="exame" className="text-xs py-2">
                        <Heart className="h-3 w-3 mr-1" />Exame
                      </TabsTrigger>
                      <TabsTrigger value="diagnostico" className="text-xs py-2">
                        <AlertCircle className="h-3 w-3 mr-1" />Diagnóstico
                      </TabsTrigger>
                      <TabsTrigger value="prescricao" className="text-xs py-2">
                        <Pill className="h-3 w-3 mr-1" />Prescrição
                      </TabsTrigger>
                    </TabsList>

                    <TabsContent value="anamnese" className="mt-3 space-y-2 text-sm">
                      <p className="text-muted-foreground">{record.anamnesis || "—"}</p>
                    </TabsContent>
                    <TabsContent value="exame" className="mt-3 space-y-2 text-sm">
                      <p className="text-muted-foreground">{record.physical_exam || "—"}</p>
                    </TabsContent>
                    <TabsContent value="diagnostico" className="mt-3 space-y-2 text-sm">
                      <div className="space-y-2">
                        <div><span className="font-medium">Diagnóstico: </span>{record.diagnosis || "—"}</div>
                        <div><span className="font-medium">Plano terapêutico: </span>{record.treatment_plan || "—"}</div>
                        {record.notes && <div><span className="font-medium">Observações: </span>{record.notes}</div>}
                      </div>
                    </TabsContent>
                    <TabsContent value="prescricao" className="mt-3 space-y-2 text-sm">
                      <p className="text-muted-foreground whitespace-pre-line">{record.prescriptions || "Nenhuma prescrição registrada."}</p>
                    </TabsContent>
                  </Tabs>
                )}

                {expandedRecord === record.id && isAdmin && (
                  <div className="mt-3 flex justify-end">
                    <Button variant="outline" size="sm">
                      <Pencil className="h-3.5 w-3.5 mr-1.5" />
                      Editar Prontuário
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Novo Prontuário */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Novo Prontuário</DialogTitle>
            <DialogDescription>Registre o atendimento clínico do paciente</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label>Paciente *</Label>
                <Select value={formData.client_id} onValueChange={(v) => setFormData({ ...formData, client_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione o paciente" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Queixa Principal *</Label>
                <Input
                  value={formData.chief_complaint}
                  onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                  placeholder="Motivo da consulta..."
                />
              </div>

              <div className="space-y-2">
                <Label>Anamnese</Label>
                <Textarea
                  value={formData.anamnesis}
                  onChange={(e) => setFormData({ ...formData, anamnesis: e.target.value })}
                  placeholder="HDA, antecedentes pessoais, familiares, medicamentos em uso, alergias..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label>Exame Físico</Label>
                <Textarea
                  value={formData.physical_exam}
                  onChange={(e) => setFormData({ ...formData, physical_exam: e.target.value })}
                  placeholder="PA, FC, FR, temperatura, achados ao exame..."
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Diagnóstico</Label>
                  <Input
                    value={formData.diagnosis}
                    onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                    placeholder="Diagnóstico clínico"
                  />
                </div>
                <div className="space-y-2">
                  <Label>CID-10</Label>
                  <Input
                    value={formData.cid_code}
                    onChange={(e) => setFormData({ ...formData, cid_code: e.target.value.toUpperCase() })}
                    placeholder="Ex: J06.9"
                    className="font-mono"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Plano Terapêutico / Conduta</Label>
                <Textarea
                  value={formData.treatment_plan}
                  onChange={(e) => setFormData({ ...formData, treatment_plan: e.target.value })}
                  placeholder="Orientações, encaminhamentos, retorno..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Prescrições</Label>
                <Textarea
                  value={formData.prescriptions}
                  onChange={(e) => setFormData({ ...formData, prescriptions: e.target.value })}
                  placeholder="Medicamentos, posologia, duração..."
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label>Observações Adicionais</Label>
                <Textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  placeholder="Notas internas, próxima consulta..."
                  rows={2}
                />
              </div>
            </div>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving} className="gradient-primary text-primary-foreground">
                {isSaving ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</>
                ) : (
                  "Salvar Prontuário"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
