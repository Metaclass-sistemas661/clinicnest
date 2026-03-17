import { Spinner } from "@/components/ui/spinner";
import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatInAppTz } from "@/lib/date";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Users,
  TrendingUp,
  Calendar,
  DollarSign,
  Download,
  Filter,
  UserPlus,
  Target,
  Award,
  Loader2,
} from "lucide-react";
import { startOfMonth, endOfMonth, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface ReferralData {
  referrer_id: string;
  referrer_name: string;
  referrer_role: string;
  month: string;
  total_appointments: number;
  unique_patients: number;
  completed_appointments: number;
  total_revenue: number;
  total_commission: number;
}

interface Profile {
  id: string;
  user_id: string;
  full_name: string;
  professional_type: string;
}

export default function RelatorioCaptacao({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<ReferralData[]>([]);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  
  // Filters
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>(
    format(startOfMonth(subMonths(new Date(), 2)), "yyyy-MM-dd")
  );
  const [toDate, setToDate] = useState<string>(
    format(endOfMonth(new Date()), "yyyy-MM-dd")
  );

  useEffect(() => {
    if (profile?.tenant_id) {
      loadProfessionals();
      loadData();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (profile?.tenant_id) {
      loadData();
    }
  }, [selectedProfessional, fromDate, toDate]);

  const loadProfessionals = async () => {
    if (!profile?.tenant_id) return;

    try {
      const { data: profs, error } = await supabase
        .from("profiles")
        .select("id, user_id, full_name, professional_type")
        .eq("tenant_id", profile.tenant_id)
        .order("full_name");

      if (error) throw error;
      setProfessionals(profs || []);
    } catch (error) {
      logger.error("Error loading professionals:", error);
    }
  };

  const loadData = async () => {
    if (!profile?.tenant_id) return;

    setIsLoading(true);
    try {
      const { data: result, error } = await supabase.rpc("get_referral_report", {
        p_tenant_id: profile.tenant_id,
        p_from_date: fromDate || null,
        p_to_date: toDate || null,
        p_referrer_id: selectedProfessional === "all" ? null : selectedProfessional,
      });

      if (error) throw error;
      setData((result as ReferralData[]) || []);
    } catch (error) {
      logger.error("Error loading referral data:", error);
      toast.error("Erro ao carregar dados de captação");
    } finally {
      setIsLoading(false);
    }
  };

  // Summary calculations
  const summary = useMemo(() => {
    return data.reduce(
      (acc, item) => ({
        totalAppointments: acc.totalAppointments + item.total_appointments,
        uniquePatients: acc.uniquePatients + item.unique_patients,
        completedAppointments: acc.completedAppointments + item.completed_appointments,
        totalRevenue: acc.totalRevenue + Number(item.total_revenue),
        totalCommission: acc.totalCommission + Number(item.total_commission),
      }),
      {
        totalAppointments: 0,
        uniquePatients: 0,
        completedAppointments: 0,
        totalRevenue: 0,
        totalCommission: 0,
      }
    );
  }, [data]);

  // Group by professional for ranking
  const ranking = useMemo(() => {
    const grouped = data.reduce((acc, item) => {
      const key = item.referrer_id;
      if (!acc[key]) {
        acc[key] = {
          referrer_id: item.referrer_id,
          referrer_name: item.referrer_name,
          referrer_role: item.referrer_role,
          total_appointments: 0,
          unique_patients: 0,
          completed_appointments: 0,
          total_revenue: 0,
          total_commission: 0,
        };
      }
      acc[key].total_appointments += item.total_appointments;
      acc[key].unique_patients += item.unique_patients;
      acc[key].completed_appointments += item.completed_appointments;
      acc[key].total_revenue += Number(item.total_revenue);
      acc[key].total_commission += Number(item.total_commission);
      return acc;
    }, {} as Record<string, ReferralData>);

    return Object.values(grouped).sort((a, b) => b.total_revenue - a.total_revenue);
  }, [data]);

  const handleExportCSV = () => {
    if (data.length === 0) {
      toast.error("Nenhum dado para exportar");
      return;
    }

    const headers = [
      "Mês",
      "Captador",
      "Função",
      "Agendamentos",
      "Pacientes Únicos",
      "Concluídos",
      "Receita Total",
      "Comissão",
    ];

    const rows = data.map((item) => [
      format(new Date(item.month), "MMM/yyyy", { locale: ptBR }),
      item.referrer_name,
      item.referrer_role,
      item.total_appointments,
      item.unique_patients,
      item.completed_appointments,
      item.total_revenue,
      item.total_commission,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `relatorio-captacao-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
    toast.success("Relatório exportado com sucesso");
  };

  const getRoleLabel = (role: string) => {
    const labels: Record<string, string> = {
      admin: "Administrador",
      medico: "Médico",
      dentista: "Dentista",
      enfermeiro: "Enfermeiro",
      secretaria: "Secretária",
      recepcionista: "Recepcionista",
      staff: "Colaborador",
    };
    return labels[role] || role;
  };

  const content = (
    <>
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Agendamentos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.totalAppointments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <UserPlus className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Pacientes Únicos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.uniquePatients}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Concluídos</span>
            </div>
            <p className="text-2xl font-bold mt-1">{summary.completedAppointments}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Receita Gerada</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalRevenue)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs text-muted-foreground">Comissões</span>
            </div>
            <p className="text-2xl font-bold mt-1">{formatCurrency(summary.totalCommission)}</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Filter className="h-4 w-4" />
            Filtros
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Captador</Label>
              <Select value={selectedProfessional} onValueChange={setSelectedProfessional}>
                <SelectTrigger>
                  <SelectValue placeholder="Todos" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  {professionals.map((prof) => (
                    <SelectItem key={prof.user_id} value={prof.user_id}>
                      {prof.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Data Inicial</Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Data Final</Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Ranking */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Award className="h-4 w-4" />
              Ranking de Captação
            </CardTitle>
            <CardDescription>Por receita gerada</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="text-muted-foreground" />
              </div>
            ) : ranking.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhum dado de captação encontrado
              </p>
            ) : (
              <div className="space-y-3">
                {ranking.slice(0, 10).map((item, index) => (
                  <div
                    key={item.referrer_id}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50"
                  >
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                        index === 0
                          ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300"
                          : index === 1
                          ? "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                          : index === 2
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {index + 1}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{item.referrer_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {item.total_appointments} agendamentos • {item.unique_patients} pacientes
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-sm">{formatCurrency(item.total_revenue)}</p>
                      <p className="text-xs text-green-600 dark:text-green-400">
                        +{formatCurrency(item.total_commission)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Detailed Table */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4" />
              Detalhamento Mensal
            </CardTitle>
            <CardDescription>Histórico de captações por mês</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="text-muted-foreground" />
              </div>
            ) : data.length === 0 ? (
              <EmptyState
                icon={Users}
                title="Nenhuma captação encontrada"
                description="Quando agendamentos forem atribuídos a captadores, os dados aparecerão aqui."
              />
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Mês</TableHead>
                      <TableHead>Captador</TableHead>
                      <TableHead>Função</TableHead>
                      <TableHead className="text-center">Agend.</TableHead>
                      <TableHead className="text-center">Pacientes</TableHead>
                      <TableHead className="text-center">Concluídos</TableHead>
                      <TableHead className="text-right">Receita</TableHead>
                      <TableHead className="text-right">Comissão</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.map((item, index) => (
                      <TableRow key={`${item.referrer_id}-${item.month}-${index}`}>
                        <TableCell className="font-medium">
                          {format(new Date(item.month), "MMM/yyyy", { locale: ptBR })}
                        </TableCell>
                        <TableCell>{item.referrer_name}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className="text-xs">
                            {getRoleLabel(item.referrer_role)}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center">{item.total_appointments}</TableCell>
                        <TableCell className="text-center">{item.unique_patients}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={
                              item.completed_appointments === item.total_appointments
                                ? "text-green-600 dark:text-green-400"
                                : ""
                            }
                          >
                            {item.completed_appointments}
                          </span>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(Number(item.total_revenue))}
                        </TableCell>
                        <TableCell className="text-right text-green-600 dark:text-green-400 font-medium">
                          {formatCurrency(Number(item.total_commission))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );

  if (embedded) return content;

  return (
    <MainLayout
      title="Captação e Indicações"
      subtitle="Acompanhe quem está trazendo pacientes para a clínica"
      actions={
        <Button variant="outline" onClick={handleExportCSV} disabled={data.length === 0}>
          <Download className="mr-2 h-4 w-4" />
          Exportar CSV
        </Button>
      }
    >
      {content}
    </MainLayout>
  );
}
