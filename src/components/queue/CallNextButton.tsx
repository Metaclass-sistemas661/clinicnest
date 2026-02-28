import { useState } from "react";
import { Megaphone, UserPlus, RotateCcw, Play, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  useCallNextPatient,
  useRecallPatient,
  useStartService,
  useMarkNoShow,
  useCurrentCall,
  useWaitingQueue,
} from "@/hooks/usePatientQueue";
import { useRooms } from "@/hooks/useRooms";
import { Badge } from "@/components/ui/badge";

interface CallNextButtonProps {
  professionalId?: string;
  variant?: "default" | "outline" | "ghost";
  size?: "default" | "sm" | "lg" | "icon";
}

export function CallNextButton({ professionalId, variant = "default", size = "default" }: CallNextButtonProps) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<string>("");

  const { data: rooms } = useRooms();
  const { data: currentCall } = useCurrentCall();
  const { data: queue } = useWaitingQueue(5);
  const callNextMutation = useCallNextPatient();
  const recallMutation = useRecallPatient();
  const startServiceMutation = useStartService();
  const markNoShowMutation = useMarkNoShow();

  const handleCallNext = () => {
    callNextMutation.mutate({
      roomId: selectedRoom || undefined,
      professionalId,
    });
  };

  const handleRecall = () => {
    if (currentCall) {
      recallMutation.mutate(currentCall.call_id);
    }
  };

  const handleStartService = () => {
    if (currentCall) {
      startServiceMutation.mutate(currentCall.call_id);
      setDialogOpen(false);
    }
  };

  const handleNoShow = () => {
    if (currentCall) {
      markNoShowMutation.mutate(currentCall.call_id);
    }
  };

  const waitingCount = queue?.length ?? 0;

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className="gap-2">
          <Megaphone className="h-4 w-4" />
          Chamar
          {waitingCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {waitingCount}
            </Badge>
          )}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5" />
            Painel de Chamada
          </DialogTitle>
          <DialogDescription>
            Chame o próximo paciente da fila de espera
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Paciente atual sendo chamado */}
          {currentCall && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <div className="text-sm text-emerald-600 font-medium mb-1">
                Chamando agora:
              </div>
              <div className="text-lg font-bold text-emerald-800">
                {currentCall.client_name}
              </div>
              {currentCall.room_name && (
                <div className="text-sm text-emerald-600">
                  {currentCall.room_name}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRecall}
                  disabled={recallMutation.isPending}
                >
                  <RotateCcw className="h-4 w-4 mr-1" />
                  Rechamar
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={handleStartService}
                  disabled={startServiceMutation.isPending}
                >
                  <Play className="h-4 w-4 mr-1" />
                  Iniciar
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleNoShow}
                  disabled={markNoShowMutation.isPending}
                  className="text-red-600"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Não veio
                </Button>
              </div>
            </div>
          )}

          {/* Seleção de sala */}
          <div className="space-y-2">
            <Label>Sala/Consultório</Label>
            <Select value={selectedRoom || "__any__"} onValueChange={(v) => setSelectedRoom(v === "__any__" ? "" : v)}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione a sala (opcional)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__any__">Qualquer sala</SelectItem>
                {rooms?.filter(r => r.is_active).map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fila de espera */}
          {queue && queue.length > 0 ? (
            <div className="space-y-2">
              <Label>Próximos na fila ({queue.length})</Label>
              <div className="space-y-1 max-h-40 overflow-y-auto">
                {queue.map((patient, index) => (
                  <div
                    key={patient.call_id}
                    className="flex items-center justify-between p-2 bg-muted rounded text-sm"
                  >
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-muted-foreground">
                        #{index + 1}
                      </span>
                      <span className="font-medium">{patient.client_name}</span>
                      {patient.is_triaged ? (
                        <span className="text-[10px] text-emerald-600 font-medium">✓ Triado</span>
                      ) : (
                        <span className="text-[10px] text-amber-500">Aguarda triagem</span>
                      )}
                    </div>
                    <span className="text-muted-foreground">
                      {patient.wait_time_minutes} min
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Nenhum paciente na fila
            </div>
          )}

          {/* Botão chamar próximo */}
          <Button
            className="w-full"
            onClick={handleCallNext}
            disabled={callNextMutation.isPending || waitingCount === 0}
          >
            <UserPlus className="h-4 w-4 mr-2" />
            {callNextMutation.isPending ? "Chamando..." : "Chamar Próximo"}
          </Button>

          {/* Link para painel TV */}
          <div className="text-center">
            <a
              href="/painel-chamada"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-muted-foreground hover:underline"
            >
              Abrir painel para TV →
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
