import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import { useAuth } from "@/contexts/AuthContext";
import { api } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { formatCurrency } from "@/lib/formatCurrency";
import {
  FileText,
  Download,
  Users,
  Building2,
  Stethoscope,
  TrendingUp,
  Calendar,
  Filter,
  Loader2,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Professional {
  id: string;
  full_name: string;
}

interface RepasseProfissional {
  professional_id: string;
  professional_name: string;
  total_faturado: number;
  total_comissao: number;
  percentual_efetivo: number;
  atendimentos: number;
}

interface RepasseConvenio {
  insurance_id: string | null;
  insurance_name: string;
  total_faturado: number;
  total_comissao: number;
  margem: number;
  atendimentos: number;
}

interface RepasseProcedimento {
  procedure_id: string;
  service_name: string;
  total_faturado: number;
  total_comissao: number;
  atendimentos: number;
}

interface ComparativoMensal {
  mes: string;
  total_comissao: number;
  total_faturado: number;
}

export default function RepassesRelatorios({ embedded = false }: { embedded?: boolean }) {
  const { profile } = useAuth();
  const [activeTab, setActiveTab] = useState("profissional");
  const [isLoading, setIsLoading] = useState(false);
  const [professionals, setProfessionals] = useState<Professional[]>([]);
  
  // Filtros
  const [selectedProfessional, setSelectedProfessional] = useState<string>("all");
  const [startDate, setStartDate] = useState(() => format(startOfMonth(new Date()), "yyyy-MM-dd"));
  const [endDate, setEndDate] = useState(() => format(endOfMonth(new Date()), "yyyy-MM-dd"));
  
  // Dados
  const [repassesProfissional, setRepassesProfissional] = useState<RepasseProfissional[]>([]);
  const [repassesConvenio, setRepassesConvenio] = useState<RepasseConvenio[]>([]);
  const [repassesProcedimento, setRepassesProcedimento] = useState<RepasseProcedimento[]>([]);
  const [comparativoMensal, setComparativoMensal] = useState<ComparativoMensal[]>([]);

  // Carregar profissionais
  useEffect(() => {
    if (!profile?.tenant_id) return;
    
    api
      .from("profiles")
      .select("id, full_name")
      .eq("tenant_id", profile.tenant_id)
      .order("full_name")
      .then(({ data }) => {
        if (data) setProfessionals(data);
      });
  }, [profile?.tenant_id]);

  // Carregar dados do relatório
  const fetchReport = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);

    try {
      if (activeTab === "profissional") {
        await fetchRepasseProfissional();
      } else if (activeTab === "convenio") {
        await fetchRepasseConvenio();
      } else if (activeTab === "procedimento") {
        await fetchRepasseProcedimento();
      } else if (activeTab === "comparativo") {
        await fetchComparativoMensal();
      }
    } catch (err) {
      logger.error("RepassesRelatorios.fetchReport", err);
      toast.error("Erro ao carregar relatório");
    } finally {
      setIsLoading(false);
    }
  };

  const fetchRepasseProfissional = async () => {
    const { data, error } = await api
      .from("commission_payments")
      .select(`
        professional_id,
        amount,
        service_price,
        profiles!commission_payments_professional_id_fkey(full_name)
      `)
      .eq("tenant_id", profile!.tenant_id)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`);

    if (error) throw error;

    const grouped = (data || []).reduce((acc, item) => {
      const profId = item.professional_id;
      if (!acc[profId]) {
        acc[profId] = {
          professional_id: profId,
          professional_name: (item.profiles as any)?.full_name || "Desconhecido",
          total_faturado: 0,
          total_comissao: 0,
          atendimentos: 0,
        };
      }
      acc[profId].total_faturado += Number(item.service_price) || 0;
      acc[profId].total_comissao += Number(item.amount) || 0;
      acc[profId].atendimentos += 1;
      return acc;
    }, {} as Record<string, RepasseProfissional>);

    const result = Object.values(grouped).map(item => ({
      ...item,
      percentual_efetivo: item.total_faturado > 0 
        ? (item.total_comissao / item.total_faturado) * 100 
        : 0,
    }));

    setRepassesProfissional(result.sort((a, b) => b.total_comissao - a.total_comissao));
  };

  const fetchRepasseConvenio = async () => {
    const { data, error } = await api
      .from("commission_payments")
      .select(`
        amount,
        service_price,
        appointments!inner(
          insurance_plan_id,
          insurance_plans(name)
        )
      `)
      .eq("tenant_id", profile!.tenant_id)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`);

    if (error) throw error;

    const grouped = (data || []).reduce((acc, item) => {
      const apt = item.appointments as any;
      const insuranceId = apt?.insurance_plan_id || "particular";
      const insuranceName = apt?.insurance_plans?.name || "Particular";
      
      if (!acc[insuranceId]) {
        acc[insuranceId] = {
          insurance_id: insuranceId === "particular" ? null : insuranceId,
          insurance_name: insuranceName,
          total_faturado: 0,
          total_comissao: 0,
          atendimentos: 0,
        };
      }
      acc[insuranceId].total_faturado += Number(item.service_price) || 0;
      acc[insuranceId].total_comissao += Number(item.amount) || 0;
      acc[insuranceId].atendimentos += 1;
      return acc;
    }, {} as Record<string, RepasseConvenio>);

    const result = Object.values(grouped).map(item => ({
      ...item,
      margem: item.total_faturado > 0 
        ? ((item.total_faturado - item.total_comissao) / item.total_faturado) * 100 
        : 0,
    }));

    setRepassesConvenio(result.sort((a, b) => b.total_faturado - a.total_faturado));
  };

  const fetchRepasseProcedimento = async () => {
    const { data, error } = await api
      .from("commission_payments")
      .select(`
        amount,
        service_price,
        appointments!inner(
          procedure_id,
          procedure:procedures(name)
        )
      `)
      .eq("tenant_id", profile!.tenant_id)
      .gte("created_at", `${startDate}T00:00:00`)
      .lte("created_at", `${endDate}T23:59:59`);

    if (error) throw error;

    const grouped = (data || []).reduce((acc, item) => {
      const apt = item.appointments as any;
      const procedureId = apt?.procedure_id || "unknown";
      const serviceName = apt?.procedure?.name || "Procedimento não identificado";
      
      if (!acc[procedureId]) {
        acc[procedureId] = {
          procedure_id: procedureId,
          service_name: serviceName,
          total_faturado: 0,
          total_comissao: 0,
          atendimentos: 0,
        };
      }
      acc[procedureId].total_faturado += Number(item.service_price) || 0;
      acc[procedureId].total_comissao += Number(item.amount) || 0;
      acc[procedureId].atendimentos += 1;
      return acc;
    }, {} as Record<string, RepasseProcedimento>);

    setRepassesProcedimento(
      Object.values(grouped).sort((a, b) => b.total_comissao - a.total_comissao)
    );
  };

  const fetchComparativoMensal = async () => {
    const months: ComparativoMensal[] = [];
    const now = new Date();

    for (let i = 5; i >= 0; i--) {
      const monthDate = subMonths(now, i);
      const monthStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
      const monthEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");

      const { data, error } = await api
        .from("commission_payments")
        .select("amount, service_price")
        .eq("tenant_id", profile!.tenant_id)
        .gte("created_at", `${monthStart}T00:00:00`)
        .lte("created_at", `${monthEnd}T23:59:59`);

      if (error) throw error;

      const totals = (data || []).reduce(
        (acc, item) => ({
          total_comissao: acc.total_comissao + (Number(item.amount) || 0),
          total_faturado: acc.total_faturado + (Number(item.service_price) || 0),
        }),
        { total_comissao: 0, total_faturado: 0 }
      );

      months.push({
        mes: format(monthDate, "MMM/yy", { locale: ptBR }),
        ...totals,
      });
    }

    setComparativoMensal(months);
  };

  useEffect(() => {
    fetchReport();
  }, [activeTab, profile?.tenant_id]);

  // Totais
  const totaisProfissional = useMemo(() => {
    return repassesProfissional.reduce(
      (acc, item) => ({
        faturado: acc.faturado + item.total_faturado,
        comissao: acc.comissao + item.total_comissao,
        atendimentos: acc.atendimentos + item.atendimentos,
      }),
      { faturado: 0, comissao: 0, atendimentos: 0 }
    );
  }, [repassesProfissional]);

  // Exportar CSV
  const exportCSV = () => {
    let csv = "";
    let filename = "";

    if (activeTab === "profissional") {
      csv = "Profissional,Total Faturado,Total Comissão,% Efetivo,Atendimentos\n";
      repassesProfissional.forEach(r => {
        csv += `"${r.professional_name}",${r.total_faturado.toFixed(2)},${r.total_comissao.toFixed(2)},${r.percentual_efetivo.toFixed(1)}%,${r.atendimentos}\n`;
      });
      filename = `repasses-profissional-${startDate}-${endDate}.csv`;
    } else if (activeTab === "convenio") {
      csv = "Convênio,Total Faturado,Total Comissão,Margem %,Atendimentos\n";
      repassesConvenio.forEach(r => {
        csv += `"${r.insurance_name}",${r.total_faturado.toFixed(2)},${r.total_comissao.toFixed(2)},${r.margem.toFixed(1)}%,${r.atendimentos}\n`;
      });
      filename = `repasses-convenio-${startDate}-${endDate}.csv`;
    } else if (activeTab === "procedimento") {
      csv = "Procedimento,Total Faturado,Total Comissão,Atendimentos\n";
      repassesProcedimento.forEach(r => {
        csv += `"${r.service_name}",${r.total_faturado.toFixed(2)},${r.total_comissao.toFixed(2)},${r.atendimentos}\n`;
      });
      filename = `repasses-procedimento-${startDate}-${endDate}.csv`;
    } else if (activeTab === "comparativo") {
      csv = "Mês,Total Faturado,Total Comissão\n";
      comparativoMensal.forEach(r => {
        csv += `"${r.mes}",${r.total_faturado.toFixed(2)},${r.total_comissao.toFixed(2)}\n`;
      });
      filename = `repasses-comparativo-6meses.csv`;
    }

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    toast.success("Relatório exportado!");
  };

  const content = (
    <>
      {/* Filtros */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-2">
              <Label>Data Início</Label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-40"
              />
            </div>
            <div className="space-y-2">
              <Label>Data Fim</Label>
              <Input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-40"
              />
            </div>
            <Button onClick={fetchReport} className="gap-2">
              <Filter className="h-4 w-4" />
              Filtrar
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4 mb-6">
          <TabsTrigger value="profissional" className="gap-2">
            <Users className="h-4 w-4" />
            Por Profissional
          </TabsTrigger>
          <TabsTrigger value="convenio" className="gap-2">
            <Building2 className="h-4 w-4" />
            Por Convênio
          </TabsTrigger>
          <TabsTrigger value="procedimento" className="gap-2">
            <Stethoscope className="h-4 w-4" />
            Por Procedimento
          </TabsTrigger>
          <TabsTrigger value="comparativo" className="gap-2">
            <TrendingUp className="h-4 w-4" />
            Comparativo
          </TabsTrigger>
        </TabsList>

        {/* Tab: Por Profissional */}
        <TabsContent value="profissional">
          {/* Cards de resumo */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Faturado</div>
                <div className="text-2xl font-bold">{formatCurrency(totaisProfissional.faturado)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Total Comissões</div>
                <div className="text-2xl font-bold text-primary">{formatCurrency(totaisProfissional.comissao)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-sm text-muted-foreground">Atendimentos</div>
                <div className="text-2xl font-bold">{totaisProfissional.atendimentos}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabela */}
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Profissional</TableHead>
                    <TableHead className="text-right">Faturado</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">% Efetivo</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repassesProfissional.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum dado encontrado no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    repassesProfissional.map((r) => (
                      <TableRow key={r.professional_id}>
                        <TableCell className="font-medium">{r.professional_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_faturado)}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(r.total_comissao)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant="outline">{r.percentual_efetivo.toFixed(1)}%</Badge>
                        </TableCell>
                        <TableCell className="text-right">{r.atendimentos}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Por Convênio */}
        <TabsContent value="convenio">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Convênio</TableHead>
                    <TableHead className="text-right">Faturado</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Margem</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repassesConvenio.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        Nenhum dado encontrado no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    repassesConvenio.map((r, idx) => (
                      <TableRow key={r.insurance_id || idx}>
                        <TableCell className="font-medium">
                          {r.insurance_name}
                          {!r.insurance_id && <Badge variant="secondary" className="ml-2">Particular</Badge>}
                        </TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_faturado)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_comissao)}</TableCell>
                        <TableCell className="text-right">
                          <Badge variant={r.margem >= 50 ? "default" : "secondary"}>
                            {r.margem.toFixed(1)}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">{r.atendimentos}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Por Procedimento */}
        <TabsContent value="procedimento">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-12 w-full" />)}
            </div>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Procedimento</TableHead>
                    <TableHead className="text-right">Faturado</TableHead>
                    <TableHead className="text-right">Comissão</TableHead>
                    <TableHead className="text-right">Atendimentos</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repassesProcedimento.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-muted-foreground py-8">
                        Nenhum dado encontrado no período
                      </TableCell>
                    </TableRow>
                  ) : (
                    repassesProcedimento.map((r) => (
                      <TableRow key={r.procedure_id}>
                        <TableCell className="font-medium">{r.service_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(r.total_faturado)}</TableCell>
                        <TableCell className="text-right font-semibold text-primary">
                          {formatCurrency(r.total_comissao)}
                        </TableCell>
                        <TableCell className="text-right">{r.atendimentos}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        {/* Tab: Comparativo Mensal */}
        <TabsContent value="comparativo">
          {isLoading ? (
            <div className="space-y-2">
              {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {comparativoMensal.map((m, idx) => {
                const prev = comparativoMensal[idx - 1];
                const diff = prev ? m.total_comissao - prev.total_comissao : 0;
                const isUp = diff > 0;
                
                return (
                  <Card key={m.mes}>
                    <CardContent className="pt-6">
                      <div className="text-sm font-medium text-muted-foreground uppercase">
                        {m.mes}
                      </div>
                      <div className="text-xl font-bold mt-1">
                        {formatCurrency(m.total_comissao)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        Faturado: {formatCurrency(m.total_faturado)}
                      </div>
                      {idx > 0 && diff !== 0 && (
                        <div className={`flex items-center gap-1 text-xs mt-2 ${isUp ? "text-green-600" : "text-red-600"}`}>
                          {isUp ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                          {formatCurrency(Math.abs(diff))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </>
  );

  if (embedded) return content;

  return (
    <MainLayout
      title="Relatórios de Repasse"
      subtitle="Análise detalhada de comissões e repasses"
      actions={
        <Button onClick={exportCSV} variant="outline" className="gap-2">
          <Download className="h-4 w-4" />
          Exportar CSV
        </Button>
      }
    >
      {content}
    </MainLayout>
  );
}
