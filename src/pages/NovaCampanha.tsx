import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ArrowLeft, ArrowRight, Check, Loader2, Send, Users, Eye, Mail } from "lucide-react";

type PatientEntry = { id: string; name: string | null; email: string };

const STEPS = [
  { id: 1, title: "Conteúdo", description: "Nome, assunto e HTML" },
  { id: 2, title: "Segmentação", description: "Escolha os destinatários" },
  { id: 3, title: "Preview", description: "Revise antes de salvar" },
];

export default function NovaCampanha() {
  const navigate = useNavigate();
  const { profile, tenant } = useAuth();
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [preheader, setPreheader] = useState("");
  const [html, setHtml] = useState("");

  const [sendMode, setSendMode] = useState<"all" | "selected">("all");
  const [patients, setPatients] = useState<PatientEntry[]>([]);
  const [isLoadingPatients, setIsLoadingPatients] = useState(false);
  const [patientSearch, setPatientSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadPatients = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoadingPatients(true);
    try {
      const { data } = await supabase
        .from("patients")
        .select("id, name, email")
        .eq("tenant_id", profile.tenant_id)
        .not("email", "is", null)
        .order("name")
        .limit(500);
      setPatients(
        ((data || []) as { id: string; name: string | null; email: string | null }[])
          .filter((c) => !!c.email)
          .map((c) => ({ id: c.id, name: c.name, email: c.email! }))
      );
    } catch (err) {
      logger.error(err);
    } finally {
      setIsLoadingPatients(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (step === 2) loadPatients();
  }, [step, loadPatients]);

  const filteredPatients = patients.filter((c) => {
    const q = patientSearch.toLowerCase();
    return !q || (c.name ?? "").toLowerCase().includes(q) || c.email.toLowerCase().includes(q);
  });

  const togglePatient = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (selectedIds.size === filteredPatients.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filteredPatients.map((c) => c.id)));
    }
  };

  const canProceed = () => {
    if (step === 1) return name.trim() && subject.trim() && html.trim();
    if (step === 2) return sendMode === "all" || selectedIds.size > 0;
    return true;
  };

  const handleSave = async () => {
    if (!profile?.tenant_id) return;
    setIsSaving(true);
    try {
      const db: any = supabase;
      const { error } = await db.from("campaigns").insert({
        tenant_id: profile.tenant_id,
        name: name.trim(),
        subject: subject.trim(),
        preheader: preheader.trim() || null,
        html: html,
        status: "draft",
        created_by: profile.user_id ?? null,
      });
      if (error) throw error;
      toast.success("Campanha criada com sucesso!");
      navigate("/campanhas");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao criar campanha");
    } finally {
      setIsSaving(false);
    }
  };

  const defaultClinicName = tenant?.name ?? profile?.full_name ?? "Minha Clínica";

  return (
    <MainLayout
      title="Nova Campanha"
      subtitle="Crie uma campanha de email marketing"
      actions={
        <Button variant="outline" onClick={() => navigate("/campanhas")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      {/* Stepper */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                step > s.id ? "bg-primary border-primary text-primary-foreground" :
                step === s.id ? "border-primary text-primary" : "border-muted text-muted-foreground"
              }`}>
                {step > s.id ? <Check className="h-5 w-5" /> : s.id}
              </div>
              <div className="ml-3 hidden sm:block">
                <p className={`text-sm font-medium ${step >= s.id ? "text-foreground" : "text-muted-foreground"}`}>
                  {s.title}
                </p>
                <p className="text-xs text-muted-foreground">{s.description}</p>
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 sm:w-24 h-0.5 mx-4 ${step > s.id ? "bg-primary" : "bg-muted"}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          {/* Step 1: Conteúdo */}
          {step === 1 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Nome da campanha *</Label>
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex: Promoção de Verão" />
                </div>
                <div className="space-y-2">
                  <Label>Assunto do email *</Label>
                  <Input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Ex: Aproveite 20% de desconto!" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Preheader (opcional)</Label>
                <Input value={preheader} onChange={(e) => setPreheader(e.target.value)} placeholder="Texto que aparece após o assunto na caixa de entrada" />
              </div>
              <div className="space-y-2">
                <Label>Conteúdo HTML *</Label>
                <Textarea
                  value={html}
                  onChange={(e) => setHtml(e.target.value)}
                  placeholder={`<h1>Olá!</h1>\n<p>Confira nossas novidades...</p>`}
                  rows={12}
                  className="font-mono text-xs"
                />
                <p className="text-xs text-muted-foreground">
                  Use HTML para formatação. Variáveis: {"{{nome_paciente}}"}, {"{{nome_clinica}}"}
                </p>
              </div>
            </div>
          )}

          {/* Step 2: Segmentação */}
          {step === 2 && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <button
                  type="button"
                  onClick={() => setSendMode("all")}
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    sendMode === "all" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <Users className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Todos os pacientes</div>
                    <div className="text-sm text-muted-foreground">{patients.length} com email</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setSendMode("selected")}
                  className={`flex items-center gap-3 rounded-lg border-2 p-4 text-left transition-all ${
                    sendMode === "selected" ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
                  }`}
                >
                  <Mail className="h-5 w-5 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Selecionar pacientes</div>
                    <div className="text-sm text-muted-foreground">
                      {selectedIds.size > 0 ? `${selectedIds.size} selecionado(s)` : "Escolha individualmente"}
                    </div>
                  </div>
                </button>
              </div>

              {sendMode === "selected" && (
                <div className="rounded-lg border overflow-hidden">
                  <div className="p-3 border-b bg-muted/30 flex items-center gap-2">
                    <Input
                      placeholder="Buscar por nome ou email..."
                      value={patientSearch}
                      onChange={(e) => setPatientSearch(e.target.value)}
                      className="h-9"
                    />
                    <Button variant="ghost" size="sm" onClick={toggleAll} disabled={filteredPatients.length === 0}>
                      {selectedIds.size === filteredPatients.length && filteredPatients.length > 0 ? "Desmarcar" : "Marcar"} todos
                    </Button>
                  </div>
                  <div className="max-h-64 overflow-y-auto divide-y">
                    {isLoadingPatients ? (
                      <div className="flex items-center justify-center py-8">
                        <Spinner size="sm" className="text-muted-foreground" />
                      </div>
                    ) : filteredPatients.length === 0 ? (
                      <div className="py-8 text-center text-sm text-muted-foreground">Nenhum paciente encontrado</div>
                    ) : (
                      filteredPatients.map((c) => (
                        <label key={c.id} htmlFor={`nc-patient-${c.id}`} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/40 cursor-pointer">
                          <Checkbox id={`nc-patient-${c.id}`} checked={selectedIds.has(c.id)} onCheckedChange={() => togglePatient(c.id)} />
                          <div className="min-w-0">
                            <div className="text-sm font-medium truncate">{c.name || "—"}</div>
                            <div className="text-xs text-muted-foreground truncate">{c.email}</div>
                          </div>
                        </label>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Nome</p>
                  <p className="font-medium">{name}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Assunto</p>
                  <p className="font-medium">{subject}</p>
                </div>
                <div className="rounded-lg border p-4">
                  <p className="text-xs text-muted-foreground mb-1">Destinatários</p>
                  <p className="font-medium">
                    {sendMode === "all" ? `Todos (${patients.length})` : `${selectedIds.size} selecionado(s)`}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Eye className="h-4 w-4" />
                  Preview do email
                </p>
                <div className="rounded-lg border bg-background">
                  <iframe
                    title="preview"
                    className="w-full h-96 rounded-lg"
                    srcDoc={html.replace(/\{\{nome_clinica\}\}/g, defaultClinicName).replace(/\{\{nome_paciente\}\}/g, "João da Silva")}
                    sandbox="allow-same-origin"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex justify-between mt-8 pt-6 border-t">
            <Button variant="outline" onClick={() => setStep((s) => Math.max(1, s - 1))} disabled={step === 1}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Voltar
            </Button>
            {step < 3 ? (
              <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()}>
                Próximo
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleSave} disabled={isSaving} variant="gradient">
                {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Salvando...</> : <><Send className="mr-2 h-4 w-4" />Criar Campanha</>}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
}
