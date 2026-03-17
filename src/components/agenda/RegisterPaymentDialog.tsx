import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, DollarSign, CreditCard, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import type { Appointment } from "@/types/database";

const PAYMENT_METHODS = [
  "Dinheiro",
  "PIX",
  "Cartão de Débito",
  "Cartão de Crédito",
  "Transferência",
  "Boleto",
  "Convênio",
];

const PAYMENT_SOURCES = [
  { value: "particular", label: "Particular" },
  { value: "insurance", label: "Convênio" },
  { value: "mixed", label: "Misto (Particular + Convênio)" },
];

interface RegisterPaymentDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  appointment: Appointment | null;
  onSuccess?: () => void;
}

export function RegisterPaymentDialog({
  open,
  onOpenChange,
  appointment,
  onSuccess,
}: RegisterPaymentDialogProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("PIX");
  const [paymentSource, setPaymentSource] = useState("particular");
  const [notes, setNotes] = useState("");

  const servicePrice = appointment?.price ?? 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!appointment) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error("Informe um valor válido");
      return;
    }

    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("register_appointment_payment", {
        p_appointment_id: appointment.id,
        p_amount: parsedAmount,
        p_payment_method: paymentMethod,
        p_payment_source: paymentSource,
        p_notes: notes || null,
      });

      if (error) throw error;

      toast.success("Pagamento registrado com sucesso!");
      onOpenChange(false);
      resetForm();
      onSuccess?.();
    } catch (error) {
      logger.error("Error registering payment:", error);
      const message = error instanceof Error ? error.message : "Erro ao registrar pagamento";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    setAmount("");
    setPaymentMethod("PIX");
    setPaymentSource("particular");
    setNotes("");
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm();
    } else if (appointment) {
      setAmount(servicePrice.toString());
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-emerald-500" />
            Registrar Pagamento
          </DialogTitle>
          <DialogDescription>
            Registre o pagamento recebido para gerar a receita financeira.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {appointment && (
            <div className="rounded-lg border border-border bg-muted/20 p-3 text-sm space-y-1">
              <p>
                <span className="font-medium text-foreground">Paciente:</span>{" "}
                {appointment.patient?.name ?? "Não informado"}
              </p>
              <p>
                <span className="font-medium text-foreground">Procedimento:</span>{" "}
                {appointment.procedure?.name ?? "Não informado"}
              </p>
              <p>
                <span className="font-medium text-foreground">Valor do procedimento:</span>{" "}
                <span className="text-primary font-bold">{formatCurrency(servicePrice)}</span>
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="payment-amount">Valor Recebido (R$) *</Label>
              <Input
                id="payment-amount"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="0,00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="payment-method">Forma de Pagamento *</Label>
              <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                <SelectTrigger id="payment-method">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map((method) => (
                    <SelectItem key={method} value={method}>
                      {method}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-source">Tipo de Pagamento *</Label>
            <Select value={paymentSource} onValueChange={setPaymentSource}>
              <SelectTrigger id="payment-source">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PAYMENT_SOURCES.map((source) => (
                  <SelectItem key={source.value} value={source.value}>
                    {source.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="payment-notes">Observações</Label>
            <Textarea
              id="payment-notes"
              placeholder="Notas adicionais sobre o pagamento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10 p-3 text-sm">
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" />
              <span>
                Ao confirmar, uma <strong>receita</strong> será gerada no financeiro.
              </span>
            </p>
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Registrando...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" />
                  Registrar Pagamento
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
