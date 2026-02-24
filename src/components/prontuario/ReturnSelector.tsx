import { useState } from "react";
import { addDays, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock, Bell, Calendar } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { RETURN_DAYS_OPTIONS } from "@/hooks/useReturnReminders";

export interface ReturnConfig {
  returnDays: number | null;
  reason: string;
  notifyPatient: boolean;
  notifyDaysBefore: number;
  preferredContact: "whatsapp" | "email" | "sms" | "phone";
  preSchedule: boolean;
}

interface ReturnSelectorProps {
  value: ReturnConfig;
  onChange: (config: ReturnConfig) => void;
  disabled?: boolean;
}

export function ReturnSelector({ value, onChange, disabled }: ReturnSelectorProps) {
  const [isOpen, setIsOpen] = useState(!!value.returnDays);
  const [customDays, setCustomDays] = useState("");

  const handleDaysChange = (days: string) => {
    if (days === "custom") {
      return;
    }
    onChange({ ...value, returnDays: parseInt(days) });
  };

  const handleCustomDays = () => {
    const days = parseInt(customDays);
    if (days > 0) {
      onChange({ ...value, returnDays: days });
    }
  };

  const returnDate = value.returnDays
    ? format(addDays(new Date(), value.returnDays), "dd/MM/yyyy (EEEE)", { locale: ptBR })
    : null;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button
          type="button"
          variant={value.returnDays ? "default" : "outline"}
          className="w-full justify-start gap-2"
          disabled={disabled}
        >
          <CalendarClock className="h-4 w-4" />
          {value.returnDays ? (
            <span>
              Retorno em {value.returnDays} dias ({returnDate})
            </span>
          ) : (
            <span>Agendar Retorno</span>
          )}
        </Button>
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-4 space-y-4 border rounded-lg p-4 bg-muted/30">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label>Retorno em</Label>
            <Select
              value={value.returnDays?.toString() || ""}
              onValueChange={handleDaysChange}
              disabled={disabled}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione o período" />
              </SelectTrigger>
              <SelectContent>
                {RETURN_DAYS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
                <SelectItem value="custom">Personalizado...</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {!RETURN_DAYS_OPTIONS.some((o) => o.value === value.returnDays) && (
            <div className="space-y-2">
              <Label>Dias personalizados</Label>
              <div className="flex gap-2">
                <Input
                  type="number"
                  min={1}
                  placeholder="Ex: 45"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  disabled={disabled}
                />
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handleCustomDays}
                  disabled={disabled || !customDays}
                >
                  OK
                </Button>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-2">
          <Label>Motivo do retorno</Label>
          <Textarea
            placeholder="Ex: Acompanhamento de exames, revisão de tratamento..."
            value={value.reason}
            onChange={(e) => onChange({ ...value, reason: e.target.value })}
            rows={2}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center justify-between py-2 border-t">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="notify-patient" className="cursor-pointer">
              Notificar paciente
            </Label>
          </div>
          <Switch
            id="notify-patient"
            checked={value.notifyPatient}
            onCheckedChange={(checked) => onChange({ ...value, notifyPatient: checked })}
            disabled={disabled}
          />
        </div>

        {value.notifyPatient && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
            <div className="space-y-2">
              <Label>Notificar com antecedência de</Label>
              <Select
                value={value.notifyDaysBefore.toString()}
                onValueChange={(v) => onChange({ ...value, notifyDaysBefore: parseInt(v) })}
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="1">1 dia antes</SelectItem>
                  <SelectItem value="2">2 dias antes</SelectItem>
                  <SelectItem value="3">3 dias antes</SelectItem>
                  <SelectItem value="5">5 dias antes</SelectItem>
                  <SelectItem value="7">7 dias antes</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Canal preferencial</Label>
              <Select
                value={value.preferredContact}
                onValueChange={(v) =>
                  onChange({ ...value, preferredContact: v as ReturnConfig["preferredContact"] })
                }
                disabled={disabled}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  <SelectItem value="email">E-mail</SelectItem>
                  <SelectItem value="sms">SMS</SelectItem>
                  <SelectItem value="phone">Telefone</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between py-2 border-t">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Label htmlFor="pre-schedule" className="cursor-pointer">
              Pré-agendar retorno automaticamente
            </Label>
          </div>
          <Switch
            id="pre-schedule"
            checked={value.preSchedule}
            onCheckedChange={(checked) => onChange({ ...value, preSchedule: checked })}
            disabled={disabled}
          />
        </div>

        {value.returnDays && (
          <div className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
            <strong>Resumo:</strong> O paciente deverá retornar em{" "}
            <strong>{returnDate}</strong>
            {value.notifyPatient && (
              <>
                {" "}
                e será notificado via <strong>{value.preferredContact}</strong>{" "}
                {value.notifyDaysBefore} dia(s) antes
              </>
            )}
            {value.preSchedule && <>, com agendamento automático criado</>}.
          </div>
        )}

        {value.returnDays && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive"
            onClick={() =>
              onChange({
                returnDays: null,
                reason: "",
                notifyPatient: true,
                notifyDaysBefore: 3,
                preferredContact: "whatsapp",
                preSchedule: false,
              })
            }
            disabled={disabled}
          >
            Remover retorno
          </Button>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export const defaultReturnConfig: ReturnConfig = {
  returnDays: null,
  reason: "",
  notifyPatient: true,
  notifyDaysBefore: 3,
  preferredContact: "whatsapp",
  preSchedule: false,
};
