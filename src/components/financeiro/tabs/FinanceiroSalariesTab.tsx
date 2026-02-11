import { memo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DollarSign, CheckCircle2 } from "lucide-react";
import { formatInAppTz } from "@/lib/date";

export interface SalaryRow {
  id: string;
  professional_id: string;
  professional_name: string;
  payment_month: number;
  payment_year: number;
  amount?: number;
  salary_amount?: number;
  status: string;
  payment_date?: string | null;
  payment_method?: string | null;
}

export interface ProfessionalForSalary {
  user_id: string;
  default_payment_method?: string | null;
}

interface FinanceiroSalariesTabProps {
  isLoading: boolean;
  salaries: SalaryRow[];
  professionals: ProfessionalForSalary[];
  onOpenPaySalary: (
    professionalId: string,
    professionalName: string,
    paymentMonth: number,
    paymentYear: number,
    salaryAmount: number,
    defaultPaymentMethod: string
  ) => void;
  formatCurrency: (value: number) => string;
}

function paymentMethodLabel(method: string | null | undefined): string {
  if (!method) return "Outro";
  if (method === "pix") return "PIX";
  if (method === "deposit") return "Depósito";
  if (method === "cash") return "Espécie";
  return "Outro";
}

export const FinanceiroSalariesTab = memo(function FinanceiroSalariesTab({
  isLoading,
  salaries,
  professionals,
  onOpenPaySalary,
  formatCurrency,
}: FinanceiroSalariesTabProps) {
  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Salários</CardTitle>
          <p className="text-sm text-muted-foreground">Pagar salários fixos dos profissionais</p>
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

  if (salaries.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Gerenciar Salários</CardTitle>
          <p className="text-sm text-muted-foreground">Pagar salários fixos dos profissionais</p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-12">
            <DollarSign className="mb-4 h-12 w-12 text-muted-foreground/50" />
            <p className="text-muted-foreground">Nenhum salário registrado neste período</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const handlePayClick = (salary: SalaryRow) => {
    const professional = professionals.find((p) => p.user_id === salary.professional_id);
    const defaultMethod = professional?.default_payment_method || salary.payment_method || "pix";
    const amount = Number(salary.amount ?? salary.salary_amount ?? 0);
    onOpenPaySalary(
      salary.professional_id,
      salary.professional_name,
      salary.payment_month,
      salary.payment_year,
      amount,
      defaultMethod
    );
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Gerenciar Salários</CardTitle>
        <p className="text-sm text-muted-foreground">Pagar salários fixos dos profissionais</p>
      </CardHeader>
      <CardContent>
        <div className="block md:hidden space-y-3">
          {salaries.map((salary) => (
            <div key={salary.id} className="rounded-lg border p-4 space-y-2">
              <div className="flex justify-between items-start">
                <p className="font-medium">{salary.professional_name || "—"}</p>
                <Badge
                  variant="outline"
                  className={
                    salary.status === "paid"
                      ? "bg-success/20 text-success border-success/30"
                      : "bg-warning/20 text-warning border-warning/30"
                  }
                >
                  {salary.status === "paid" ? "Pago" : "Pendente"}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                {String(salary.payment_month).padStart(2, "0")}/{salary.payment_year}
              </p>
              <div className="flex justify-between text-sm">
                <span className="font-semibold text-primary">
                  {formatCurrency(Number(salary.amount ?? salary.salary_amount ?? 0))}
                </span>
                {salary.payment_method && (
                  <Badge variant="outline" className="text-xs">
                    {paymentMethodLabel(salary.payment_method)}
                  </Badge>
                )}
              </div>
              {salary.status === "pending" && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handlePayClick(salary)}
                  className="w-full gap-1"
                >
                  <CheckCircle2 className="h-3 w-3" />
                  Pagar Salário
                </Button>
              )}
              {salary.status === "paid" && salary.payment_date && (
                <p className="text-xs text-muted-foreground">
                  Pago em {formatInAppTz(salary.payment_date, "dd/MM/yyyy")}
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="hidden md:block overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Período</TableHead>
                <TableHead>Profissional</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Método</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {salaries.map((salary) => (
                <TableRow key={salary.id}>
                  <TableCell>
                    {String(salary.payment_month).padStart(2, "0")}/{salary.payment_year}
                  </TableCell>
                  <TableCell className="font-medium">
                    {salary.professional_name || "—"}
                  </TableCell>
                  <TableCell className="font-semibold text-primary">
                    {formatCurrency(Number(salary.amount ?? salary.salary_amount ?? 0))}
                  </TableCell>
                  <TableCell>
                    {salary.payment_method ? (
                      <Badge variant="outline">
                        {paymentMethodLabel(salary.payment_method)}
                      </Badge>
                    ) : (
                      "—"
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        salary.status === "paid"
                          ? "bg-success/20 text-success border-success/30"
                          : "bg-warning/20 text-warning border-warning/30"
                      }
                    >
                      {salary.status === "paid" ? "Pago" : "Pendente"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {salary.status === "pending" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handlePayClick(salary)}
                        className="gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        Pagar
                      </Button>
                    )}
                    {salary.status === "paid" && salary.payment_date && (
                      <span className="text-xs text-muted-foreground">
                        Pago em {formatInAppTz(salary.payment_date, "dd/MM/yyyy")}
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
