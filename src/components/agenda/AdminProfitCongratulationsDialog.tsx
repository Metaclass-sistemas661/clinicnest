import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { TrendingUp, Package, DollarSign, User } from "lucide-react";
import { formatCurrency } from "@/lib/formatCurrency";

export interface AdminProfitData {
  professionalName: string;
  serviceName: string;
  serviceProfit: number;
  productSales: { product_name: string; quantity: number; profit: number }[];
  productProfitTotal: number;
  totalProfit: number;
}

interface AdminProfitCongratulationsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  data: AdminProfitData | null;
}

export function AdminProfitCongratulationsDialog({
  open,
  onOpenChange,
  data,
}: AdminProfitCongratulationsDialogProps) {
  if (!data) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md overflow-hidden rounded-2xl border-0 bg-gradient-to-b from-primary/5 via-card to-card p-0 shadow-xl">
        <div className="relative overflow-hidden rounded-t-2xl bg-gradient-to-r from-primary/20 via-primary/10 to-accent/20 px-6 py-6">
          <div className="absolute -right-10 -top-10 h-32 w-32 rounded-full bg-primary/20 blur-3xl" />
          <div className="relative flex flex-col items-center gap-2 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/20 ring-4 ring-primary/30">
              <TrendingUp className="h-7 w-7 text-primary" />
            </div>
            <DialogTitle className="text-lg font-bold tracking-tight text-foreground">
              Atendimento concluído
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground flex items-center gap-1.5 justify-center">
              <User className="h-4 w-4" />
              {data.professionalName} concluiu o agendamento
            </DialogDescription>
          </div>
        </div>

        <div className="space-y-5 px-6 pb-6 pt-4">
          {/* Lucro do serviço */}
          <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p className="text-sm font-medium text-muted-foreground mb-1">
              {data.serviceName}
            </p>
            <p className="text-sm text-muted-foreground">
              Seu lucro desse serviço (após comissão do funcionário):
            </p>
            <p className="text-xl font-bold text-primary mt-1">
              {formatCurrency(data.serviceProfit)}
            </p>
          </div>

          {/* Venda de produtos */}
          {data.productSales.length > 0 && (
            <div className="rounded-xl border border-border bg-muted/30 p-4 space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <Package className="h-4 w-4" />
                Produtos vendidos
              </div>
              <ul className="space-y-2">
                {data.productSales.map((item, i) => (
                  <li
                    key={i}
                    className="flex justify-between items-center text-sm"
                  >
                    <span>
                      {item.product_name} ({item.quantity}x)
                    </span>
                    <span className="font-semibold text-primary">
                      {formatCurrency(item.profit)}
                    </span>
                  </li>
                ))}
              </ul>
              <div className="flex justify-between items-center pt-2 border-t border-border">
                <span className="text-sm font-medium">Lucro total em produtos:</span>
                <span className="font-bold text-primary">
                  {formatCurrency(data.productProfitTotal)}
                </span>
              </div>
            </div>
          )}

          {/* Lucro total */}
          <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-primary/30 bg-primary/10 py-5">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <DollarSign className="h-4 w-4" />
              Lucro total
            </div>
            <p className="text-2xl font-bold text-primary">
              {formatCurrency(data.totalProfit)}
            </p>
            <p className="text-xs text-muted-foreground">
              Serviço + Produtos (após comissão e custos)
            </p>
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
