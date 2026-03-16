import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { supabase } from "@/integrations/supabase/client";
import { useClinicalAudit } from "@/hooks/useClinicalAudit";
import {
  ArrowLeft, User, Calendar, FileText, Heart, Activity,
  Thermometer, Wind, AlertCircle, Pill, ShieldCheck, Download,
  History, Lock, ClipboardList, ArrowRightLeft, FlaskConical, Smile, Sparkles,
} from "lucide-react";
import { logger } from "@/lib/logger";
import { generateMedicalRecordPdf } from "@/utils/patientDocumentPdf";
import { VitalSignsChart } from "@/components/prontuario/VitalSignsChart";
import { OdontogramaEmbed } from "@/components/prontuario/OdontogramaEmbed";
import { DentalImagesGallery } from "@/components/prontuario/DentalImagesGallery";
import { EVOLUTION_TYPE_LABELS, EVOLUTION_TYPE_COLORS } from "@/lib/soap-templates";
import type { ClinicalEvolution, ClinicalEvolutionType } from "@/types/database";
import { NotebookPen } from "lucide-react";
import { AiPatientSummary, AiExplainToPatient } from "@/components/ai";

interface RecordDetail {
  id: string; patient_id: string; client_name: string; record_date: string;
  professional_name: string; chief_complaint: string; anamnesis: string;
  physical_exam: string; diagnosis: string; cid_code: string;
  treatment_plan: string; prescriptions: string; notes: string;
  blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null;
  heart_rate: number | null; respiratory_rate: number | null;
  temperature: number | null; oxygen_saturation: number | null;
  weight_kg: number | null; height_cm: number | null; pain_scale: number | null;
  allergies: string; current_medications: string; medical_history: string;
  digital_hash: string | null; signed_at: string | null;
  signed_by_name: string | null; signed_by_crm: string | null;
  is_locked: boolean; created_at: string;
}

interface HistoryRecord {
  id: string; record_date: string; chief_complaint: string;
  diagnosis: string; cid_code: string; professional_name: string;
  blood_pressure_systolic: number | null; blood_pressure_diastolic: number | null;
  heart_rate: number | null; temperature: number | null;
  oxygen_saturation: number | null; weight_kg: number | null;
  respiratory_rate: number | null;
}

interface Version {
  id: string; version_number: number; changed_by_name: string;
  changed_at: string; change_reason: string | null; digital_hash: string | null;
}

interface LinkedDoc {
  id: string;
  type: "receita" | "atestado" | "laudo" | "encaminhamento";
  title: string;
  subtitle: string;
  date: string;
}

function Field({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm whitespace-pre-line">{value}</p>
    </div>
  );
}

export default function ProntuarioDetalhe() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { profile, tenant } = useAuth();
  const { professionalType } = usePermissions();
  const { logAccess } = useClinicalAudit();
  const [record, setRecord] = useState<RecordDetail | null>(null);
  const [history, setHistory] = useState<HistoryRecord[]>([]);
  const [versions, setVersions] = useState<Version[]>([]);
  const [linkedDocs, setLinkedDocs] = useState<LinkedDoc[]>([]);
  const [evolutions, setEvolutions] = useState<ClinicalEvolution[]>([]);
  const [loading, setLoading] = useState(true);

  const isDentist = professionalType === "dentista";

  useEffect(() => {
    if (id && profile?.tenant_id) fetchRecord();
  }, [id, profile?.tenant_id]);

  const fetchRecord = async () => {
    if (!id || !profile?.tenant_id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("medical_records")
        .select("*, patient:patients(name), profiles(full_name)")
        .eq("id", id)
        .eq("tenant_id", profile.tenant_id)
        .single();
      if (error) throw error;
      const r = data as any;
      const rec: RecordDetail = {
        id: r.id, patient_id: r.patient_id, client_name: r.patient?.name ?? "—",
        record_date: r.record_date, professional_name: r.profiles?.full_name ?? "—",
        chief_complaint: r.chief_complaint ?? "", anamnesis: r.anamnesis ?? "",
        physical_exam: r.physical_exam ?? "", diagnosis: r.diagnosis ?? "",
        cid_code: r.cid_code ?? "", treatment_plan: r.treatment_plan ?? "",
        prescriptions: r.prescriptions ?? "", notes: r.notes ?? "",
        blood_pressure_systolic: r.blood_pressure_systolic,
        blood_pressure_diastolic: r.blood_pressure_diastolic,
        heart_rate: r.heart_rate, respiratory_rate: r.respiratory_rate,
        temperature: r.temperature, oxygen_saturation: r.oxygen_saturation,
        weight_kg: r.weight_kg, height_cm: r.height_cm, pain_scale: r.pain_scale,
        allergies: r.allergies ?? "", current_medications: r.current_medications ?? "",
        medical_history: r.medical_history ?? "",
        digital_hash: r.digital_hash, signed_at: r.signed_at,
        signed_by_name: r.signed_by_name, signed_by_crm: r.signed_by_crm,
        is_locked: r.is_locked ?? false, created_at: r.created_at,
      };
      setRecord(rec);

      logAccess("medical_records", id, rec.patient_id);

      const [histRes, verRes] = await Promise.all([
        supabase.from("medical_records")
          .select("id, record_date, chief_complaint, diagnosis, cid_code, blood_pressure_systolic, blood_pressure_diastolic, heart_rate, temperature, oxygen_saturation, weight_kg, respiratory_rate, profiles(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("patient_id", r.patient_id)
          .order("record_date", { ascending: false })
          .limit(20),
        supabase.from("medical_record_versions")
          .select("id, version_number, changed_by, changed_at, change_reason, digital_hash, profiles(full_name)")
          .eq("record_id", id)
          .order("version_number", { ascending: false }),
      ]);

      setHistory((histRes.data || []).map((h: any) => ({
        id: h.id, record_date: h.record_date,
        chief_complaint: h.chief_complaint ?? "", diagnosis: h.diagnosis ?? "",
        cid_code: h.cid_code ?? "", professional_name: h.profiles?.full_name ?? "—",
        blood_pressure_systolic: h.blood_pressure_systolic,
        blood_pressure_diastolic: h.blood_pressure_diastolic,
        heart_rate: h.heart_rate, temperature: h.temperature,
        oxygen_saturation: h.oxygen_saturation, weight_kg: h.weight_kg,
        respiratory_rate: h.respiratory_rate,
      })));

      setVersions((verRes.data || []).map((v: any) => ({
        id: v.id, version_number: v.version_number,
        changed_by_name: v.profiles?.full_name ?? "—",
        changed_at: v.changed_at, change_reason: v.change_reason,
        digital_hash: v.digital_hash,
      })));

      const docs: LinkedDoc[] = [];
      const [rxRes, certRes, examRes, refRes] = await Promise.all([
        supabase.from("prescriptions").select("id, issued_at, medications, prescription_type")
          .eq("tenant_id", profile.tenant_id)
          .or(`medical_record_id.eq.${id},and(patient_id.eq.${r.patient_id},appointment_id.eq.${r.appointment_id})`)
          .order("issued_at", { ascending: false }),
        supabase.from("medical_certificates").select("id, issued_at, certificate_type, content")
          .eq("tenant_id", profile.tenant_id)
          .or(`medical_record_id.eq.${id},and(patient_id.eq.${r.patient_id},appointment_id.eq.${r.appointment_id})`)
          .order("issued_at", { ascending: false }),
        supabase.from("exam_results").select("id, created_at, exam_name, status")
          .eq("tenant_id", profile.tenant_id)
          .or(`medical_record_id.eq.${id},and(patient_id.eq.${r.patient_id},appointment_id.eq.${r.appointment_id})`)
          .order("created_at", { ascending: false }),
        supabase.from("referrals").select("id, created_at, reason, status, specialties(name)")
          .eq("tenant_id", profile.tenant_id)
          .or(`medical_record_id.eq.${id},and(patient_id.eq.${r.patient_id},appointment_id.eq.${r.appointment_id})`)
          .order("created_at", { ascending: false }),
      ]);

      (rxRes.data || []).forEach((d: any) => docs.push({
        id: d.id, type: "receita",
        title: d.prescription_type === "simples" ? "Receita Simples" : d.prescription_type === "especial_b" ? "Receita Especial B" : "Receita Especial A",
        subtitle: (d.medications || "").substring(0, 80),
        date: d.issued_at,
      }));
      (certRes.data || []).forEach((d: any) => docs.push({
        id: d.id, type: "atestado",
        title: d.certificate_type === "atestado" ? "Atestado Médico" : d.certificate_type === "declaracao_comparecimento" ? "Declaração de Comparecimento" : d.certificate_type === "laudo" ? "Laudo Médico" : "Relatório Médico",
        subtitle: (d.content || "").substring(0, 80),
        date: d.issued_at,
      }));
      (examRes.data || []).forEach((d: any) => docs.push({
        id: d.id, type: "laudo",
        title: d.exam_name,
        subtitle: d.status,
        date: d.created_at,
      }));
      (refRes.data || []).forEach((d: any) => docs.push({
        id: d.id, type: "encaminhamento",
        title: `Encaminhamento${d.specialties?.name ? ` — ${d.specialties.name}` : ""}`,
        subtitle: (d.reason || "").substring(0, 80),
        date: d.created_at,
      }));

      docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      setLinkedDocs(docs);

      // Fetch linked evolutions
      const evoQuery = (supabase as any).from("clinical_evolutions")
        .select("*, patient:patients(name), profiles(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .eq("patient_id", r.patient_id)
        .order("evolution_date", { ascending: false })
        .limit(50);
      const { data: evoData } = r.appointment_id
        ? await evoQuery.or(`appointment_id.eq.${r.appointment_id},medical_record_id.eq.${id}`)
        : await evoQuery.eq("medical_record_id", id);
      setEvolutions((evoData ?? []) as ClinicalEvolution[]);
    } catch (err) {
      logger.error("Fetch record detail:", err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <MainLayout title="Prontuário" subtitle="Carregando...">
        <div className="max-w-4xl mx-auto space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-80 w-full rounded-xl" />
        </div>
      </MainLayout>
    );
  }

  if (!record) {
    return (
      <MainLayout title="Prontuário não encontrado">
        <div className="text-center py-12">
          <Button variant="outline" onClick={() => navigate("/prontuarios")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar para Prontuários
          </Button>
        </div>
      </MainLayout>
    );
  }

  const imc = record.weight_kg && record.height_cm
    ? (record.weight_kg / ((record.height_cm / 100) ** 2)).toFixed(1) : null;

  return (
    <MainLayout
      title={`Prontuário — ${record.client_name}`}
      subtitle={`${new Date(record.record_date).toLocaleDateString("pt-BR")} · ${record.professional_name}`}
      actions={
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => navigate("/prontuarios")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Voltar
          </Button>
          <Button variant="outline" onClick={() => {
            generateMedicalRecordPdf({
              client_name: record.client_name, record_date: record.record_date,
              professional_name: record.professional_name, clinic_name: tenant?.name || "Clínica",
              chief_complaint: record.chief_complaint, anamnesis: record.anamnesis,
              physical_exam: record.physical_exam, diagnosis: record.diagnosis,
              cid_code: record.cid_code, treatment_plan: record.treatment_plan,
              prescriptions: record.prescriptions, notes: record.notes,
              blood_pressure_systolic: record.blood_pressure_systolic,
              blood_pressure_diastolic: record.blood_pressure_diastolic,
              heart_rate: record.heart_rate, respiratory_rate: record.respiratory_rate,
              temperature: record.temperature, oxygen_saturation: record.oxygen_saturation,
              weight_kg: record.weight_kg, height_cm: record.height_cm,
              pain_scale: record.pain_scale, allergies: record.allergies,
              current_medications: record.current_medications, medical_history: record.medical_history,
              digital_hash: record.digital_hash, signed_at: record.signed_at,
              signed_by_name: record.signed_by_name, signed_by_crm: record.signed_by_crm,
            });
          }}>
            <Download className="h-4 w-4 mr-2" />PDF
          </Button>
        </div>
      }
    >
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          {record.cid_code && <Badge variant="outline" className="font-mono">CID: {record.cid_code}</Badge>}
          {record.signed_at ? (
            <Badge variant="outline" className="text-success border-success/30 gap-1">
              <ShieldCheck className="h-3 w-3" />Assinado digitalmente
            </Badge>
          ) : record.digital_hash ? (
            <Badge variant="outline" className="text-xs gap-1 text-muted-foreground">
              Integridade verificável
            </Badge>
          ) : null}
          {record.is_locked && (
            <Badge variant="outline" className="text-amber-600 border-amber-500/30 gap-1">
              <Lock className="h-3 w-3" />Bloqueado
            </Badge>
          )}
        </div>

        <Tabs defaultValue="prontuario">
          <TabsList className={`grid w-full h-auto gap-1 p-1 ${isDentist ? "grid-cols-8" : "grid-cols-7"}`}>
            <TabsTrigger value="prontuario" className="text-xs py-2"><ClipboardList className="h-3 w-3 mr-1" />Prontuário</TabsTrigger>
            <TabsTrigger value="vitais" className="text-xs py-2"><Activity className="h-3 w-3 mr-1" />Sinais Vitais</TabsTrigger>
            {isDentist && (
              <TabsTrigger value="odontograma" className="text-xs py-2"><Smile className="h-3 w-3 mr-1" />Odontograma</TabsTrigger>
            )}
            <TabsTrigger value="evolucoes" className="text-xs py-2"><NotebookPen className="h-3 w-3 mr-1" />Evoluções ({evolutions.length})</TabsTrigger>
            <TabsTrigger value="documentos" className="text-xs py-2"><FileText className="h-3 w-3 mr-1" />Documentos ({linkedDocs.length})</TabsTrigger>
            <TabsTrigger value="historico" className="text-xs py-2"><History className="h-3 w-3 mr-1" />Histórico ({history.length})</TabsTrigger>
            <TabsTrigger value="versoes" className="text-xs py-2"><FileText className="h-3 w-3 mr-1" />Versões ({versions.length})</TabsTrigger>
            <TabsTrigger value="ia" className="text-xs py-2"><Sparkles className="h-3 w-3 mr-1" />IA</TabsTrigger>
          </TabsList>

          <TabsContent value="prontuario" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-5 space-y-5">
                <Field label="Queixa Principal" value={record.chief_complaint} />
                <Field label="Anamnese" value={record.anamnesis} />
                <Field label="Exame Físico" value={record.physical_exam} />
                <div className="space-y-1">
                  <Field label="Diagnóstico" value={record.diagnosis} />
                  {record.diagnosis && (
                    <AiExplainToPatient medicalText={record.diagnosis} context="diagnosis" label="Explicar diagnóstico ao paciente" />
                  )}
                </div>
                <div className="space-y-1">
                  <Field label="Plano Terapêutico" value={record.treatment_plan} />
                  {record.treatment_plan && (
                    <AiExplainToPatient medicalText={record.treatment_plan} context="treatment_plan" label="Explicar plano ao paciente" />
                  )}
                </div>
                <div className="space-y-1">
                  <Field label="Prescrições" value={record.prescriptions} />
                  {record.prescriptions && (
                    <AiExplainToPatient medicalText={record.prescriptions} context="prescription" label="Explicar prescrição ao paciente" />
                  )}
                </div>
                <Field label="Observações" value={record.notes} />

                {(record.allergies || record.current_medications || record.medical_history) && (
                  <>
                    <hr className="border-border" />
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                      <Field label="Alergias" value={record.allergies} />
                      <Field label="Medicamentos em Uso" value={record.current_medications} />
                      <Field label="Histórico Médico" value={record.medical_history} />
                    </div>
                  </>
                )}

                {record.signed_at && (
                  <>
                    <hr className="border-border" />
                    <div className="text-xs space-y-1 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-md p-3">
                      <p className="font-medium text-emerald-700 dark:text-emerald-400 flex items-center gap-1">
                        <ShieldCheck className="h-3.5 w-3.5" /> Assinado digitalmente
                      </p>
                      <p className="text-muted-foreground"><span className="font-medium">Profissional:</span> {record.signed_by_name} {record.signed_by_crm ? `(${record.signed_by_crm})` : ""}</p>
                      <p className="text-muted-foreground"><span className="font-medium">Data:</span> {new Date(record.signed_at).toLocaleString("pt-BR")}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">SHA-256: {record.digital_hash}</p>
                    </div>
                  </>
                )}
                {!record.signed_at && record.digital_hash && (
                  <>
                    <hr className="border-border" />
                    <div className="text-xs text-muted-foreground space-y-1">
                      <p className="font-medium">Registro de integridade</p>
                      <p className="font-mono text-[10px] truncate">SHA-256: {record.digital_hash}</p>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="vitais" className="mt-4 space-y-4">
            <Card>
              <CardContent className="p-5">
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-8 gap-3">
                  {record.blood_pressure_systolic != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <Heart className="h-4 w-4 text-red-500 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">PA</p>
                      <p className="text-sm font-semibold">{record.blood_pressure_systolic}/{record.blood_pressure_diastolic}</p>
                    </div>
                  )}
                  {record.heart_rate != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <Activity className="h-4 w-4 text-pink-500 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">FC</p>
                      <p className="text-sm font-semibold">{record.heart_rate} bpm</p>
                    </div>
                  )}
                  {record.temperature != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <Thermometer className="h-4 w-4 text-orange-500 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">Temp</p>
                      <p className="text-sm font-semibold">{record.temperature}°C</p>
                    </div>
                  )}
                  {record.oxygen_saturation != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <Wind className="h-4 w-4 text-blue-500 mx-auto mb-1" />
                      <p className="text-[10px] text-muted-foreground">SpO₂</p>
                      <p className="text-sm font-semibold">{record.oxygen_saturation}%</p>
                    </div>
                  )}
                  {record.respiratory_rate != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">FR</p>
                      <p className="text-sm font-semibold">{record.respiratory_rate}</p>
                    </div>
                  )}
                  {record.weight_kg != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">Peso</p>
                      <p className="text-sm font-semibold">{record.weight_kg} kg</p>
                    </div>
                  )}
                  {record.height_cm != null && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">Altura</p>
                      <p className="text-sm font-semibold">{record.height_cm} cm</p>
                    </div>
                  )}
                  {imc && (
                    <div className="rounded-lg border bg-muted/30 p-3 text-center">
                      <p className="text-[10px] text-muted-foreground">IMC</p>
                      <p className="text-sm font-semibold">{imc}</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {history.length >= 2 && (
              <VitalSignsChart records={history.map((h) => ({
                record_date: h.record_date,
                blood_pressure_systolic: h.blood_pressure_systolic,
                blood_pressure_diastolic: h.blood_pressure_diastolic,
                heart_rate: h.heart_rate,
                temperature: h.temperature,
                oxygen_saturation: h.oxygen_saturation,
                weight_kg: h.weight_kg,
                respiratory_rate: h.respiratory_rate,
              }))} />
            )}
          </TabsContent>

          {isDentist && (
            <TabsContent value="odontograma" className="mt-4 space-y-6">
              <OdontogramaEmbed
                tenantId={profile?.tenant_id || ""}
                patientId={record.patient_id}
                professionalId={profile?.id || ""}
                readOnly={record.is_locked}
              />
              <DentalImagesGallery
                tenantId={profile?.tenant_id || ""}
                patientId={record.patient_id}
                professionalId={profile?.id || ""}
                medicalRecordId={record.id}
                readOnly={record.is_locked}
              />
            </TabsContent>
          )}

          <TabsContent value="evolucoes" className="mt-4 space-y-3">
            {evolutions.length === 0 ? (
              <div className="text-center py-8">
                <NotebookPen className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma evolução vinculada a este atendimento.</p>
              </div>
            ) : (
              evolutions.map((evo) => (
                <Card key={evo.id} className="border-gradient">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-2 mb-2 flex-wrap">
                      <Badge className={`text-xs ${EVOLUTION_TYPE_COLORS[evo.evolution_type]}`}>
                        {EVOLUTION_TYPE_LABELS[evo.evolution_type]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {new Date(evo.evolution_date).toLocaleDateString("pt-BR")}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        — {evo.profiles?.full_name ?? ""}
                      </span>
                      {evo.signed_at && (
                        <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-200">
                          <ShieldCheck className="h-3 w-3" />Assinado
                        </Badge>
                      )}
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                      {evo.subjective && (
                        <div><span className="font-bold text-blue-600 dark:text-blue-400">S: </span>
                          <span className="text-muted-foreground">{evo.subjective}</span></div>
                      )}
                      {evo.objective && (
                        <div><span className="font-bold text-emerald-600 dark:text-emerald-400">O: </span>
                          <span className="text-muted-foreground">{evo.objective}</span></div>
                      )}
                      {evo.assessment && (
                        <div><span className="font-bold text-amber-600 dark:text-amber-400">A: </span>
                          <span className="text-muted-foreground">{evo.assessment}</span></div>
                      )}
                      {evo.plan && (
                        <div><span className="font-bold text-violet-600 dark:text-violet-400">P: </span>
                          <span className="text-muted-foreground">{evo.plan}</span></div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="documentos" className="mt-4 space-y-3">
            {linkedDocs.length === 0 ? (
              <div className="text-center py-8">
                <FileText className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum documento vinculado a este atendimento.</p>
                <p className="text-xs text-muted-foreground mt-1">Receitas, atestados, laudos e encaminhamentos criados com vínculo a este prontuário aparecerão aqui.</p>
              </div>
            ) : (
              linkedDocs.map((doc) => {
                const iconMap = {
                  receita: <Pill className="h-4 w-4 text-blue-500" />,
                  atestado: <FileText className="h-4 w-4 text-emerald-500" />,
                  laudo: <FlaskConical className="h-4 w-4 text-amber-500" />,
                  encaminhamento: <ArrowRightLeft className="h-4 w-4 text-purple-500" />,
                };
                const colorMap = {
                  receita: "bg-blue-500/10 text-blue-600 border-blue-500/20",
                  atestado: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20",
                  laudo: "bg-amber-500/10 text-amber-600 border-amber-500/20",
                  encaminhamento: "bg-purple-500/10 text-purple-600 border-purple-500/20",
                };
                return (
                  <Card key={`${doc.type}-${doc.id}`}>
                    <CardContent className="p-4 flex items-center gap-3">
                      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted shrink-0">
                        {iconMap[doc.type]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{doc.title}</p>
                          <Badge variant="outline" className={`text-[10px] ${colorMap[doc.type]}`}>
                            {doc.type === "receita" ? "Receita" : doc.type === "atestado" ? "Atestado" : doc.type === "laudo" ? "Laudo" : "Encaminhamento"}
                          </Badge>
                        </div>
                        {doc.subtitle && <p className="text-xs text-muted-foreground truncate mt-0.5">{doc.subtitle}</p>}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                        {new Date(doc.date).toLocaleDateString("pt-BR")}
                      </span>
                    </CardContent>
                  </Card>
                );
              })
            )}
          </TabsContent>

          <TabsContent value="historico" className="mt-4 space-y-3">
            {history.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">Nenhum outro prontuário deste paciente.</p>
            ) : (
              history.map((h) => (
                <Card key={h.id} className={h.id === record.id ? "ring-2 ring-primary" : "cursor-pointer hover:shadow-md transition-shadow"}
                  onClick={() => h.id !== record.id && navigate(`/prontuarios/${h.id}`)}>
                  <CardContent className="p-4 flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                        <Calendar className="h-4 w-4 text-primary" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{h.chief_complaint || "Sem queixa"}</p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(h.record_date).toLocaleDateString("pt-BR")} · {h.professional_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1.5 shrink-0">
                      {h.cid_code && <Badge variant="outline" className="text-[10px] font-mono">{h.cid_code}</Badge>}
                      {h.id === record.id && <Badge className="text-[10px]">Atual</Badge>}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="versoes" className="mt-4 space-y-3">
            {versions.length === 0 ? (
              <div className="text-center py-8">
                <History className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma versão anterior.</p>
                <p className="text-xs text-muted-foreground mt-1">Versões são criadas automaticamente ao editar o prontuário.</p>
              </div>
            ) : (
              versions.map((v) => (
                <Card key={v.id}>
                  <CardContent className="p-4 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <Badge variant="outline">Versão {v.version_number}</Badge>
                      <span className="text-xs text-muted-foreground">{new Date(v.changed_at).toLocaleString("pt-BR")}</span>
                    </div>
                    <p className="text-sm font-medium">{v.changed_by_name}</p>
                    {v.change_reason && <p className="text-xs text-muted-foreground">Motivo: {v.change_reason}</p>}
                    {v.digital_hash && <p className="text-[10px] text-muted-foreground font-mono truncate">SHA-256: {v.digital_hash}</p>}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          <TabsContent value="ia" className="mt-4">
            <AiPatientSummary
              patientId={record.patient_id}
              patientName={record.client_name}
            />
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
}
