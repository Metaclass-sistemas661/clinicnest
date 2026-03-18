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
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Textarea } from "@/components/ui/textarea";
import {
  Send, Download, RefreshCw, CheckCircle2, XCircle, Clock, AlertTriangle,
  FileCode2, Shield, Building2, User, Key, Eye, EyeOff, Loader2,
  Calendar, Package, TrendingUp, FileCheck, FileClock, FileX, BarChart3,
  Pill, ClipboardList, Hash, Activity
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useSNGPC } from "@/hooks/useSNGPC";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

export default function TransmissaoSNGPC() {
  const { profile } = useAuth();
  const {
    isLoading, credenciais, transmissoes, movimentacoes, dashboard,
    fetchCredenciais, saveCredenciais, fetchTransmissoes, fetchMovimentacoes,
    fetchDashboard, criarTransmissao, atualizarTransmissao
  } = useSNGPC();

  const [activeTab, setActiveTab] = useState("dashboard");
  const [showPassword, setShowPassword] = useState(false);
  const [configDialog, setConfigDialog] = useState(false);
  const [xmlPreviewDialog, setXmlPreviewDialog] = useState(false);
  const [selectedXml, setSelectedXml] = useState("");

  // Filtros de período
  const [dataInicio, setDataInicio] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().slice(0, 10);
  });
  const [dataFim, setDataFim] = useState(new Date().toISOString().slice(0, 10));

  // Form de credenciais
  const [formCred, setFormCred] = useState({
    cnpj: "", razao_social: "", cpf_responsavel: "", nome_responsavel: "",
    crf_responsavel: "", email_notificacao: "", username: "", password: ""
  });

  useEffect(() => {
    if (profile?.tenant_id) {
      fetchCredenciais();
      fetchTransmissoes();
      fetchDashboard();
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (credenciais) {
      setFormCred({
        cnpj: credenciais.cnpj || "",
        razao_social: credenciais.razao_social || "",
        cpf_responsavel: credenciais.cpf_responsavel || "",
        nome_responsavel: credenciais.nome_responsavel || "",
        crf_responsavel: credenciais.crf_responsavel || "",
        email_notificacao: credenciais.email_notificacao || "",
        username: "", password: ""
      });
    }
  }, [credenciais]);

  const handleSaveCredenciais = async () => {
    if (!formCred.cnpj || !formCred.cpf_responsavel || !formCred.nome_responsavel) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }
    const ok = await saveCredenciais(formCred);
    if (ok) setConfigDialog(false);
  };

  const handleBuscarMovimentacoes = async () => {
    await fetchMovimentacoes(dataInicio, dataFim);
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "pendente": return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
      case "enviado": return <Badge variant="default"><Send className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "validado": return <Badge className="bg-success text-success-foreground"><CheckCircle2 className="h-3 w-3 mr-1" />Validado</Badge>;
      case "erro": return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Erro</Badge>;
      case "rejeitado": return <Badge variant="destructive"><FileX className="h-3 w-3 mr-1" />Rejeitado</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  const tipoMovBadge = (tipo: string) => {
    if (tipo.includes("ENTRADA")) return <Badge variant="outline" className="status-success">Entrada</Badge>;
    if (tipo.includes("DISPENSACAO")) return <Badge variant="outline" className="status-info">Dispensação</Badge>;
    if (tipo.includes("PERDA")) return <Badge variant="outline" className="status-error">Perda</Badge>;
    if (tipo.includes("TRANSFERENCIA")) return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20">Transferência</Badge>;
    return <Badge variant="outline">{tipo}</Badge>;
  };

  const totaisMovimentacoes = useMemo(() => {
    const entradas = movimentacoes.filter(m => m.tipo_movimentacao.includes("ENTRADA")).length;
    const vendas = movimentacoes.filter(m => m.tipo_movimentacao.includes("DISPENSACAO")).length;
    const perdas = movimentacoes.filter(m => m.tipo_movimentacao.includes("PERDA")).length;
    const transferencias = movimentacoes.filter(m => m.tipo_movimentacao.includes("TRANSFERENCIA")).length;
    return { entradas, vendas, perdas, transferencias, total: movimentacoes.length };
  }, [movimentacoes]);

  return (
    <MainLayout title="Transmissão SNGPC" subtitle="Sistema Nacional de Gerenciamento de Produtos Controlados - ANVISA">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-6 flex-wrap">
          <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          <TabsTrigger value="transmitir">Nova Transmissão</TabsTrigger>
          <TabsTrigger value="historico">Histórico ({transmissoes.length})</TabsTrigger>
          <TabsTrigger value="configuracoes">Configurações</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10">
                  <Send className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Transmissões</p>
                  <p className="text-2xl font-bold">{dashboard?.total_transmissoes || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-green-500/10">
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Validados ANVISA</p>
                  <p className="text-2xl font-bold">{dashboard?.total_validados || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-500/10">
                  <Clock className="h-5 w-5 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Pendentes</p>
                  <p className="text-2xl font-bold">{dashboard?.total_pendentes || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-destructive/10">
                  <XCircle className="h-5 w-5 text-destructive" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Erros/Rejeitados</p>
                  <p className="text-2xl font-bold">{dashboard?.total_erros || 0}</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-blue-500/10">
                  <TrendingUp className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Taxa de Sucesso</p>
                  <p className="text-2xl font-bold">{(dashboard?.taxa_sucesso || 0).toFixed(1)}%</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-purple-500/10">
                  <Pill className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Medicamentos Transmitidos</p>
                  <p className="text-2xl font-bold">{dashboard?.total_medicamentos || 0}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-4 p-5">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-orange-500/10">
                  <Calendar className="h-5 w-5 text-orange-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Última Transmissão</p>
                  <p className="text-lg font-bold">
                    {dashboard?.ultima_transmissao 
                      ? format(new Date(dashboard.ultima_transmissao), "dd/MM/yyyy", { locale: ptBR })
                      : "—"}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {!credenciais && (
            <Card className="border-yellow-200 bg-yellow-50">
              <CardContent className="flex items-center gap-4 p-5">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
                <div className="flex-1">
                  <p className="font-medium text-yellow-800">Configuração Pendente</p>
                  <p className="text-sm text-yellow-700">Configure as credenciais ANVISA para habilitar transmissões.</p>
                </div>
                <Button onClick={() => { setActiveTab("configuracoes"); }}>Configurar</Button>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* NOVA TRANSMISSÃO */}
        <TabsContent value="transmitir" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                Selecionar Período
              </CardTitle>
              <CardDescription>
                Selecione o período das movimentações para gerar o arquivo XML de transmissão.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="space-y-1">
                  <Label className="text-xs">Data Início</Label>
                  <Input type="date" value={dataInicio} onChange={(e) => setDataInicio(e.target.value)} className="w-44" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Data Fim</Label>
                  <Input type="date" value={dataFim} onChange={(e) => setDataFim(e.target.value)} className="w-44" />
                </div>
                <Button onClick={handleBuscarMovimentacoes} disabled={isLoading} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Buscar Movimentações
                </Button>
              </div>
            </CardContent>
          </Card>

          {movimentacoes.length > 0 && (
            <>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-green-600">{totaisMovimentacoes.entradas}</p><p className="text-xs text-muted-foreground">Entradas</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-blue-600">{totaisMovimentacoes.vendas}</p><p className="text-xs text-muted-foreground">Dispensações</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-purple-600">{totaisMovimentacoes.transferencias}</p><p className="text-xs text-muted-foreground">Transferências</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold text-red-600">{totaisMovimentacoes.perdas}</p><p className="text-xs text-muted-foreground">Perdas</p></CardContent></Card>
                <Card><CardContent className="p-4 text-center"><p className="text-2xl font-bold">{totaisMovimentacoes.total}</p><p className="text-xs text-muted-foreground">Total</p></CardContent></Card>
              </div>

              <Card>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">Movimentações do Período</CardTitle>
                    <Button className="gap-2" disabled={!credenciais}>
                      <Send className="h-4 w-4" />
                      Gerar XML e Transmitir
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="p-0">
                  <div className="overflow-x-auto max-h-96">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Data</TableHead>
                          <TableHead>Tipo</TableHead>
                          <TableHead>Medicamento</TableHead>
                          <TableHead>Lista</TableHead>
                          <TableHead>Lote</TableHead>
                          <TableHead className="text-right">Qtd</TableHead>
                          <TableHead>Paciente/Receita</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {movimentacoes.slice(0, 50).map((m) => (
                          <TableRow key={m.id}>
                            <TableCell className="text-sm whitespace-nowrap">
                              {format(new Date(m.data_movimentacao), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </TableCell>
                            <TableCell>{tipoMovBadge(m.tipo_movimentacao)}</TableCell>
                            <TableCell className="text-sm max-w-[200px] truncate">{m.medicamento_nome}</TableCell>
                            <TableCell><Badge variant="outline">{m.lista}</Badge></TableCell>
                            <TableCell className="font-mono text-xs">{m.lote}</TableCell>
                            <TableCell className="text-right font-medium">{m.quantidade}</TableCell>
                            <TableCell className="text-sm text-muted-foreground">
                              {m.paciente_nome || m.numero_receita || "—"}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>
            </>
          )}

          {movimentacoes.length === 0 && (
            <EmptyState icon={ClipboardList} title="Nenhuma movimentação" description="Selecione um período e clique em Buscar para listar as movimentações." />
          )}
        </TabsContent>

        {/* HISTÓRICO */}
        <TabsContent value="historico">
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">Histórico de Transmissões</CardTitle>
                <Button variant="outline" size="sm" onClick={fetchTransmissoes} className="gap-2">
                  <RefreshCw className={`h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
                  Atualizar
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {isLoading ? (
                <div className="p-4 space-y-2">{[1,2,3].map(i => <Skeleton key={i} className="h-12 w-full" />)}</div>
              ) : transmissoes.length === 0 ? (
                <div className="p-8 text-center text-muted-foreground">Nenhuma transmissão realizada.</div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Período</TableHead>
                        <TableHead className="text-right">Medicamentos</TableHead>
                        <TableHead>Hash ANVISA</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transmissoes.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell className="text-sm whitespace-nowrap">
                            {format(new Date(t.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell><Badge variant="outline">{t.tipo}</Badge></TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(t.data_inicio), "dd/MM", { locale: ptBR })} - {format(new Date(t.data_fim), "dd/MM/yy", { locale: ptBR })}
                          </TableCell>
                          <TableCell className="text-right font-medium">{t.total_medicamentos}</TableCell>
                          <TableCell className="font-mono text-xs max-w-[120px] truncate">{t.hash_anvisa || "—"}</TableCell>
                          <TableCell>{statusBadge(t.status)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button size="sm" variant="outline" className="h-7 px-2 text-xs gap-1">
                                <Download className="h-3 w-3" />XML
                              </Button>
                              {t.status === "pendente" && (
                                <Button size="sm" variant="outline" className="h-7 px-2 text-xs" onClick={() => atualizarTransmissao(t.id, "enviado")}>
                                  Marcar Enviado
                                </Button>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* CONFIGURAÇÕES */}
        <TabsContent value="configuracoes" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Credenciais ANVISA/SNGPC
              </CardTitle>
              <CardDescription>
                Configure as credenciais de acesso à API do SNGPC para transmissão de dados.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>CNPJ do Estabelecimento *</Label>
                  <Input value={formCred.cnpj} onChange={(e) => setFormCred({...formCred, cnpj: e.target.value})} placeholder="00.000.000/0000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Razão Social</Label>
                  <Input value={formCred.razao_social} onChange={(e) => setFormCred({...formCred, razao_social: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>CPF do Responsável *</Label>
                  <Input value={formCred.cpf_responsavel} onChange={(e) => setFormCred({...formCred, cpf_responsavel: e.target.value})} placeholder="000.000.000-00" />
                </div>
                <div className="space-y-2">
                  <Label>Nome do Responsável *</Label>
                  <Input value={formCred.nome_responsavel} onChange={(e) => setFormCred({...formCred, nome_responsavel: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <Label>CRF do Farmacêutico</Label>
                  <Input value={formCred.crf_responsavel} onChange={(e) => setFormCred({...formCred, crf_responsavel: e.target.value})} placeholder="CRF-XX 00000" />
                </div>
                <div className="space-y-2">
                  <Label>E-mail para Notificações</Label>
                  <Input type="email" value={formCred.email_notificacao} onChange={(e) => setFormCred({...formCred, email_notificacao: e.target.value})} />
                </div>
              </div>
              <div className="pt-4 border-t">
                <h4 className="font-medium mb-3 flex items-center gap-2"><Key className="h-4 w-4" />Credenciais de Acesso API</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Usuário SNGPC</Label>
                    <Input value={formCred.username} onChange={(e) => setFormCred({...formCred, username: e.target.value})} />
                  </div>
                  <div className="space-y-2">
                    <Label>Senha SNGPC</Label>
                    <div className="relative">
                      <Input type={showPassword ? "text" : "password"} value={formCred.password} onChange={(e) => setFormCred({...formCred, password: e.target.value})} />
                      <Button type="button" variant="ghost" size="sm" className="absolute right-1 top-1 h-7 w-7 p-0" onClick={() => setShowPassword(!showPassword)}>
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex justify-end pt-4">
                <Button onClick={handleSaveCredenciais} disabled={isLoading} className="gap-2">
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Salvar Configurações
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCode2 className="h-4 w-4" />
                Informações da API SNGPC
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 text-sm">
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">URL Base</span><code className="bg-muted px-2 py-1 rounded">https://sngpc-api.anvisa.gov.br</code></div>
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Versão XML</span><code className="bg-muted px-2 py-1 rounded">urn:sngpc-schema</code></div>
                <div className="flex justify-between py-2 border-b"><span className="text-muted-foreground">Autenticação</span><code className="bg-muted px-2 py-1 rounded">Bearer Token (JWT)</code></div>
                <div className="flex justify-between py-2"><span className="text-muted-foreground">Documentação</span><a href="https://sngpc.anvisa.gov.br" target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">Portal SNGPC ANVISA</a></div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </MainLayout>
  );
}
