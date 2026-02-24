import { useState, useEffect, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileText, Download, Play, Star, StarOff, Trash2, Clock, Calendar,
  Filter, BarChart3, PieChart, LineChart, TrendingUp, DollarSign,
  Users, Activity, Stethoscope, AlertTriangle, XCircle, UserX,
  Search, Plus, Settings, Mail, RefreshCw, Eye, Copy, ChevronRight
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useReports, ReportDefinition, SavedReport, ReportFilter, ReportCategory } from "@/hooks/useReports";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

const categoryLabels: Record<ReportCategory, string> = {
  financeiro: "Financeiro",
  atendimento: "Atendimento",
  clinico: "Clínico",
  marketing: "Marketing",
  operacional: "Operacional",
  custom: "Personalizado",
};

const categoryColors: Record<ReportCategory, string> = {
  financeiro: "bg-green-100 text-green-700 border-green-200",
  atendimento: "bg-blue-100 text-blue-700 border-blue-200",
  clinico: "bg-purple-100 text-purple-700 border-purple-200",
  marketing: "bg-pink-100 text-pink-700 border-pink-200",
  operacional: "bg-orange-100 text-orange-700 border-orange-200",
  custom: "bg-gray-100 text-gray-700 border-gray-200",
};

const iconMap: Record<string, any> = {
  DollarSign, Users, Activity, Stethoscope, AlertTriangle, XCircle, 
  UserX, TrendingUp, FileText, Clock, BarChart3, PieChart, LineChart
};

export default function RelatoriosCustomizaveis() {
  const { profile } = useAuth();
  const {
    isLoading, templates, savedReports, fetchTemplates, fetchSavedReports,
    saveReport, toggleFavorite, deleteSavedReport
  } = useReports();

  const [activeTab, setActiveTab] = useState("templates");
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedTemplate, setSelectedTemplate] = useState<ReportDefinition | null>(null);
  const [runDialog, setRunDialog] = useState(false);
  const [saveDialog, setSaveDialog] = useState(false);
  const [reportName, setReportName] = useState("");

  // Filtros do relatório
  const [filterPeriodo, setFilterPeriodo] = useState({
    inicio: new Date(new Date().setDate(1)).toISOString().slice(0, 10),
    fim: new Date().toISOString().slice(0, 10),
  });

  useEffect(() => {
    fetchTemplates();
    fetchSavedReports();
  }, [fetchTemplates, fetchSavedReports]);

  const filteredTemplates = useMemo(() => {
    return templates.filter(t => {
      const matchSearch = t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.description?.toLowerCase().includes(searchTerm.toLowerCase());
      const matchCategory = categoryFilter === "all" || t.category === categoryFilter;
      return matchSearch && matchCategory;
    });
  }, [templates, searchTerm, categoryFilter]);

  const favoriteReports = useMemo(() => 
    savedReports.filter(r => r.is_favorite), [savedReports]);

  const recentReports = useMemo(() => 
    savedReports.filter(r => r.last_run_at).slice(0, 5), [savedReports]);

  const handleRunReport = (template: ReportDefinition) => {
    setSelectedTemplate(template);
    setRunDialog(true);
  };

  const handleExecuteReport = async () => {
    if (!selectedTemplate) return;
    toast.info(`Executando relatório: ${selectedTemplate.name}`);
    setRunDialog(false);
  };

  const handleSaveReport = async () => {
    if (!selectedTemplate || !reportName.trim()) {
      toast.error("Digite um nome para o relatório");
      return;
    }
    const filters: ReportFilter[] = [
      { field: "start_time", operator: "between", value: [filterPeriodo.inicio, filterPeriodo.fim] }
    ];
    await saveReport(selectedTemplate.id, reportName, filters);
    setSaveDialog(false);
    setReportName("");
  };

  const getIcon = (iconName: string | null) => {
    if (!iconName) return FileText;
    return iconMap[iconName] || FileText;
  };

  return (
    <MainLayout title="Relatórios" subtitle="Crie, customize e exporte relatórios do seu negócio">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="templates">Templates ({templates.length})</TabsTrigger>
          <TabsTrigger value="salvos">Meus Relatórios ({savedReports.length})</TabsTrigger>
          <TabsTrigger value="favoritos">Favoritos ({favoriteReports.length})</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="space-y-6">
          <div className="flex flex-wrap gap-4 items-center justify-between">
            <div className="flex gap-3 flex-1 max-w-xl">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar relatórios..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="financeiro">Financeiro</SelectItem>
                  <SelectItem value="atendimento">Atendimento</SelectItem>
                  <SelectItem value="clinico">Clínico</SelectItem>
                  <SelectItem value="marketing">Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {isLoading ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-40" />)}
            </div>
          ) : filteredTemplates.length === 0 ? (
            <EmptyState icon={FileText} title="Nenhum template encontrado" description="Tente ajustar os filtros de busca." />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTemplates.map((template) => {
                const Icon = getIcon(template.icon);
                return (
                  <Card key={template.id} className="hover:shadow-md transition-shadow cursor-pointer group">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${template.color ? `bg-${template.color}-100` : 'bg-primary/10'}`}>
                          <Icon className={`h-5 w-5 ${template.color ? `text-${template.color}-600` : 'text-primary'}`} />
                        </div>
                        <Badge variant="outline" className={categoryColors[template.category]}>
                          {categoryLabels[template.category]}
                        </Badge>
                      </div>
                      <CardTitle className="text-base mt-3">{template.name}</CardTitle>
                      <CardDescription className="text-xs line-clamp-2">
                        {template.description}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-0">
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1 gap-1" onClick={() => handleRunReport(template)}>
                          <Play className="h-3 w-3" />
                          Executar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => { setSelectedTemplate(template); setSaveDialog(true); }}>
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MEUS RELATÓRIOS */}
        <TabsContent value="salvos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Relatórios Salvos</CardTitle>
              <CardDescription>Relatórios que você customizou e salvou para uso frequente.</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {savedReports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Você ainda não salvou nenhum relatório. Execute um template e salve para acesso rápido.
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead></TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Template Base</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Última Execução</TableHead>
                      <TableHead>Execuções</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {savedReports.map((report) => (
                      <TableRow key={report.id}>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 w-8 p-0"
                            onClick={() => toggleFavorite(report.id, !report.is_favorite)}
                          >
                            {report.is_favorite ? (
                              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                            ) : (
                              <StarOff className="h-4 w-4 text-muted-foreground" />
                            )}
                          </Button>
                        </TableCell>
                        <TableCell className="font-medium">{report.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {report.report_definition?.name || "—"}
                        </TableCell>
                        <TableCell>
                          {report.report_definition && (
                            <Badge variant="outline" className={categoryColors[report.report_definition.category]}>
                              {categoryLabels[report.report_definition.category]}
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-sm">
                          {report.last_run_at 
                            ? format(new Date(report.last_run_at), "dd/MM/yy HH:mm", { locale: ptBR })
                            : "—"}
                        </TableCell>
                        <TableCell className="text-center">{report.run_count}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button size="sm" variant="outline" className="h-7 px-2 gap-1">
                              <Play className="h-3 w-3" />
                              Executar
                            </Button>
                            <Button 
                              size="sm" 
                              variant="ghost" 
                              className="h-7 w-7 p-0 text-destructive"
                              onClick={() => deleteSavedReport(report.id)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* FAVORITOS */}
        <TabsContent value="favoritos">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="h-4 w-4 text-yellow-500" />
                Relatórios Favoritos
              </CardTitle>
            </CardHeader>
            <CardContent>
              {favoriteReports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Marque relatórios como favoritos para acesso rápido.
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {favoriteReports.map((report) => (
                    <Card key={report.id} className="hover:shadow-sm transition-shadow">
                      <CardContent className="p-4 flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{report.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {report.run_count} execuções
                          </p>
                        </div>
                        <Button size="sm" variant="outline" className="gap-1">
                          <Play className="h-3 w-3" />
                          Executar
                        </Button>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Clock className="h-4 w-4" />
                Histórico de Execuções
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentReports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  Nenhum relatório executado recentemente.
                </div>
              ) : (
                <div className="space-y-2">
                  {recentReports.map((report) => (
                    <div key={report.id} className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50">
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium text-sm">{report.name}</p>
                          <p className="text-xs text-muted-foreground">
                            {report.last_run_at && format(new Date(report.last_run_at), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="gap-1">
                        <RefreshCw className="h-3 w-3" />
                        Reexecutar
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog de Execução */}
      <Dialog open={runDialog} onOpenChange={setRunDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Play className="h-4 w-4" />
              Executar Relatório
            </DialogTitle>
            <DialogDescription>
              {selectedTemplate?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input 
                  type="date" 
                  value={filterPeriodo.inicio}
                  onChange={(e) => setFilterPeriodo(p => ({ ...p, inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input 
                  type="date" 
                  value={filterPeriodo.fim}
                  onChange={(e) => setFilterPeriodo(p => ({ ...p, fim: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex items-center gap-4 pt-2">
              <Label className="text-sm text-muted-foreground">Exportar como:</Label>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="gap-1">
                  <FileText className="h-3 w-3" />PDF
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Download className="h-3 w-3" />Excel
                </Button>
                <Button size="sm" variant="outline" className="gap-1">
                  <Download className="h-3 w-3" />CSV
                </Button>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRunDialog(false)}>Cancelar</Button>
            <Button onClick={handleExecuteReport} className="gap-2">
              <Play className="h-4 w-4" />
              Executar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog de Salvar */}
      <Dialog open={saveDialog} onOpenChange={setSaveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvar Relatório</DialogTitle>
            <DialogDescription>
              Salve este relatório com filtros personalizados para uso futuro.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Nome do Relatório</Label>
              <Input 
                value={reportName}
                onChange={(e) => setReportName(e.target.value)}
                placeholder="Ex: Faturamento Mensal - Dr. João"
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>Data Início</Label>
                <Input 
                  type="date" 
                  value={filterPeriodo.inicio}
                  onChange={(e) => setFilterPeriodo(p => ({ ...p, inicio: e.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label>Data Fim</Label>
                <Input 
                  type="date" 
                  value={filterPeriodo.fim}
                  onChange={(e) => setFilterPeriodo(p => ({ ...p, fim: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveReport}>Salvar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
