import { useState, useEffect } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  Calendar,
  Pill,
  Syringe,
  AlertTriangle,
  Heart,
  FileText,
  Stethoscope,
  ClipboardList,
  RefreshCw,
  TrendingUp,
  Droplet,
  Thermometer,
  Scale,
  ArrowUpRight,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format, differenceInDays, isValid, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

/** Safely format a date string, returning fallback on invalid values */
function safeFormat(dateStr: string | null | undefined, fmt: string, fallback = "--"): string {
  if (!dateStr) return fallback;
  try {
    const d = typeof dateStr === "string" ? parseISO(dateStr) : new Date(dateStr);
    return isValid(d) ? format(d, fmt) : fallback;
  } catch {
    return fallback;
  }
}

/** Safely compute differenceInDays, returning Infinity on invalid dates */
function safeDiffDays(dateStr: string | null | undefined): number {
  if (!dateStr) return Infinity;
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? differenceInDays(d, new Date()) : Infinity;
  } catch {
    return Infinity;
  }
}
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

interface TimelineEvent {
  id: string;
  event_type: "appointment" | "prescription" | "exam" | "certificate";
  event_date: string;
  title: string;
  description: string;
  professional_name: string | null;
  metadata: Record<string, any>;
}

interface Medication {
  id: string;
  medication_name: string;
  dosage: string;
  prescription_date: string;
  expiry_date: string;
  professional_name: string | null;
  is_expired: boolean;
}

interface HealthInfo {
  allergies: string | null;
  blood_type: string | null;
  birth_date: string | null;
  gender: string | null;
  last_vital_signs: {
    weight?: number;
    height?: number;
    blood_pressure?: string;
    heart_rate?: number;
    temperature?: number;
    oxygen_saturation?: number;
    recorded_at?: string;
  };
}

interface VitalSign {
  recorded_at: string;
  weight: number | null;
  height: number | null;
  blood_pressure: string | null;
  heart_rate: number | null;
  temperature: number | null;
  oxygen_saturation: number | null;
  glucose: number | null;
}

interface Vaccination {
  id: string;
  vaccine_name: string;
  dose_number: number | null;
  batch_number: string | null;
  manufacturer: string | null;
  administered_at: string;
  administered_by: string | null;
  next_dose_date: string | null;
}

const eventTypeConfig: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  appointment:    { icon: Calendar,      color: "text-blue-600 bg-blue-100",    label: "Consulta" },
  prescription:   { icon: Pill,          color: "text-orange-600 bg-orange-100", label: "Receita" },
  exam:           { icon: FileText,      color: "text-emerald-600 bg-emerald-100", label: "Exame" },
  certificate:    { icon: ClipboardList, color: "text-violet-600 bg-violet-100", label: "Atestado" },
  medical_report: { icon: Stethoscope,   color: "text-indigo-600 bg-indigo-100", label: "Laudo" },
  referral:       { icon: ArrowUpRight,  color: "text-teal-600 bg-teal-100",    label: "Encaminhamento" },
};

export default function PatientSaude() {
  const [activeTab, setActiveTab] = useState("timeline");
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [medications, setMedications] = useState<Medication[]>([]);
  const [healthInfo, setHealthInfo] = useState<HealthInfo | null>(null);
  const [vitalSigns, setVitalSigns] = useState<VitalSign[]>([]);
  const [vaccinations, setVaccinations] = useState<Vaccination[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    void loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [timelineRes, medsRes, healthRes, vitalsRes, vaccinesRes] = await Promise.all([
        (supabasePatient as any).rpc("get_patient_health_timeline", { p_limit: 50 }),
        (supabasePatient as any).rpc("get_patient_active_medications"),
        (supabasePatient as any).rpc("get_patient_health_info"),
        (supabasePatient as any).rpc("get_patient_vital_signs_history", { p_limit: 20 }),
        (supabasePatient as any).rpc("get_patient_vaccinations"),
      ]);

      if (!timelineRes.error) setTimeline((timelineRes.data as TimelineEvent[]) || []);
      if (!medsRes.error) setMedications((medsRes.data as Medication[]) || []);
      if (!healthRes.error) setHealthInfo(healthRes.data as HealthInfo);
      if (!vitalsRes.error) setVitalSigns((vitalsRes.data as VitalSign[]) || []);
      if (!vaccinesRes.error) setVaccinations((vaccinesRes.data as Vaccination[]) || []);
    } catch (err) {
      logger.error("Error loading health data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const activeMedications = medications.filter((m) => !m.is_expired);
  const expiringSoon = medications.filter((m) => {
    if (m.is_expired) return false;
    const daysUntilExpiry = safeDiffDays(m.expiry_date);
    return daysUntilExpiry <= 7;
  });

  const chartData = vitalSigns
    .slice()
    .reverse()
    .filter((vs) => vs.recorded_at && isValid(parseISO(vs.recorded_at)))
    .map((vs) => ({
      date: safeFormat(vs.recorded_at, "dd/MM"),
      peso: vs.weight,
      fc: vs.heart_rate,
      spo2: vs.oxygen_saturation,
    }));

  return (
    <PatientLayout
      title="Minha Saúde"
      subtitle="Histórico e informações de saúde"
      actions={
        <Button variant="outline" size="sm" onClick={() => void loadData()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      {/* Health Summary Cards */}
      {healthInfo && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {healthInfo.allergies && (
            <Card className="border-red-200 bg-red-50/50 dark:border-red-800 dark:bg-red-950/30">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 mb-1">
                  <AlertTriangle className="h-4 w-4" />
                  Alergias
                </div>
                <p className="font-medium text-red-700 dark:text-red-300">{healthInfo.allergies}</p>
              </CardContent>
            </Card>
          )}

          {healthInfo.blood_type && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Droplet className="h-4 w-4" />
                  Tipo Sanguíneo
                </div>
                <p className="text-2xl font-bold">{healthInfo.blood_type}</p>
              </CardContent>
            </Card>
          )}

          {healthInfo.last_vital_signs?.weight && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Scale className="h-4 w-4" />
                  Peso
                </div>
                <p className="text-2xl font-bold">{healthInfo.last_vital_signs.weight} kg</p>
                {healthInfo.last_vital_signs.recorded_at && (
                  <p className="text-xs text-muted-foreground">
                    {safeFormat(healthInfo.last_vital_signs.recorded_at, "dd/MM/yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {healthInfo.last_vital_signs?.blood_pressure && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
                  <Heart className="h-4 w-4" />
                  Pressão Arterial
                </div>
                <p className="text-2xl font-bold">{healthInfo.last_vital_signs.blood_pressure}</p>
                {healthInfo.last_vital_signs.recorded_at && (
                  <p className="text-xs text-muted-foreground">
                    {safeFormat(healthInfo.last_vital_signs.recorded_at, "dd/MM/yyyy")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="timeline" className="gap-2">
            <Activity className="h-4 w-4" />
            Timeline
          </TabsTrigger>
          <TabsTrigger value="medications" className="gap-2">
            <Pill className="h-4 w-4" />
            Medicamentos
            {activeMedications.length > 0 && (
              <Badge variant="secondary" className="ml-1">
                {activeMedications.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="vitals" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Sinais Vitais
          </TabsTrigger>
          <TabsTrigger value="vaccines" className="gap-2">
            <Syringe className="h-4 w-4" />
            Vacinas
          </TabsTrigger>
        </TabsList>

        {/* Timeline Tab */}
        <TabsContent value="timeline">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <EmptyState
              icon={Activity}
              title="Nenhum evento encontrado"
              description="Seu histórico de saúde aparecerá aqui."
            />
          ) : (
            <div className="relative">
              <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />
              <div className="space-y-4">
                {timeline.map((event) => {
                  const config = eventTypeConfig[event.event_type] || eventTypeConfig.appointment;
                  const Icon = config.icon;
                  return (
                    <div key={event.id} className="relative pl-10">
                      <div
                        className={cn(
                          "absolute left-0 top-1 flex h-8 w-8 items-center justify-center rounded-full",
                          config.color
                        )}
                      >
                        <Icon className="h-4 w-4" />
                      </div>
                      <Card>
                        <CardContent className="p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <h3 className="font-medium">{event.title}</h3>
                                <Badge variant="outline" className="text-xs">
                                  {config.label}
                                </Badge>
                              </div>
                              {event.description && (
                                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                                  {event.description}
                                </p>
                              )}
                              {event.professional_name && (
                                <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                                  <Stethoscope className="h-3 w-3" />
                                  {event.professional_name}
                                </p>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {safeFormat(event.event_date, "dd/MM/yyyy")}
                            </span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Medications Tab */}
        <TabsContent value="medications">
          {expiringSoon.length > 0 && (
            <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 mb-4">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="font-medium">
                    {expiringSoon.length} receita(s) expirando em breve
                  </span>
                </div>
              </CardContent>
            </Card>
          )}

          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : medications.length === 0 ? (
            <EmptyState
              icon={Pill}
              title="Nenhum medicamento"
              description="Suas receitas e medicamentos aparecerão aqui."
            />
          ) : (
            <div className="space-y-3">
              {medications.map((med) => (
                <Card
                  key={med.id}
                  className={cn(med.is_expired && "opacity-60 border-dashed")}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{med.medication_name}</h3>
                          {med.is_expired ? (
                            <Badge variant="secondary">Expirada</Badge>
                          ) : safeDiffDays(med.expiry_date) <= 7 ? (
                            <Badge variant="destructive">Expira em breve</Badge>
                          ) : (
                            <Badge variant="default" className="bg-green-600">
                              Válida
                            </Badge>
                          )}
                        </div>
                        {med.professional_name && (
                          <p className="text-sm text-muted-foreground mt-1">
                            Prescrito por {med.professional_name}
                          </p>
                        )}
                      </div>
                      <div className="text-right text-sm">
                        <p className="text-muted-foreground">
                          Válida até {safeFormat(med.expiry_date, "dd/MM/yyyy")}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Vital Signs Tab */}
        <TabsContent value="vitals">
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : vitalSigns.length === 0 ? (
            <EmptyState
              icon={TrendingUp}
              title="Nenhum registro"
              description="Seus sinais vitais aparecerão aqui após as consultas."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Evolução dos Sinais Vitais</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="date" fontSize={12} />
                      <YAxis fontSize={12} />
                      <Tooltip />
                      <Legend />
                      <Line
                        type="monotone"
                        dataKey="peso"
                        name="Peso (kg)"
                        stroke="#0d9488"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="fc"
                        name="FC (bpm)"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                      <Line
                        type="monotone"
                        dataKey="spo2"
                        name="SpO2 (%)"
                        stroke="#8b5cf6"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Vaccines Tab */}
        <TabsContent value="vaccines">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          ) : vaccinations.length === 0 ? (
            <EmptyState
              icon={Syringe}
              title="Nenhuma vacina registrada"
              description="Sua carteira de vacinação aparecerá aqui."
            />
          ) : (
            <div className="space-y-3">
              {vaccinations.map((vaccine) => (
                <Card key={vaccine.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className="font-medium">{vaccine.vaccine_name}</h3>
                          {vaccine.dose_number && (
                            <Badge variant="outline">{vaccine.dose_number}ª dose</Badge>
                          )}
                        </div>
                        <div className="text-sm text-muted-foreground mt-1 space-y-0.5">
                          {vaccine.manufacturer && <p>Fabricante: {vaccine.manufacturer}</p>}
                          {vaccine.batch_number && <p>Lote: {vaccine.batch_number}</p>}
                          {vaccine.administered_by && <p>Aplicado por: {vaccine.administered_by}</p>}
                        </div>
                      </div>
                      <div className="text-right text-sm">
                        <p className="font-medium">
                          {safeFormat(vaccine.administered_at, "dd/MM/yyyy")}
                        </p>
                        {vaccine.next_dose_date && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Próxima: {safeFormat(vaccine.next_dose_date, "dd/MM/yyyy")}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </PatientLayout>
  );
}
