import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";
import { format, addDays, startOfWeek, isSameDay } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Slot {
  slot_date: string;
  slot_time: string;
  slot_datetime: string;
}

interface SlotPickerProps {
  slots: Slot[];
  isLoading: boolean;
  selectedSlot: Slot | null;
  onSelectSlot: (slot: Slot) => void;
  onWeekChange: (startDate: Date, endDate: Date) => void;
  minDate?: Date;
  maxDate?: Date;
}

export function SlotPicker({
  slots,
  isLoading,
  selectedSlot,
  onSelectSlot,
  onWeekChange,
  minDate = new Date(),
  maxDate,
}: SlotPickerProps) {
  const [weekStart, setWeekStart] = useState(() => {
    const today = new Date();
    return startOfWeek(today, { weekStartsOn: 0 });
  });

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const endDate = addDays(weekStart, 6);
    onWeekChange(weekStart, endDate);
  }, [weekStart, onWeekChange]);

  const goToPreviousWeek = () => {
    const newStart = addDays(weekStart, -7);
    if (newStart >= startOfWeek(minDate, { weekStartsOn: 0 })) {
      setWeekStart(newStart);
    }
  };

  const goToNextWeek = () => {
    const newStart = addDays(weekStart, 7);
    if (!maxDate || newStart <= maxDate) {
      setWeekStart(newStart);
    }
  };

  const canGoPrevious = weekStart > startOfWeek(minDate, { weekStartsOn: 0 });
  const canGoNext = !maxDate || addDays(weekStart, 7) <= maxDate;

  const getSlotsForDay = (day: Date) => {
    return slots.filter((slot) => {
      const slotDate = new Date(slot.slot_date);
      return isSameDay(slotDate, day);
    });
  };

  const isSlotSelected = (slot: Slot) => {
    return selectedSlot?.slot_datetime === slot.slot_datetime;
  };

  return (
    <div className="space-y-4">
      {/* Week navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="icon"
          onClick={goToPreviousWeek}
          disabled={!canGoPrevious}
          className="h-8 w-8"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-medium">
          {format(weekStart, "dd 'de' MMM", { locale: ptBR })} -{" "}
          {format(addDays(weekStart, 6), "dd 'de' MMM", { locale: ptBR })}
        </span>
        <Button
          variant="outline"
          size="icon"
          onClick={goToNextWeek}
          disabled={!canGoNext}
          className="h-8 w-8"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days grid */}
      <div className="grid grid-cols-7 gap-1">
        {weekDays.map((day) => {
          const daySlots = getSlotsForDay(day);
          const isPast = day < new Date(new Date().setHours(0, 0, 0, 0));
          const isToday = isSameDay(day, new Date());

          return (
            <div
              key={day.toISOString()}
              className={cn(
                "text-center p-1 rounded-lg",
                isToday && "bg-teal-50 dark:bg-teal-950/30"
              )}
            >
              <div className="text-[10px] text-muted-foreground uppercase">
                {format(day, "EEE", { locale: ptBR })}
              </div>
              <div
                className={cn(
                  "text-sm font-medium",
                  isPast && "text-muted-foreground/50"
                )}
              >
                {format(day, "dd")}
              </div>
            </div>
          );
        })}
      </div>

      {/* Slots */}
      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">Nenhum horário disponível nesta semana</p>
          <p className="text-xs mt-1">Tente outra semana ou profissional</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
          {weekDays.map((day) => {
            const daySlots = getSlotsForDay(day);
            if (daySlots.length === 0) return null;

            return (
              <div key={day.toISOString()}>
                <div className="text-xs font-medium text-muted-foreground mb-2 capitalize">
                  {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                </div>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <Button
                      key={slot.slot_datetime}
                      variant={isSlotSelected(slot) ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectSlot(slot)}
                      className={cn(
                        "h-9 px-3 text-sm",
                        isSlotSelected(slot) &&
                          "bg-teal-600 hover:bg-teal-700 text-white"
                      )}
                    >
                      {slot.slot_time.slice(0, 5)}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
