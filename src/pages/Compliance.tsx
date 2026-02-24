import { useState, useEffect } from "react";
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
import { Progress } from "@/components/ui/progress";
import {
  Shield, Clock, FileText, Download, CheckCircle2, XCircle, AlertTriangle,
  Settings, RefreshCw, Database, Lock, FileCheck, Eye, Loader2, Server, Zap
} from "lucide-react";
import { useCompliance, TSAProvider } from "@/hooks/useCompliance";
import { createSerproTSAService } from "@/lib/tsa-service";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function Compliance() {
  const {
    isLoading, tsaConfig, tsaTimestamps, exports, ripdReports, backupLogs,
    fetchTSAConfig, saveTSAConfig, fetchTSATimestamps, fetchExports,
    fetchRIPDReports, fetchBackupLogs, getComplianceStatus
  } = useCompliance();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [tsaDialog, setTsaDialog] = useState(false);
  const [testingTSA, setTestingTSA] = useState(false);
  const [formTSA, setFormTSA] = useState({
    provider: 'serpro' as TSAProvider,
    api_url: 'https://gateway.apiserpro.serpro.gov.br/apitimestamp/v1/timestamp',
    api_key: '',
    is_active: true,
  });

  useEffect(() => {
    fetchTSAConfig();
    fetchTSATimestamps();
    fetchExports();
    fetchRIPDReports();
    fetchBackupLogs();
  }, []);

  useEffect(() => {
    if (tsaConfig) {
      setFormTSA({
        provider: tsaConfig.provider,
        api_url: tsaConfig.api_url,
        api_key: '',
        is_active: tsaConfig.is_active,
      });
    }
  }, [tsaConfig]);

  const complianceStatus = getComplianceStatus();

  const handleSaveTSA = async () => {
    await saveTSAConfig(formTSA);
    setTsaDialog(false);
  };

  const handleTestTSA = async () => {
    setTestingTSA(true);
    try {
      const service = createSerproTSAService();
      const result = await service.testConnection();
      if (result.success) {
        toast.success(`${result.message} (${result.latencyMs}ms)`);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error('Erro ao testar conexão TSA');
    } finally {
      setTestingTSA(false);
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case 'ok': return <Badge className="bg-green-600"><CheckCircle2 className="h-3 w-3 mr-1" />Conforme</Badge>;
      case 'warning': return <Badge className="bg-yellow-500"><AlertTriangle className="h-3 w-3 mr-1" />Atenção</Badge>;
      case 'pending': return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <MainLayout title="Compliance" subtitle="Certificações, LGPD e conformidade regulatória">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="tsa">Carimbo de Tempo</TabsTrigger>
          <TabsTrigger value="portabilidade">Portabilidade</TabsTrigger>
          <TabsTrigger value="ripd">RIPD (LGPD)</TabsTrigger>
          <TabsTrigger value="backups">Backups</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="h-5 w-5" />
                Score de Compliance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-6">
                <Progress value={complianceStatus.score} className="flex-1 h-3" />
                <span className="text-2xl font-bold">{complianceStatus.score.toFixed(0)}%</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {complianceStatus.items.map((item, i) => (
                  <Card key={i}>
                    <CardContent className="p-4 flex items-center justify-between">
                      <span className="text-sm font-medium">{item.name}</span>
                      {statusBadge(item.status)}
                    </CardContent>
                  </Card>
                ))}
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                  <Clock className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Carimbos TSA</p>
                  <p className="text-2xl font-bold">{tsaTimestamps.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
                  <FileText className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Exportações</p>
                  <p className="text-2xl font-bold">{exports.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10">
                  <FileCheck className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">RIPDs</p>
                  <p className="text-2xl font-bold">{ripdReports.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-5 flex items-center gap-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10">
                  <Database className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Backups</p>
                  <p className="text-2xl font-bold">{backupLogs.length}</p>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* TSA */}
        <TabsContent value="tsa" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Configuração TSA
                  </CardTitle>
                  <CardDescription>Carimbo de tempo para documentos clínicos (Serpro)</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={handleTestTSA} disabled={testingTSA} className="gap-2">
                    {testingTSA ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    Testar Conexão
                  </Button>
                  <Button onClick={() => setTsaDialog(true)} className="gap-2">
                    <Settings className="h-4 w-4" />
                    Configurar
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {tsaConfig ? (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Provedor</p>
                    <p className="font-medium capitalize">{tsaConfig.provider}</p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Status</p>
                    <p className="font-medium">{tsaConfig.is_active ? 
                      <Badge className="bg-green-600">Ativo</Badge> : 
                      <Badge variant="secondary">Inativo</Badge>}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Último Teste</p>
                    <p className="font-medium">{tsaConfig.last_test_at ? 
                      format(new Date(tsaConfig.last_test_at), "dd/MM/yy HH:mm") : "—"}
                    </p>
                  </div>
                  <div className="p-4 border rounded-lg">
                    <p className="text-xs text-muted-foreground">Resultado</p>
                    <p className="font-medium">{tsaConfig.last_test_success ? 
                      <Badge className="bg-green-600">Sucesso</Badge> : 
                      tsaConfig.last_test_at ? <Badge variant="destructive">Falha</Badge> : "—"}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {import.meta.env.VITE_SERPRO_CONSUMER_KEY ? (
                    <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className="h-5 w-5 text-green-600" />
                        <div>
                          <p className="font-medium text-green-800">Serpro TSA Configurado</p>
                          <p className="text-sm text-green-700">Variáveis de ambiente detectadas</p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="p-4 border rounded-lg bg-yellow-50 border-yellow-200">
                      <div className="flex items-center gap-3">
                        <AlertTriangle className="h-5 w-5 text-yellow-600" />
                        <div>
                          <p className="font-medium text-yellow-800">Configuração Pendente</p>
                          <p className="text-sm text-yellow-700">Adicione VITE_SERPRO_CONSUMER_KEY e VITE_SERPRO_CONSUMER_SECRET nas variáveis de ambiente</p>
                        </div>
                      </div>
                    </div>
                  )}
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Provedor</p>
                      <p className="font-medium">Serpro API Timestamp</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Endpoint</p>
                      <p className="font-medium text-xs font-mono">gateway.apiserpro.serpro.gov.br</p>
                    </div>
                    <div className="p-4 border rounded-lg">
                      <p className="text-xs text-muted-foreground">Algoritmo</p>
                      <p className="font-medium">SHA-256</p>
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de Carimbos</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {tsaTimestamps.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum carimbo registrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Documento</TableHead>
                      <TableHead>Hash</TableHead>
                      <TableHead>Serial</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tsaTimestamps.slice(0, 20).map((ts) => (
                      <TableRow key={ts.id}>
                        <TableCell>{format(new Date(ts.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell><Badge variant="outline">{ts.document_type}</Badge></TableCell>
                        <TableCell className="font-mono text-xs max-w-[150px] truncate">{ts.document_hash}</TableCell>
                        <TableCell className="font-mono text-xs">{ts.serial_number || "—"}</TableCell>
                        <TableCell>
                          {ts.status === 'stamped' ? 
                            <Badge className="bg-green-600">Carimbado</Badge> :
                            ts.status === 'error' ?
                            <Badge variant="destructive">Erro</Badge> :
                            <Badge variant="secondary">{ts.status}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* PORTABILIDADE */}
        <TabsContent value="portabilidade">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Download className="h-4 w-4" />
                Exportações de Prontuário
              </CardTitle>
              <CardDescription>Portabilidade de dados conforme Art. 18 da LGPD</CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              {exports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma exportação realizada</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Arquivos</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {exports.map((exp) => (
                      <TableRow key={exp.id}>
                        <TableCell>{format(new Date(exp.created_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell className="font-medium">{exp.client_name}</TableCell>
                        <TableCell>
                          {exp.status === 'completed' ? 
                            <Badge className="bg-green-600">Concluído</Badge> :
                            exp.status === 'processing' ?
                            <Badge variant="secondary"><Loader2 className="h-3 w-3 mr-1 animate-spin" />Processando</Badge> :
                            <Badge variant="destructive">Erro</Badge>}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {exp.pdf_url && <Badge variant="outline">PDF</Badge>}
                            {exp.xml_url && <Badge variant="outline">XML</Badge>}
                          </div>
                        </TableCell>
                        <TableCell>
                          {exp.status === 'completed' && (
                            <Button size="sm" variant="outline" className="gap-1">
                              <Download className="h-3 w-3" />
                              Baixar
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* RIPD */}
        <TabsContent value="ripd">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileCheck className="h-4 w-4" />
                    Relatórios de Impacto (RIPD)
                  </CardTitle>
                  <CardDescription>Conforme modelo ANPD - Lei 13.709/2018</CardDescription>
                </div>
                <Button className="gap-2">
                  <FileText className="h-4 w-4" />
                  Novo RIPD
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {ripdReports.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">
                  <FileCheck className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Nenhum RIPD cadastrado</p>
                  <p className="text-sm">Crie um Relatório de Impacto para documentar o tratamento de dados</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Versão</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Aprovação</TableHead>
                      <TableHead>Próxima Revisão</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {ripdReports.map((ripd) => (
                      <TableRow key={ripd.id}>
                        <TableCell className="font-mono">{ripd.version}</TableCell>
                        <TableCell className="font-medium">{ripd.title}</TableCell>
                        <TableCell>
                          {ripd.status === 'approved' ? 
                            <Badge className="bg-green-600">Aprovado</Badge> :
                            <Badge variant="secondary">{ripd.status}</Badge>}
                        </TableCell>
                        <TableCell>{ripd.approved_at ? format(new Date(ripd.approved_at), "dd/MM/yy") : "—"}</TableCell>
                        <TableCell>{ripd.next_review_at ? format(new Date(ripd.next_review_at), "dd/MM/yy") : "—"}</TableCell>
                        <TableCell>
                          <Button size="sm" variant="outline" className="gap-1">
                            <Eye className="h-3 w-3" />
                            Ver
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* BACKUPS */}
        <TabsContent value="backups">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base flex items-center gap-2">
                    <Database className="h-4 w-4" />
                    Logs de Backup
                  </CardTitle>
                  <CardDescription>Registro de backups com verificação de integridade</CardDescription>
                </div>
                <Button variant="outline" onClick={() => fetchBackupLogs()} className="gap-2">
                  <RefreshCw className="h-4 w-4" />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {backupLogs.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhum backup registrado</div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Nome</TableHead>
                      <TableHead>Tamanho</TableHead>
                      <TableHead>Hash</TableHead>
                      <TableHead>Verificado</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {backupLogs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell>{format(new Date(log.started_at), "dd/MM/yy HH:mm")}</TableCell>
                        <TableCell><Badge variant="outline">{log.backup_type}</Badge></TableCell>
                        <TableCell className="font-medium max-w-[200px] truncate">{log.backup_name}</TableCell>
                        <TableCell>{log.size_bytes ? `${(log.size_bytes / 1024 / 1024).toFixed(2)} MB` : "—"}</TableCell>
                        <TableCell className="font-mono text-xs max-w-[100px] truncate">{log.content_hash}</TableCell>
                        <TableCell>
                          {log.is_verified ? 
                            <CheckCircle2 className="h-4 w-4 text-green-600" /> :
                            <XCircle className="h-4 w-4 text-muted-foreground" />}
                        </TableCell>
                        <TableCell>
                          {log.status === 'completed' ? 
                            <Badge className="bg-green-600">OK</Badge> :
                            <Badge variant="destructive">{log.status}</Badge>}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Dialog TSA */}
      <Dialog open={tsaDialog} onOpenChange={setTsaDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Configurar Carimbo de Tempo (TSA)</DialogTitle>
            <DialogDescription>Configure as credenciais do provedor TSA</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>Provedor</Label>
              <Select value={formTSA.provider} onValueChange={(v) => setFormTSA({...formTSA, provider: v as TSAProvider})}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="certisign">Certisign</SelectItem>
                  <SelectItem value="bry">BRy</SelectItem>
                  <SelectItem value="valid">Valid</SelectItem>
                  <SelectItem value="serpro">Serpro</SelectItem>
                  <SelectItem value="custom">Personalizado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>URL da API</Label>
              <Input value={formTSA.api_url} onChange={(e) => setFormTSA({...formTSA, api_url: e.target.value})} placeholder="https://timestamp.provider.com.br/tsa" />
            </div>
            <div className="space-y-2">
              <Label>Chave de API</Label>
              <Input type="password" value={formTSA.api_key} onChange={(e) => setFormTSA({...formTSA, api_key: e.target.value})} placeholder="••••••••" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTsaDialog(false)}>Cancelar</Button>
            <Button onClick={handleSaveTSA} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
