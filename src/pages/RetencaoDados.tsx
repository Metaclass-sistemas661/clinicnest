import { useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  Archive,
  AlertTriangle,
  Calendar,
  Clock,
  FileText,
  Lock,
  Search,
  Shield,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Alert,
  AlertDescription,
  AlertTitle,
} from "@/components/ui/alert";
import {
  useRetentionStatistics,
  useClientsNearExpiry,
  useDeletionAttempts,
  useArchivedClients,
  useArchiveClient,
} from "@/hooks/useRetentionPolicy";

function StatCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "warning" | "success" | "danger";
}) {
  const variantClasses = {
    default: "bg-blue-50 text-blue-600",
    warning: "bg-yellow-50 text-yellow-600",
    success: "bg-green-50 text-green-600",
    danger: "bg-red-50 text-red-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${variantClasses[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function RetencaoDados() {
  const [monthsFilter, setMonthsFilter] = useState("12");
  const [searchArchived, setSearchArchived] = useState("");
  const [archiveDialogOpen, setArchiveDialogOpen] = useState(false);
  const [selectedClient, setSelectedClient] = useState<{
    id: string;
    name: string;
  } | null>(null);

  const { data: stats, isLoading: loadingStats } = useRetentionStatistics();
  const { data: clientsNearExpiry, isLoading: loadingClients } = useClientsNearExpiry(
    parseInt(monthsFilter)
  );
  const { data: deletionAttempts } = useDeletionAttempts();
  const { data: archivedClients } = useArchivedClients(
    undefined,
    searchArchived || undefined
  );
  const archiveMutation = useArchiveClient();

  const handleArchive = () => {
    if (!selectedClient) return;
    archiveMutation.mutate(
      { clientId: selectedClient.id },
      {
        onSuccess: () => {
          setArchiveDialogOpen(false);
          setSelectedClient(null);
        },
      }
    );
  };

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Política de Retenção de Dados</h1>
        <p className="text-muted-foreground">
          Conformidade com CFM 1.821/2007 — Guarda de prontuários por 20 anos
        </p>
      </div>

      <Alert>
        <Shield className="h-4 w-4" />
        <AlertTitle>Resolução CFM 1.821/2007</AlertTitle>
        <AlertDescription>
          Os prontuários médicos devem ser guardados por no mínimo 20 anos após o último
          atendimento do paciente. O sistema bloqueia automaticamente tentativas de exclusão
          de dados dentro deste período.
        </AlertDescription>
      </Alert>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total de Pacientes"
          value={stats?.total_clients ?? 0}
          icon={Users}
          description="Cadastrados no sistema"
        />
        <StatCard
          title="Com Retenção Ativa"
          value={stats?.clients_with_retention ?? 0}
          icon={Lock}
          description="Dados protegidos"
          variant="success"
        />
        <StatCard
          title="Expirando Este Ano"
          value={stats?.expiring_this_year ?? 0}
          icon={Clock}
          description="Podem ser arquivados"
          variant="warning"
        />
        <StatCard
          title="Tentativas Bloqueadas"
          value={stats?.deletion_attempts_blocked ?? 0}
          icon={XCircle}
          description="Exclusões impedidas"
          variant="danger"
        />
      </div>

      <Tabs defaultValue="expiring" className="space-y-4">
        <TabsList>
          <TabsTrigger value="expiring">Próximos a Expirar</TabsTrigger>
          <TabsTrigger value="attempts">Tentativas Bloqueadas</TabsTrigger>
          <TabsTrigger value="archived">Dados Arquivados</TabsTrigger>
        </TabsList>

        <TabsContent value="expiring" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle>Pacientes com Retenção Expirando</CardTitle>
                  <CardDescription>
                    Dados que podem ser arquivados após o período de retenção
                  </CardDescription>
                </div>
                <Select value={monthsFilter} onValueChange={setMonthsFilter}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="6">Próximos 6 meses</SelectItem>
                    <SelectItem value="12">Próximos 12 meses</SelectItem>
                    <SelectItem value="24">Próximos 24 meses</SelectItem>
                    <SelectItem value="60">Próximos 5 anos</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
            <CardContent>
              {loadingClients ? (
                <p>Carregando...</p>
              ) : clientsNearExpiry && clientsNearExpiry.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Último Atendimento</TableHead>
                      <TableHead>Expira em</TableHead>
                      <TableHead className="text-right">Prontuários</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {clientsNearExpiry.map((client) => (
                      <TableRow key={client.client_id}>
                        <TableCell className="font-medium">
                          {client.client_name}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {client.cpf || "—"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(client.last_appointment), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              client.days_until_expiry <= 30
                                ? "destructive"
                                : client.days_until_expiry <= 180
                                ? "secondary"
                                : "outline"
                            }
                          >
                            {client.days_until_expiry} dias
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {client.total_records}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedClient({
                                id: client.client_id,
                                name: client.client_name,
                              });
                              setArchiveDialogOpen(true);
                            }}
                            disabled={client.days_until_expiry > 0}
                          >
                            <Archive className="h-4 w-4 mr-1" />
                            Arquivar
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum paciente com retenção expirando no período selecionado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="attempts" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Tentativas de Exclusão Bloqueadas</CardTitle>
              <CardDescription>
                Registro de tentativas de exclusão de dados dentro do período de retenção
              </CardDescription>
            </CardHeader>
            <CardContent>
              {deletionAttempts && deletionAttempts.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Data/Hora</TableHead>
                      <TableHead>Usuário</TableHead>
                      <TableHead>Tabela</TableHead>
                      <TableHead>Paciente</TableHead>
                      <TableHead>Expira em</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {deletionAttempts.map((attempt) => (
                      <TableRow key={attempt.id}>
                        <TableCell>
                          {format(
                            new Date(attempt.attempted_at),
                            "dd/MM/yyyy HH:mm",
                            { locale: ptBR }
                          )}
                        </TableCell>
                        <TableCell>{attempt.user_email}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{attempt.table_name}</Badge>
                        </TableCell>
                        <TableCell>{attempt.client_name || "—"}</TableCell>
                        <TableCell>
                          {attempt.retention_expires
                            ? format(new Date(attempt.retention_expires), "dd/MM/yyyy")
                            : "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Shield className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Nenhuma tentativa de exclusão bloqueada</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="archived" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between gap-4">
                <div>
                  <CardTitle>Dados Arquivados</CardTitle>
                  <CardDescription>
                    Prontuários arquivados após expiração do período de retenção
                  </CardDescription>
                </div>
                <div className="relative w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome..."
                    value={searchArchived}
                    onChange={(e) => setSearchArchived(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {archivedClients && archivedClients.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Paciente</TableHead>
                      <TableHead>CPF</TableHead>
                      <TableHead>Último Atendimento</TableHead>
                      <TableHead>Arquivado em</TableHead>
                      <TableHead className="text-right">Prontuários</TableHead>
                      <TableHead>Exportação</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {archivedClients.map((client) => (
                      <TableRow key={client.archive_id}>
                        <TableCell className="font-medium">
                          {client.client_name}
                        </TableCell>
                        <TableCell className="font-mono text-sm">
                          {client.client_cpf || "—"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(client.last_appointment), "dd/MM/yyyy")}
                        </TableCell>
                        <TableCell>
                          {format(
                            new Date(client.archived_at),
                            "dd/MM/yyyy HH:mm",
                            { locale: ptBR }
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {client.total_records}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            {client.has_pdf && (
                              <Badge variant="outline">PDF</Badge>
                            )}
                            {client.has_xml && (
                              <Badge variant="outline">XML</Badge>
                            )}
                            {!client.has_pdf && !client.has_xml && (
                              <span className="text-muted-foreground text-sm">—</span>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Archive className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>Nenhum dado arquivado ainda</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={archiveDialogOpen} onOpenChange={setArchiveDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-500" />
              Confirmar Arquivamento
            </DialogTitle>
            <DialogDescription>
              Você está prestes a arquivar os dados clínicos de{" "}
              <strong>{selectedClient?.name}</strong>.
            </DialogDescription>
          </DialogHeader>

          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção</AlertTitle>
            <AlertDescription>
              Esta ação irá:
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Mover todos os prontuários para o arquivo</li>
                <li>Remover os dados das tabelas principais</li>
                <li>Gerar um hash de integridade</li>
                <li>Esta ação não pode ser desfeita</li>
              </ul>
            </AlertDescription>
          </Alert>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setArchiveDialogOpen(false)}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archiveMutation.isPending}
            >
              {archiveMutation.isPending ? "Arquivando..." : "Confirmar Arquivamento"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
