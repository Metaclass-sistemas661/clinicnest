import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Clock, AlertTriangle, UserCheck } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Profile, Appointment } from "@/types/database";

interface TimeSlotPickerProps {
  selectedTime: string;
  onTimeChange: (time: string) => void;
  selectedDate: string;
  selectedProfessional: string;
  professionals: Profile[];
  existingAppointments: Appointment[];
  onProfessionalChange?: (professionalId: string) => void;
}

// Gerar slots de 45 em 45 minutos
const generateTimeSlots = () => {
  const slots: string[] = [];
  let hour = 8; // Início às 8h
  let minute = 0;

  while (hour < 20 || (hour === 20 && minute === 0)) {
    const formattedHour = hour.toString().padStart(2, "0");
    const formattedMinute = minute.toString().padStart(2, "0");
    slots.push(`${formattedHour}:${formattedMinute}`);

    minute += 45;
    if (minute >= 60) {
      hour += 1;
      minute = minute - 60;
    }
  }

  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function TimeSlotPicker({
  selectedTime,
  onTimeChange,
  selectedDate,
  selectedProfessional,
  professionals,
  existingAppointments,
  onProfessionalChange,
}: TimeSlotPickerProps) {
  const [hoveredSlot, setHoveredSlot] = useState<string | null>(null);

  // Verificar conflitos para cada slot/profissional
  const slotAvailability = useMemo(() => {
    const availability: Record<
      string,
      { available: boolean; conflictProfessional?: string; availableProfessionals: Profile[] }
    > = {};

    TIME_SLOTS.forEach((slot) => {
      if (!selectedDate) {
        availability[slot] = { available: true, availableProfessionals: professionals };
        return;
      }

      const slotDateTime = new Date(`${selectedDate}T${slot}`);

      // Encontrar profissionais disponíveis neste horário
      const availableProfessionals = professionals.filter((prof) => {
        // Verificar se o profissional tem conflito neste horário
        const hasConflict = existingAppointments.some((apt) => {
          if (apt.professional_id !== prof.id) return false;
          if (apt.status === "cancelled") return false;

          const aptStart = new Date(apt.scheduled_at);
          const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
          const slotEnd = new Date(slotDateTime.getTime() + 45 * 60000);

          // Verificar sobreposição
          return slotDateTime < aptEnd && slotEnd > aptStart;
        });

        return !hasConflict;
      });

      // Se um profissional está selecionado, verificar se ele está disponível
      if (selectedProfessional && selectedProfessional !== "all") {
        const selectedProfHasConflict = !availableProfessionals.some(
          (p) => p.id === selectedProfessional
        );

        if (selectedProfHasConflict) {
          const conflictingApt = existingAppointments.find((apt) => {
            if (apt.professional_id !== selectedProfessional) return false;
            if (apt.status === "cancelled") return false;

            const aptStart = new Date(apt.scheduled_at);
            const aptEnd = new Date(aptStart.getTime() + apt.duration_minutes * 60000);
            const slotEnd = new Date(slotDateTime.getTime() + 45 * 60000);

            return slotDateTime < aptEnd && slotEnd > aptStart;
          });

          availability[slot] = {
            available: false,
            conflictProfessional: conflictingApt?.professional?.full_name,
            availableProfessionals,
          };
        } else {
          availability[slot] = { available: true, availableProfessionals };
        }
      } else {
        // Nenhum profissional selecionado - slot disponível se houver pelo menos um profissional livre
        availability[slot] = {
          available: availableProfessionals.length > 0,
          availableProfessionals,
        };
      }
    });

    return availability;
  }, [selectedDate, selectedProfessional, professionals, existingAppointments]);

  const handleSlotClick = (slot: string) => {
    const slotInfo = slotAvailability[slot];

    if (!slotInfo.available && slotInfo.availableProfessionals.length > 0 && onProfessionalChange) {
      // Sugerir o primeiro profissional disponível
      onProfessionalChange(slotInfo.availableProfessionals[0].id);
    }

    onTimeChange(slot);
  };

  const currentSlotInfo = selectedTime ? slotAvailability[selectedTime] : null;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-foreground">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <span>Horário (intervalos de 45 min)</span>
      </div>

      {/* Aviso de conflito com sugestão */}
      {currentSlotInfo && !currentSlotInfo.available && currentSlotInfo.availableProfessionals.length > 0 && (
        <div className="rounded-lg border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-warning mt-0.5 shrink-0" />
            <div className="flex-1 text-sm">
              <p className="font-medium text-warning">Profissional ocupado neste horário</p>
              <p className="text-muted-foreground mt-1">
                Profissionais disponíveis:
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                {currentSlotInfo.availableProfessionals.map((prof) => (
                  <Button
                    key={prof.id}
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs border-success/30 bg-success/10 text-success hover:bg-success/20"
                    onClick={() => onProfessionalChange?.(prof.id)}
                  >
                    <UserCheck className="mr-1 h-3 w-3" />
                    {prof.full_name}
                  </Button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Grid de horários */}
      <ScrollArea className="h-[200px] rounded-lg border border-border bg-muted/30 p-2">
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {TIME_SLOTS.map((slot) => {
            const slotInfo = slotAvailability[slot];
            const isSelected = selectedTime === slot;
            const _isHovered = hoveredSlot === slot;
            const hasConflict = !slotInfo.available && selectedProfessional;
            const hasAlternatives = slotInfo.availableProfessionals.length > 0;

            return (
              <Button
                key={slot}
                type="button"
                variant={isSelected ? "default" : "outline"}
                size="sm"
                className={cn(
                  "relative h-10 font-mono text-sm transition-all",
                  isSelected && "gradient-primary text-primary-foreground",
                  hasConflict && !isSelected && "border-warning/50 bg-warning/10 text-warning",
                  hasConflict && hasAlternatives && !isSelected && "hover:border-success/50"
                )}
                onClick={() => handleSlotClick(slot)}
                onMouseEnter={() => setHoveredSlot(slot)}
                onMouseLeave={() => setHoveredSlot(null)}
              >
                {slot}
                {hasConflict && hasAlternatives && !isSelected && (
                  <Badge
                    className="absolute -top-1 -right-1 h-4 w-4 p-0 flex items-center justify-center text-[10px] bg-success text-success-foreground"
                  >
                    {slotInfo.availableProfessionals.length}
                  </Badge>
                )}
              </Button>
            );
          })}
        </div>
      </ScrollArea>

      {/* Legenda */}
      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded border bg-background" />
          <span>Disponível</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="h-3 w-3 rounded bg-warning/30 border-warning/50" />
          <span>Ocupado</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="relative h-3 w-3 rounded bg-warning/30 border-warning/50">
            <div className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success" />
          </div>
          <span>Outros disponíveis</span>
        </div>
      </div>
    </div>
  );
}
