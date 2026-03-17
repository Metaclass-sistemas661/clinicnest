import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { FormDrawer, FormDrawerSection } from "@/components/ui/form-drawer";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { DoorOpen, Plus, UserCheck, UserX, Loader2, Clock, MapPin } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Room {
  id: string;
  name: string;
  room_type: string;
  capacity: number;
  floor: string | null;
  equipment: string[] | null;
  is_active: boolean;
  unit_name: string | null;
}

interface Occupancy {
  id: string;
  room_id: string;
  client_name: string | null;
  professional_name: string | null;
  status: string;
  started_at: string;
  notes: string | null;
}

const ROOM_TYPES = [
  { value: "consultation", label: "Consultório" },
  { value: "procedure", label: "Sala de Procedimentos" },
  { value: "exam", label: "Sala de Exames" },
  { value: "waiting", label: "Sala de Espera" },
  { value: "surgery", label: "Centro Cirúrgico" },
  { value: "recovery", label: "Recuperação" },
  { value: "other", label: "Outros" },
];

function roomTypeBadge(type: string) {
  const t = ROOM_TYPES.find(r => r.value === type);
  const colors: Record<string, string> = {
    consultation: "bg-blue-50 text-blue-700 border-blue-200",
    procedure: "bg-purple-50 text-purple-700 border-purple-200",
    exam: "bg-teal-50 text-teal-700 border-teal-200",
    surgery: "bg-red-50 text-red-700 border-red-200",
    recovery: "bg-yellow-50 text-yellow-700 border-yellow-200",
  };
  return <Badge variant="outline" className={`text-xs ${colors[type] ?? ""}`}>{t?.label ?? type}</Badge>;
}

export default function GestaoSalas() {
  const { profile, isAdmin } = useAuth();
  const [rooms, setRooms] = useState<Room[]>([]);
  const [occupancies, setOccupancies] = useState<Map<string, Occupancy>>(new Map());
  const [isLoading, setIsLoading] = useState(true);

  // Room dialog
  const [roomDialog, setRoomDialog] = useState(false);
  const [roomForm, setRoomForm] = useState({ name: "", room_type: "consultation", capacity: "1", floor: "", equipment: "" });
  const [isSavingRoom, setIsSavingRoom] = useState(false);

  // Occupy dialog
  const [occupyDialog, setOccupyDialog] = useState(false);
  const [occupyRoom, setOccupyRoom] = useState<Room | null>(null);
  const [occupyForm, setOccupyForm] = useState({ client_name: "", notes: "" });
  const [isSavingOccupy, setIsSavingOccupy] = useState(false);

  useEffect(() => {
    if (profile?.tenant_id) {
      void fetchRooms();
      void fetchOccupancies();
    }
  }, [profile?.tenant_id]);

  // Realtime subscription
  useEffect(() => {
    if (!profile?.tenant_id) return;
    const channel = supabase
      .channel("room-occupancies-realtime")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "room_occupancies",
        filter: `tenant_id=eq.${profile.tenant_id}`,
      }, () => {
        void fetchOccupancies();
      })
      .subscribe();

    return () => { void supabase.removeChannel(channel); };
  }, [profile?.tenant_id]);

  const fetchRooms = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("clinic_rooms")
        .select("*, clinic_units(name)")
        .eq("tenant_id", profile.tenant_id)
        .order("name");
      if (error) throw error;
      setRooms(((data ?? []) as any[]).map(r => ({
        id: r.id,
        name: r.name,
        room_type: r.room_type,
        capacity: r.capacity,
        floor: r.floor,
        equipment: r.equipment,
        is_active: r.is_active,
        unit_name: r.clinic_units?.name ?? null,
      })));
    } catch (err) {
      logger.error("GestaoSalas fetchRooms:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchOccupancies = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("room_occupancies")
        .select("*, profiles(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .eq("status", "occupied");
      if (error) throw error;
      const map = new Map<string, Occupancy>();
      for (const r of (data ?? []) as any[]) {
        map.set(r.room_id, {
          id: r.id,
          room_id: r.room_id,
          client_name: r.client_name,
          professional_name: r.profiles?.full_name ?? null,
          status: r.status,
          started_at: r.started_at,
          notes: r.notes,
        });
      }
      setOccupancies(map);
    } catch (err) {
      logger.error("GestaoSalas fetchOccupancies:", err);
    }
  };

  const handleCreateRoom = async () => {
    if (!roomForm.name.trim()) { toast.error("Nome é obrigatório"); return; }
    setIsSavingRoom(true);
    try {
      const eq = roomForm.equipment.split(",").map(s => s.trim()).filter(Boolean);
      const { error } = await supabase.from("clinic_rooms").insert({
        tenant_id: profile!.tenant_id,
        name: roomForm.name,
        room_type: roomForm.room_type,
        capacity: Number(roomForm.capacity) || 1,
        floor: roomForm.floor || null,
        equipment: eq.length > 0 ? eq : null,
      });
      if (error) throw error;
      toast.success("Sala criada");
      setRoomDialog(false);
      setRoomForm({ name: "", room_type: "consultation", capacity: "1", floor: "", equipment: "" });
      void fetchRooms();
    } catch (err) {
      logger.error("GestaoSalas createRoom:", err);
      toast.error("Erro ao criar sala");
    } finally {
      setIsSavingRoom(false);
    }
  };

  const handleOccupy = async () => {
    if (!occupyRoom || !profile?.tenant_id) return;
    if (!occupyForm.client_name.trim()) { toast.error("Nome do paciente é obrigatório"); return; }
    setIsSavingOccupy(true);
    try {
      const { error } = await supabase.from("room_occupancies").insert({
        tenant_id: profile.tenant_id,
        room_id: occupyRoom.id,
        professional_id: profile.id,
        client_name: occupyForm.client_name,
        status: "occupied",
        notes: occupyForm.notes || null,
      });
      if (error) throw error;
      toast.success(`${occupyRoom.name} ocupada`);
      setOccupyDialog(false);
      setOccupyForm({ client_name: "", notes: "" });
      void fetchOccupancies();
    } catch (err) {
      logger.error("GestaoSalas occupy:", err);
      toast.error("Erro ao ocupar sala");
    } finally {
      setIsSavingOccupy(false);
    }
  };

  const handleRelease = async (occupancy: Occupancy) => {
    try {
      const { error } = await supabase
        .from("room_occupancies")
        .update({ status: "released", ended_at: new Date().toISOString() })
        .eq("id", occupancy.id)
        .eq("tenant_id", profile!.tenant_id);
      if (error) throw error;
      toast.success("Sala liberada");
      void fetchOccupancies();
    } catch (err) {
      logger.error("GestaoSalas release:", err);
      toast.error("Erro ao liberar sala");
    }
  };

  const occupiedCount = rooms.filter(r => occupancies.has(r.id)).length;
  const availableCount = rooms.filter(r => r.is_active && !occupancies.has(r.id)).length;

  return (
    <MainLayout
      title="Gestão de Salas"
      subtitle="Ocupação e disponibilidade em tempo real"
      actions={isAdmin ? (
        <Button variant="gradient" className="gap-2" onClick={() => setRoomDialog(true)}>
          <Plus className="h-4 w-4" /> Nova Sala
        </Button>
      ) : undefined}
    >
      {/* KPIs */}
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
              <DoorOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total de Salas</p>
              <p className="text-2xl font-bold">{rooms.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
              <UserCheck className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Disponíveis</p>
              <p className="text-2xl font-bold text-green-600">{availableCount}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-4 p-5">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-red-500/10">
              <UserX className="h-5 w-5 text-red-600" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Ocupadas</p>
              <p className="text-2xl font-bold text-red-600">{occupiedCount}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Room grid */}
      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : rooms.length === 0 ? (
        <EmptyState icon={DoorOpen} title="Nenhuma sala cadastrada" description="Cadastre as salas da clínica para gerenciar a ocupação em tempo real." />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map(room => {
            const occ = occupancies.get(room.id);
            const isOccupied = !!occ;

            return (
              <Card key={room.id} className={`transition-all ${isOccupied ? "border-red-200 bg-red-50/30 dark:bg-red-950/10" : "border-green-200 bg-green-50/30 dark:bg-green-950/10"}`}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{room.name}</CardTitle>
                      <CardDescription className="flex items-center gap-1 mt-0.5">
                        {room.unit_name && <><MapPin className="h-3 w-3" />{room.unit_name} · </>}
                        {room.floor && `Andar ${room.floor} · `}
                        Cap. {room.capacity}
                      </CardDescription>
                    </div>
                    {roomTypeBadge(room.room_type)}
                  </div>
                </CardHeader>
                <CardContent>
                  {isOccupied ? (
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="destructive" className="text-xs gap-1">
                          <UserX className="h-3 w-3" /> Ocupada
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          <Clock className="h-3 w-3 inline mr-0.5" />
                          {formatDistanceToNow(new Date(occ.started_at), { locale: ptBR, addSuffix: true })}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="font-medium">{occ.client_name}</span>
                        {occ.professional_name && (
                          <span className="text-muted-foreground"> — {occ.professional_name}</span>
                        )}
                      </div>
                      {occ.notes && <p className="text-xs text-muted-foreground">{occ.notes}</p>}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1 gap-1.5 text-green-700 border-green-300 hover:bg-green-50"
                        onClick={() => void handleRelease(occ)}
                        disabled={!isAdmin}
                        title={!isAdmin ? "Somente administradores podem liberar salas" : undefined}
                      >
                        <UserCheck className="h-3.5 w-3.5" /> Liberar Sala
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Badge className="bg-green-600 text-white text-xs gap-1">
                        <UserCheck className="h-3 w-3" /> Disponível
                      </Badge>
                      {room.equipment && room.equipment.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {room.equipment.map((eq, i) => (
                            <Badge key={i} variant="outline" className="text-[10px]">{eq}</Badge>
                          ))}
                        </div>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-1 gap-1.5"
                        onClick={() => { setOccupyRoom(room); setOccupyForm({ client_name: "", notes: "" }); setOccupyDialog(true); }}
                        disabled={!isAdmin}
                        title={!isAdmin ? "Somente administradores podem ocupar salas" : undefined}
                      >
                        <UserX className="h-3.5 w-3.5" /> Ocupar Sala
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Room FormDrawer */}
      <FormDrawer
        open={roomDialog}
        onOpenChange={setRoomDialog}
        title="Nova Sala"
        description="Cadastre uma nova sala/consultório"
        width="md"
        onSubmit={handleCreateRoom}
        isSubmitting={isSavingRoom}
        submitLabel="Criar Sala"
      >
        <FormDrawerSection title="Identificação">
          <div className="space-y-2">
            <Label>Nome *</Label>
            <Input value={roomForm.name} onChange={e => setRoomForm(f => ({ ...f, name: e.target.value }))} placeholder="Ex: Consultório 1, Sala de Exames A..." required />
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Tipo e Capacidade">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Tipo</Label>
              <Select value={roomForm.room_type} onValueChange={v => setRoomForm(f => ({ ...f, room_type: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {ROOM_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Capacidade</Label>
              <Input type="number" min="1" value={roomForm.capacity} onChange={e => setRoomForm(f => ({ ...f, capacity: e.target.value }))} />
            </div>
          </div>
        </FormDrawerSection>

        <FormDrawerSection title="Localização e Equipamentos">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Andar</Label>
              <Input value={roomForm.floor} onChange={e => setRoomForm(f => ({ ...f, floor: e.target.value }))} placeholder="Térreo, 1, 2..." />
            </div>
            <div className="space-y-2">
              <Label>Equipamentos (separados por vírgula)</Label>
              <Input value={roomForm.equipment} onChange={e => setRoomForm(f => ({ ...f, equipment: e.target.value }))} placeholder="Maca, Autoclave, Monitor..." />
            </div>
          </div>
        </FormDrawerSection>
      </FormDrawer>

      {/* Occupy Room Dialog */}
      <Dialog open={occupyDialog} onOpenChange={setOccupyDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ocupar {occupyRoom?.name}</DialogTitle>
            <DialogDescription>Registre a ocupação da sala</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Nome do Paciente *</Label>
              <Input value={occupyForm.client_name} onChange={e => setOccupyForm(f => ({ ...f, client_name: e.target.value }))} placeholder="Nome do paciente em atendimento" />
            </div>
            <div className="space-y-2">
              <Label>Observações</Label>
              <Input value={occupyForm.notes} onChange={e => setOccupyForm(f => ({ ...f, notes: e.target.value }))} placeholder="Procedimento, observações..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOccupyDialog(false)}>Cancelar</Button>
            <Button onClick={() => void handleOccupy()} disabled={isSavingOccupy}>
              {isSavingOccupy ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Ocupando...</> : "Confirmar Ocupação"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
