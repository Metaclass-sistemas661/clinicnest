import { memo, useMemo, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Wallet, CheckCircle2 } from "lucide-react";
import { formatInAppTz } from "@/lib/date";
import type { CommissionPayment } from "@/utils/financialPdfExport";

interface FinanceiroCommissionsTabProps {
  isLoading: boolean;
  commissions: CommissionPayment[];
  onMarkAsPaid: (commissionId: string) => void;
  formatCurrency: (value: number) => string;
}

export const FinanceiroCommissionsTab = memo(function FinanceiroCommissionsTab({
  isLoading,
  commissions,
  onMarkAsPaid,
  formatCurrency,
}: FinanceiroCommissionsTabProps) {
  const [confirmId, setConfirmId] = useState<string | null>(null);

  const sortedCommissions = useMemo(() => {
    const pending = commissions.filter((c) => c.status === "pending");
    const paid = commissions.filter((c) => c.status !== "pending");
    return [...pending, ...paid];
  }, [commissions]);

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Comissões</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 p-4">
            <Skeleton className="h-10 w-full" />
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (commissions.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Comissões</CardTitle>
        </CardHeader>
        <CardContent>
          <EmptyState
            icon={Wallet}
            title="Nenhuma comissão neste período"
            description="As comissões aparecem quando atendimentos são concluídos (e geram comissão)."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Comissões</CardTitle>
        <p className="text-sm text-muted-foreground">Comissões geradas por atendimentos concluídos no período</p>
      </CardHeader>
      <CardContent>
        <AlertDialog open={!!confirmId} onOpenChange={(open) => !open && setConfirmId(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirmar pagamento</AlertDialogTitle>
              <AlertDialogDescription>
                Confirme para marcar esta comissão como paga. Essa ação ajuda na auditoria e no controle.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel onClick={() => setConfirmId(null)}>Voltar</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => {
                  if (confirmId) onMarkAsPaid(confirmId);
                  setConfirmId(null);
                }}
              >
                Confirmar
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <div className="block md:hidden space-y-3">
          {sortedCommissions.map((commission) => (
            <div key={commission.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between items-start">
                <p className="font-medium">{commission.professional?.full_name || "—"}</p>
                <Badge
                  variant="outline"
                  className={
                    commission.status === "paid"
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-warning/20 text-warning border-warning/30"
                  }
                >
                  {commission.status === "paid" ? "Paga" : "Pendente"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {formatInAppTz(commission.created_at, "dd/MM/yyyy")} ·{" "}
                {commission.commission_type === "percentage" ? "Percentual" : "Fixo"}
              </p>
              <div className="flex justify-between text-sm">
                <span>Procedimento: {formatCurrency(Number(commission.service_price))}</span>
                <span className="font-semibold text-primary">
                  Comissão: {formatCurrency(Number(commission.amount))}
                </span>
              </div>
              {commission.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setConfirmId(commission.id)}
                  className="w-full gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Marcar como Paga
                </Button>
              )}
              {commission.status === "paid" && commission.payment_date && (
                <p className="text-xs text-muted-foreground">
                  Paga em {formatInAppTz(commission.payment_date, "dd/MM/yyyy")}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Valor do Procedimento</TableHead>
                <TableHead>Comissão</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedCommissions.map((commission) => (
                <TableRow key={commission.id}>
                  <TableCell>
                    {formatInAppTz(commission.created_at, "dd/MM/yyyy")}
                  </TableCell>
                  <TableCell className="font-medium">
                    {commission.professional?.full_name || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">
                      {commission.commission_type === "percentage" ? "Percentual" : "Fixo"}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatCurrency(Number(commission.service_price))}</TableCell>
                  <TableCell className="font-semibold text-primary">
                    {formatCurrency(Number(commission.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        commission.status === "paid"
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-warning/20 text-warning border-warning/30"
                      }
                    >
                      {commission.status === "paid" ? "Paga" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {commission.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setConfirmId(commission.id)}
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Marcar como Paga
                      </Button>
                    )}
                    {commission.status === "paid" && commission.payment_date && (
                      <span className="text-xs text-muted-foreground">
                        Paga em {formatInAppTz(commission.payment_date, "dd/MM/yyyy")}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
});
