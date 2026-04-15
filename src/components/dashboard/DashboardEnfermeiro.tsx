import { useEffect, useState, useCallback, memo } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ClipboardList, Activity, DoorOpen, UserCheck,
  AlertTriangle, Heart, Thermometer, Users, Megaphone,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { startOfDay, endOfDay } from "date-fns";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import type { Appointment } from "@/types/database";
import { CallNextButton } from "@/components/queue/CallNextButton";

interface TriageItem {
  id: string;
  client_name: string;
  priority: string;
  chief_complaint: string;
  triaged_at: string;
  appointment_id: string | null;
}

interface RoomItem {
  id: string;
  name: string;
  room_type: string;
  floor: string | null;
  is_occupied: boolean;
}

const priorityStyles: Record<string, string> = {
  emergencia: "bg-red-500/10 text-red-600 border-red-500/30",
  urgente: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  pouco_urgente: "bg-amber-500/10 text-amber-600 border-amber-500/30",
  nao_urgente: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};
const priorityLabels: Record<string, string> = {
  emergencia: "Emergência",
  urgente: "Urgente",
  pouco_urgente: "Pouco Urgente",
  nao_urgente: "Não Urgente",
};

const priorityOrder: Record<string, number> = {
  emergencia: 0,
  urgente: 1,
  pouco_urgente: 2,
  nao_urgente: 3,
};

export const DashboardEnfermeiro = memo(function DashboardEnfermeiro() {
  const { profile } = useAuth();
  const [pendingTriages, setPendingTriages] = useState<TriageItem[]>([]);
  const [rooms, setRooms] = useState<RoomItem[]>([]);
  const [arrivedPatients, setArrivedPatients] = useState<Appointment[]>([]);
  const [todayTriagedCount, setTodayTriagedCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    if (!profile?.tenant_id) return;
    const now = new Date();
    const dayStart = startOfDay(now).toISOString();
    const dayEnd = endOfDay(now).toISOString();

    try {
      const [triagesRes, roomsRes, arrivedRes, triagedTodayRes] = await Promise.all([
        api
          .from("triage_records")
          .select("id, chief_complaint, priority, triaged_at, appointment_id, patient:patients(name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "pendente")
          .order("triaged_at", { ascending: true })
          .limit(15),
        api
          .from("clinic_rooms")
          .select("id, name, room_type, floor")
          .eq("tenant_id", profile.tenant_id)
          .eq("is_active", true),
        api
          .from("appointments")
          .select("*, patient:patients(name, phone), procedure:procedures(name), professional:profiles!professional_id(full_name)")
          .eq("tenant_id", profile.tenant_id)
          .eq("status", "arrived")
          .gte("scheduled_at", dayStart)
          .lte("scheduled_at", dayEnd)
          .order("scheduled_at", { ascending: true }),
        api
          .from("triage_records")
          .select("id", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .gte("triaged_at", dayStart)
          .lte("triaged_at", dayEnd),
      ]);

      const triagesRaw = (triagesRes.data || []) as any[];
      const triagesMapped = triagesRaw.map((t) => ({
        id: t.id,
        client_name: t.patient?.name || "Paciente",
        priority: t.priority,
        chief_complaint: t.chief_complaint || "",
        triaged_at: t.triaged_at,
        appointment_id: t.appointment_id,
      }));
      triagesMapped.sort((a, b) => (priorityOrder[a.priority] ?? 99) - (priorityOrder[b.priority] ?? 99));
      setPendingTriages(triagesMapped);

      const roomsRaw = (roomsRes.data || []) as any[];
      const occupanciesRes = await api
        .from("room_occupancies")
        .select("room_id")
        .eq("tenant_id", profile.tenant_id)
        .is("released_at", null);
      const occupiedRoomIds = new Set((occupanciesRes.data || []).map((o: any) => o.room_id));
      setRooms(roomsRaw.map((r) => ({
        id: r.id,
        name: r.name,
        room_type: r.room_type || "consultorio",
        floor: r.floor,
        is_occupied: occupiedRoomIds.has(r.id),
      })));

      setArrivedPatients((arrivedRes.data as unknown as Appointment[]) || []);
      setTodayTriagedCount(triagedTodayRes.count ?? 0);
    } catch (e) {
      logger.error("DashboardEnfermeiro fetch error:", e);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const occupiedRooms = rooms.filter((r) => r.is_occupied).length;
  const availableRooms = rooms.filter((r) => !r.is_occupied).length;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-teal-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Botão Chamar Próximo */}
      <Card className="border-teal-200 bg-gradient-to-r from-teal-50 to-emerald-50">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-100">
                <Megaphone className="h-5 w-5 text-teal-600" />
              </div>
              <div>
                <p className="font-semibold text-teal-900">Chamar próximo paciente</p>
                <p className="text-sm text-teal-700">Chame o próximo da fila de espera</p>
              </div>
            </div>
            <CallNextButton 
              professionalId={profile?.id}
              size="lg"
              variant="gradient"
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <div className={`rounded-2xl border p-5 ${pendingTriages.length > 0 ? "border-amber-200 bg-amber-50" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${pendingTriages.length > 0 ? "bg-amber-100" : "bg-muted/50"}`}>
              <ClipboardList className={`h-5 w-5 ${pendingTriages.length > 0 ? "text-amber-600" : "text-muted-foreground"}`} />
            </div>
            {pendingTriages.length > 0 && (
              <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Atenção</span>
            )}
          </div>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${pendingTriages.length > 0 ? "text-amber-700" : ""}`}>
            {pendingTriages.length}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Triagens pendentes</p>
        </div>

        <div className={`rounded-2xl border p-5 ${arrivedPatients.length > 0 ? "border-violet-200 bg-violet-50" : "bg-card"}`}>
          <div className="flex items-center justify-between mb-4">
            <div className={`flex h-11 w-11 items-center justify-center rounded-xl ${arrivedPatients.length > 0 ? "bg-violet-100" : "bg-muted/50"}`}>
              <UserCheck className={`h-5 w-5 ${arrivedPatients.length > 0 ? "text-violet-600" : "text-muted-foreground"}`} />
            </div>
          </div>
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${arrivedPatients.length > 0 ? "text-violet-700" : ""}`}>
            {arrivedPatients.length}
          </p>
          <p className="mt-1.5 text-sm text-muted-foreground">Aguardando atendimento</p>
        </div>

        <Link to="/gestao-salas" className="[&:hover]:no-underline">
          <div className="group rounded-2xl border bg-card p-5 transition-all hover:border-teal-200 hover:shadow-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-100">
                <DoorOpen className="h-5 w-5 text-blue-600" />
              </div>
              <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">Salas</span>
            </div>
            <div className="flex items-baseline gap-1">
              <p className="text-3xl font-extrabold tabular-nums leading-none">{availableRooms}</p>
              <span className="text-sm text-muted-foreground">/{rooms.length}</span>
            </div>
            <p className="mt-1.5 text-sm text-muted-foreground">Salas disponíveis</p>
          </div>
        </Link>

        <div className="rounded-2xl border bg-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-emerald-100">
              <Activity className="h-5 w-5 text-emerald-600" />
            </div>
            <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Hoje</span>
          </div>
          <p className="text-3xl font-extrabold tabular-nums leading-none">{todayTriagedCount}</p>
          <p className="mt-1.5 text-sm text-muted-foreground">Triagens realizadas</p>
        </div>
      </div>

      {/* Triagens pendentes (principal) */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-600/10">
              <ClipboardList className="h-4 w-4 text-amber-600" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold">Triagens pendentes</CardTitle>
              <CardDescription className="text-xs">Ordenadas por prioridade — atenda emergências primeiro</CardDescription>
            </div>
          </div>
          {pendingTriages.length > 0 && (
            <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/30">{pendingTriages.length}</Badge>
          )}
        </CardHeader>
        <CardContent>
          {pendingTriages.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <ClipboardList className="h-12 w-12 text-muted-foreground/30 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Sem triagens pendentes</p>
              <p className="text-xs text-muted-foreground/70 mt-1">Todos os pacientes foram triados</p>
            </div>
          ) : (
            <div className="space-y-2">
              {pendingTriages.map((t) => {
                const isEmergency = t.priority === "emergencia" || t.priority === "urgente";
                return (
                  <div key={t.id} className={`flex items-center justify-between gap-3 rounded-lg border p-3 transition-colors ${isEmergency ? "border-red-200 bg-red-50/50 hover:bg-red-50" : "border-border/70 hover:bg-muted/40"}`}>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        {isEmergency && <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />}
                        <p className="text-sm font-medium truncate">{t.client_name}</p>
                      </div>
                      {t.chief_complaint && <p className="text-xs text-muted-foreground truncate mt-0.5">{t.chief_complaint}</p>}
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="outline" className={priorityStyles[t.priority] || priorityStyles.nao_urgente}>
                        {priorityLabels[t.priority] || t.priority}
                      </Badge>
                      <span className="text-xs text-muted-foreground tabular-nums">{formatInAppTz(new Date(t.triaged_at), "HH:mm")}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Salas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600/10">
                <DoorOpen className="h-4 w-4 text-blue-600" />
              </div>
              <CardTitle className="text-base font-semibold">Salas</CardTitle>
            </div>
            <Button variant="ghost" size="sm" asChild className="text-xs text-teal-600 hover:bg-teal-50">
              <Link to="/gestao-salas">Gerenciar →</Link>
            </Button>
          </CardHeader>
          <CardContent>
            {rooms.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <DoorOpen className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhuma sala cadastrada</p>
              </div>
            ) : (
              <div className="grid gap-2 grid-cols-2">
                {rooms.map((room) => (
                  <div key={room.id} className={`rounded-lg border px-3 py-2.5 ${room.is_occupied ? "border-red-200 bg-red-50/50" : "border-emerald-200 bg-emerald-50/50"}`}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${room.is_occupied ? "bg-red-500" : "bg-emerald-500"}`} />
                      <p className="text-sm font-medium truncate">{room.name}</p>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 capitalize">{room.room_type.replace(/_/g, " ")}{room.floor ? ` • ${room.floor}` : ""}</p>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Pacientes aguardando */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600/10">
                <Users className="h-4 w-4 text-violet-600" />
              </div>
              <div>
                <CardTitle className="text-base font-semibold">Pacientes aguardando</CardTitle>
                <CardDescription className="text-xs">Check-in feito — aguardando atendimento</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {arrivedPatients.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <UserCheck className="h-10 w-10 text-muted-foreground/30 mb-2" />
                <p className="text-sm text-muted-foreground">Nenhum paciente aguardando</p>
              </div>
            ) : (
              <div className="space-y-2">
                {arrivedPatients.map((apt) => (
                  <div key={apt.id} className="flex items-center gap-3 rounded-lg border border-violet-200 bg-violet-50/50 px-3 py-2.5">
                    <span className="shrink-0 rounded-md border border-violet-200 bg-violet-50 px-2 py-0.5 text-xs font-bold tabular-nums text-violet-700">
                      {formatInAppTz(apt.scheduled_at, "HH:mm")}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{apt.patient?.name || "Paciente"}</p>
                      {apt.professional?.full_name && <p className="text-xs text-muted-foreground truncate">{apt.professional.full_name}</p>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
});
