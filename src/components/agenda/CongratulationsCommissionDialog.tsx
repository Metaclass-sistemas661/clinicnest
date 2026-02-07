import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trophy, Wallet, TrendingUp, Sparkles } from "lucide-react";

export interface CongratulationsCommissionData {
  commissionAmount: number;
  serviceName: string;
  servicePrice: number;
  completedThisMonth: number;
  valueGeneratedThisMonth: number;
}

interface CongratulationsCommissionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: CongratulationsCommissionData | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

export function CongratulationsCommissionDialog({
  open,
  onOpenChange,
  data,
}: CongratulationsCommissionDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden rounded-2xl border-0 bg-gradient-to-b from-primary/5 via-card to-card p-0 shadow-xl">
        {/* Header com gradiente */}
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 px-6 py-8">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute -left-10 -bottom-10 h-24 w-24 rounded-full bg-accent/20 blur-2xl" />
          <div className="relative flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 ring-4 ring-primary/30">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                Parabéns! Atendimento concluído
              </DialogTitle>
              <DialogDescription className="mt-1 text-sm text-muted-foreground">
                {data.serviceName}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* Conteúdo */}
        <div className="space-y-6 px-6 pb-6 pt-4">
          {/* Comissão em destaque */}
          <div className="flex flex-col items-center gap-2 rounded-xl border border-primary/20 bg-primary/5 py-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Wallet className="h-4 w-4" />
              Comissão deste serviço
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(data.commissionAmount)}
            </p>
            <p className="text-xs text-muted-foreground">
              Valor do serviço: {formatCurrency(data.servicePrice)}
            </p>
          </div>

          {/* Desempenho do mês */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <TrendingUp className="h-3.5 w-3.5" />
                Serviços este mês
              </div>
              <p className="text-lg font-bold text-foreground">
                {data.completedThisMonth}
              </p>
            </div>
            <div className="flex flex-col gap-1.5 rounded-lg border border-border bg-muted/30 p-4">
              <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
                <Sparkles className="h-3.5 w-3.5" />
                Valor gerado
              </div>
              <p className="text-lg font-bold text-foreground">
                {formatCurrency(data.valueGeneratedThisMonth)}
              </p>
            </div>
          </div>

          <Button
            className="w-full gradient-primary text-primary-foreground"
            onClick={() => onOpenChange(false)}
          >
            Continuar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
