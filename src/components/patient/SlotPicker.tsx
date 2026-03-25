import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ChevronRight, Clock, CalendarOff } from "lucide-react";
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

  // Selected day state for mobile drill-down
  const [selectedDay, setSelectedDay] = useState<Date | null>(null);

  const dayWithSlots = weekDays.map((day) => ({
    day,
    slots: getSlotsForDay(day),
    isPast: day < new Date(new Date().setHours(0, 0, 0, 0)),
    isToday: isSameDay(day, new Date()),
  }));

  // For mobile: if user taps a day, show only that day's slots
  const visibleDaySlots = selectedDay
    ? dayWithSlots.filter((d) => isSameDay(d.day, selectedDay))
    : dayWithSlots.filter((d) => d.slots.length > 0);

  return (
    <div className="space-y-5">
      {/* Week navigation */}
      <div className="flex items-center justify-between bg-muted/40 rounded-xl px-3 py-2.5">
        <Button
          variant="ghost"
          size="icon"
          onClick={goToPreviousWeek}
          disabled={!canGoPrevious}
          className="h-8 w-8 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40"
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="text-sm font-semibold tracking-tight">
          {format(weekStart, "dd 'de' MMM", { locale: ptBR })} —{" "}
          {format(addDays(weekStart, 6), "dd 'de' MMM, yyyy", { locale: ptBR })}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={goToNextWeek}
          disabled={!canGoNext}
          className="h-8 w-8 rounded-lg hover:bg-teal-50 dark:hover:bg-teal-950/40"
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Days grid - interactive calendar strip */}
      <div className="grid grid-cols-7 gap-1.5">
        {dayWithSlots.map(({ day, slots: daySlots, isPast, isToday }) => {
          const hasSlots = daySlots.length > 0;
          const isSelected = selectedDay ? isSameDay(day, selectedDay) : false;

          return (
            <button
              key={day.toISOString()}
              type="button"
              onClick={() => {
                if (!isPast && hasSlots) {
                  setSelectedDay(isSelected ? null : day);
                }
              }}
              disabled={isPast || !hasSlots}
              className={cn(
                "flex flex-col items-center py-2 px-1 rounded-xl transition-all text-center",
                isPast && "opacity-40 cursor-not-allowed",
                !isPast && hasSlots && "cursor-pointer hover:bg-teal-50 dark:hover:bg-teal-950/40",
                !isPast && !hasSlots && "cursor-not-allowed opacity-50",
                isSelected && "bg-teal-100 dark:bg-teal-900/50 ring-2 ring-teal-500",
                isToday && !isSelected && "bg-teal-50/70 dark:bg-teal-950/20"
              )}
            >
              <span className="text-[10px] text-muted-foreground uppercase font-medium">
                {format(day, "EEE", { locale: ptBR })}
              </span>
              <span
                className={cn(
                  "text-sm font-bold mt-0.5",
                  isToday && "text-teal-600 dark:text-teal-400",
                  isPast && "text-muted-foreground"
                )}
              >
                {format(day, "dd")}
              </span>
              {hasSlots && !isPast && (
                <div className="flex gap-0.5 mt-1">
                  {daySlots.length <= 3
                    ? daySlots.map((_, i) => (
                        <div key={i} className="h-1 w-1 rounded-full bg-teal-500" />
                      ))
                    : (
                      <>
                        <div className="h-1 w-1 rounded-full bg-teal-500" />
                        <div className="h-1 w-1 rounded-full bg-teal-500" />
                        <div className="h-1 w-1 rounded-full bg-teal-400" />
                      </>
                    )}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Slots list */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-3/4 rounded-lg" />
        </div>
      ) : slots.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground">
          <CalendarOff className="h-10 w-10 mx-auto mb-3 text-muted-foreground/40" />
          <p className="text-sm font-medium">Nenhum horário disponível nesta semana</p>
          <p className="text-xs mt-1.5">Navegue para outra semana ou selecione outro profissional</p>
        </div>
      ) : (
        <div className="space-y-4 max-h-[340px] overflow-y-auto pr-1 scrollbar-thin">
          {visibleDaySlots.map(({ day, slots: daySlots }) => {
            if (daySlots.length === 0) return null;

            return (
              <div key={day.toISOString()}>
                <div className="flex items-center gap-2 mb-2.5">
                  <div className="h-1.5 w-1.5 rounded-full bg-teal-500" />
                  <span className="text-xs font-semibold text-foreground/70 capitalize">
                    {format(day, "EEEE, dd 'de' MMMM", { locale: ptBR })}
                  </span>
                  <span className="text-[10px] text-muted-foreground ml-auto">
                    {daySlots.length} {daySlots.length === 1 ? "horário" : "horários"}
                  </span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {daySlots.map((slot) => (
                    <Button
                      key={slot.slot_datetime}
                      variant={isSlotSelected(slot) ? "default" : "outline"}
                      size="sm"
                      onClick={() => onSelectSlot(slot)}
                      className={cn(
                        "h-10 px-4 text-sm font-medium rounded-lg transition-all",
                        isSlotSelected(slot)
                          ? "bg-teal-600 hover:bg-teal-700 text-white shadow-md shadow-teal-600/20"
                          : "hover:border-teal-300 hover:bg-teal-50/50 dark:hover:border-teal-700 dark:hover:bg-teal-950/30"
                      )}
                    >
                      <Clock className={cn("h-3 w-3 mr-1.5", isSlotSelected(slot) ? "text-white" : "text-muted-foreground")} />
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
