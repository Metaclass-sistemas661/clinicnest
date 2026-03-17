import { useState } from "react";
import { format, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { Spinner } from "@/components/ui/spinner";
import { ptBR } from "date-fns/locale";
import {
  Activity,
  AlertTriangle,
  Calendar,
  CheckCircle,
  Clock,
  FileText,
  Home,
  RefreshCw,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useONAIndicators,
  useLatestONAIndicators,
  useCalculateONAIndicators,
  useAdverseEvents,
  useCreateAdverseEvent,
  useUpdateAdverseEvent,
  ADVERSE_EVENT_TYPES,
  ADVERSE_EVENT_SEVERITIES,
  ADVERSE_EVENT_STATUSES,
  type CreateAdverseEventInput,
} from "@/hooks/useONAIndicators";

function IndicatorCard({
  title,
  value,
  unit,
  icon: Icon,
  trend,
  trendValue,
  description,
  color = "blue",
}: {
  title: string;
  value: number | string | null;
  unit?: string;
  icon: React.ElementType;
  trend?: "up" | "down" | "neutral";
  trendValue?: string;
  description?: string;
  color?: "blue" | "green" | "yellow" | "red" | "purple";
}) {
  const colorClasses = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`p-2 rounded-lg ${colorClasses[color]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">
            {value !== null ? value : "—"}
          </span>
          {unit && <span className="text-sm text-muted-foreground">{unit}</span>}
        </div>
        {(trend || description) && (
          <div className="flex items-center gap-2 mt-1">
            {trend && (
              <span
                className={`flex items-center text-xs ${
                  trend === "up"
                    ? "text-green-600"
                    : trend === "down"
                    ? "text-red-600"
                    : "text-gray-500"
                }`}
              >
                {trend === "up" ? (
                  <TrendingUp className="h-3 w-3 mr-1" />
                ) : trend === "down" ? (
                  <TrendingDown className="h-3 w-3 mr-1" />
                ) : null}
                {trendValue}
              </span>
            )}
            {description && (
              <span className="text-xs text-muted-foreground">{description}</span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AdverseEventForm({
  onSubmit,
  isLoading,
}: {
  onSubmit: (data: CreateAdverseEventInput) => void;
  isLoading: boolean;
}) {
  const [formData, setFormData] = useState<CreateAdverseEventInput>({
    data_evento: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
    tipo: "OUTRO",
    severidade: "LEVE",
    descricao: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="data_evento">Data/Hora do Evento</Label>
          <Input
            id="data_evento"
            type="datetime-local"
            value={formData.data_evento}
            onChange={(e) =>
              setFormData({ ...formData, data_evento: e.target.value })
            }
            required
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="tipo">Tipo de Evento</Label>
          <Select
            value={formData.tipo}
            onValueChange={(v) => setFormData({ ...formData, tipo: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ADVERSE_EVENT_TYPES).map(([key, label]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {formData.tipo === "OUTRO" && (
        <div className="space-y-2">
          <Label htmlFor="tipo_outro">Especifique o Tipo</Label>
          <Input
            id="tipo_outro"
            value={formData.tipo_outro || ""}
            onChange={(e) =>
              setFormData({ ...formData, tipo_outro: e.target.value })
            }
          />
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="severidade">Severidade</Label>
          <Select
            value={formData.severidade}
            onValueChange={(v) => setFormData({ ...formData, severidade: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(ADVERSE_EVENT_SEVERITIES).map(([key, { label }]) => (
                <SelectItem key={key} value={key}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="local_evento">Local do Evento</Label>
          <Input
            id="local_evento"
            value={formData.local_evento || ""}
            onChange={(e) =>
              setFormData({ ...formData, local_evento: e.target.value })
            }
            placeholder="Ex: Consultório 3, Recepção"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição do Evento</Label>
        <Textarea
          id="descricao"
          value={formData.descricao}
          onChange={(e) =>
            setFormData({ ...formData, descricao: e.target.value })
          }
          placeholder="Descreva detalhadamente o que aconteceu..."
          rows={4}
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="circunstancias">Circunstâncias</Label>
        <Textarea
          id="circunstancias"
          value={formData.circunstancias || ""}
          onChange={(e) =>
            setFormData({ ...formData, circunstancias: e.target.value })
          }
          placeholder="Quais foram as circunstâncias que levaram ao evento?"
          rows={2}
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="acoes_imediatas">Ações Imediatas Tomadas</Label>
        <Textarea
          id="acoes_imediatas"
          value={formData.acoes_imediatas || ""}
          onChange={(e) =>
            setFormData({ ...formData, acoes_imediatas: e.target.value })
          }
          placeholder="Quais ações foram tomadas imediatamente após o evento?"
          rows={2}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isLoading}>
        {isLoading ? "Notificando..." : "Notificar Evento"}
      </Button>
    </form>
  );
}

export default function DashboardONA() {
  const [selectedPeriod, setSelectedPeriod] = useState("current");
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: latestIndicators, isLoading: loadingLatest } = useLatestONAIndicators();
  const { data: historicalIndicators } = useONAIndicators();
  const { data: adverseEvents, isLoading: loadingEvents } = useAdverseEvents();
  const calculateMutation = useCalculateONAIndicators();
  const createEventMutation = useCreateAdverseEvent();

  const handleCalculate = () => {
    const now = new Date();
    const inicio = format(startOfMonth(now), "yyyy-MM-dd");
    const fim = format(endOfMonth(now), "yyyy-MM-dd");
    calculateMutation.mutate({ inicio, fim });
  };

  const handleCreateEvent = (data: CreateAdverseEventInput) => {
    createEventMutation.mutate(data, {
      onSuccess: () => setDialogOpen(false),
    });
  };

  const indicators = latestIndicators;
  const openEvents = adverseEvents?.filter((e) => e.status !== "ENCERRADO") || [];

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Dashboard ONA</h1>
          <p className="text-muted-foreground">
            Indicadores de Qualidade para Acreditação
          </p>
        </div>
        <div className="flex gap-2">
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <AlertTriangle className="h-4 w-4 mr-2" />
                Notificar Evento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Notificar Evento Adverso</DialogTitle>
                <DialogDescription>
                  Registre um evento adverso ou near miss para investigação
                </DialogDescription>
              </DialogHeader>
              <AdverseEventForm
                onSubmit={handleCreateEvent}
                isLoading={createEventMutation.isPending}
              />
            </DialogContent>
          </Dialog>
          <Button onClick={handleCalculate} disabled={calculateMutation.isPending}>
            <RefreshCw
              className={`h-4 w-4 mr-2 ${
                calculateMutation.isPending ? "animate-spin" : ""
              }`}
            />
            Recalcular
          </Button>
        </div>
      </div>

      {indicators && (
        <p className="text-sm text-muted-foreground">
          Período: {format(new Date(indicators.periodo_inicio), "dd/MM/yyyy", { locale: ptBR })} a{" "}
          {format(new Date(indicators.periodo_fim), "dd/MM/yyyy", { locale: ptBR })} | Calculado em:{" "}
          {format(new Date(indicators.calculado_em), "dd/MM/yyyy HH:mm", { locale: ptBR })}
        </p>
      )}

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Visão Geral</TabsTrigger>
          <TabsTrigger value="events">Eventos Adversos</TabsTrigger>
          <TabsTrigger value="details">Detalhamento</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="Tempo Médio de Espera"
              value={indicators?.tempo_espera_medio?.toFixed(1) ?? null}
              unit="min"
              icon={Clock}
              color="blue"
              description={`P90: ${indicators?.tempo_espera_p90?.toFixed(0) ?? "—"} min`}
            />
            <IndicatorCard
              title="Taxa de Cancelamento"
              value={indicators?.taxa_cancelamento?.toFixed(1) ?? null}
              unit="%"
              icon={XCircle}
              color="yellow"
              description={`${indicators?.total_cancelados ?? 0} de ${indicators?.total_agendamentos ?? 0}`}
            />
            <IndicatorCard
              title="Taxa de No-Show"
              value={indicators?.taxa_noshow?.toFixed(1) ?? null}
              unit="%"
              icon={Users}
              color="red"
              description={`${indicators?.total_noshow ?? 0} faltas`}
            />
            <IndicatorCard
              title="Completude Prontuário"
              value={indicators?.completude_prontuario?.toFixed(1) ?? null}
              unit="%"
              icon={FileText}
              color="green"
              description={`${indicators?.prontuarios_completos ?? 0} de ${indicators?.total_prontuarios ?? 0}`}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <IndicatorCard
              title="Ocupação de Salas"
              value={indicators?.taxa_ocupacao_salas?.toFixed(1) ?? null}
              unit="%"
              icon={Home}
              color="purple"
              description={`${indicators?.horas_ocupadas?.toFixed(0) ?? 0}h de ${indicators?.horas_disponiveis?.toFixed(0) ?? 0}h`}
            />
            <IndicatorCard
              title="Retorno < 7 dias"
              value={indicators?.taxa_retorno_nao_programado?.toFixed(1) ?? null}
              unit="%"
              icon={RefreshCw}
              color="yellow"
              description={`${indicators?.total_retornos_7dias ?? 0} retornos`}
            />
            <IndicatorCard
              title="NPS Score"
              value={indicators?.nps_score?.toFixed(0) ?? null}
              icon={ThumbsUp}
              color={
                (indicators?.nps_score ?? 0) >= 50
                  ? "green"
                  : (indicators?.nps_score ?? 0) >= 0
                  ? "yellow"
                  : "red"
              }
              description={`${indicators?.total_respostas_nps ?? 0} respostas`}
            />
            <IndicatorCard
              title="Eventos Adversos"
              value={indicators?.total_eventos_adversos ?? 0}
              icon={AlertTriangle}
              color={
                (indicators?.total_eventos_adversos ?? 0) === 0
                  ? "green"
                  : (indicators?.total_eventos_adversos ?? 0) <= 2
                  ? "yellow"
                  : "red"
              }
              description={`${openEvents.length} em aberto`}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">NPS Detalhado</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm">Promotores (9-10)</span>
                  <span className="font-medium text-green-600">
                    {indicators?.nps_promotores ?? 0}
                  </span>
                </div>
                <Progress
                  value={
                    ((indicators?.nps_promotores ?? 0) /
                      Math.max(indicators?.total_respostas_nps ?? 1, 1)) *
                    100
                  }
                  className="h-2 bg-green-100"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Neutros (7-8)</span>
                  <span className="font-medium text-yellow-600">
                    {indicators?.nps_neutros ?? 0}
                  </span>
                </div>
                <Progress
                  value={
                    ((indicators?.nps_neutros ?? 0) /
                      Math.max(indicators?.total_respostas_nps ?? 1, 1)) *
                    100
                  }
                  className="h-2 bg-yellow-100"
                />
                <div className="flex items-center justify-between">
                  <span className="text-sm">Detratores (0-6)</span>
                  <span className="font-medium text-red-600">
                    {indicators?.nps_detratores ?? 0}
                  </span>
                </div>
                <Progress
                  value={
                    ((indicators?.nps_detratores ?? 0) /
                      Math.max(indicators?.total_respostas_nps ?? 1, 1)) *
                    100
                  }
                  className="h-2 bg-red-100"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Ocupação por Sala</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {indicators?.ocupacao_por_sala &&
                Object.keys(indicators.ocupacao_por_sala).length > 0 ? (
                  Object.entries(indicators.ocupacao_por_sala).map(
                    ([id, sala]) => (
                      <div key={id} className="space-y-1">
                        <div className="flex items-center justify-between text-sm">
                          <span>{sala.nome}</span>
                          <span className="font-medium">{sala.taxa?.toFixed(1)}%</span>
                        </div>
                        <Progress value={sala.taxa ?? 0} className="h-2" />
                      </div>
                    )
                  )
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Nenhum dado de ocupação disponível
                  </p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="events" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Eventos Adversos</CardTitle>
              <CardDescription>
                Notificações de eventos adversos e near misses
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingEvents ? (
                <div class="flex items-center gap-2"><Spinner size="sm" /><span className="text-muted-foreground">Carregando...</span></div>
              ) : adverseEvents && adverseEvents.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nº</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Severidade</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Paciente</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {adverseEvents.map((event) => (
                      <TableRow key={event.id}>
                        <TableCell className="font-mono text-sm">
                          {event.numero_notificacao}
                        </TableCell>
                        <TableCell>
                          {format(new Date(event.data_evento), "dd/MM/yyyy HH:mm")}
                        </TableCell>
                        <TableCell>
                          {ADVERSE_EVENT_TYPES[event.tipo as keyof typeof ADVERSE_EVENT_TYPES] ||
                            event.tipo_outro ||
                            event.tipo}
                        </TableCell>
                        <TableCell>
                          <Badge
                            className={
                              ADVERSE_EVENT_SEVERITIES[
                                event.severidade as keyof typeof ADVERSE_EVENT_SEVERITIES
                              ]?.color
                            }
                          >
                            {ADVERSE_EVENT_SEVERITIES[
                              event.severidade as keyof typeof ADVERSE_EVENT_SEVERITIES
                            ]?.label || event.severidade}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              ADVERSE_EVENT_STATUSES[
                                event.status as keyof typeof ADVERSE_EVENT_STATUSES
                              ]?.color
                            }
                          >
                            {ADVERSE_EVENT_STATUSES[
                              event.status as keyof typeof ADVERSE_EVENT_STATUSES
                            ]?.label || event.status}
                          </Badge>
                        </TableCell>
                        <TableCell>{event.client?.name || "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <CheckCircle className="h-12 w-12 mx-auto mb-2 text-green-500" />
                  <p>Nenhum evento adverso registrado</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="details" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Campos Faltantes no Prontuário</CardTitle>
              </CardHeader>
              <CardContent>
                {indicators?.campos_obrigatorios_faltantes ? (
                  <div className="space-y-2">
                    {Object.entries(indicators.campos_obrigatorios_faltantes).map(
                      ([campo, count]) => (
                        <div
                          key={campo}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <span className="capitalize">{campo.replace("_", " ")}</span>
                          <Badge variant={count > 0 ? "destructive" : "secondary"}>
                            {count} faltantes
                          </Badge>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <p className="text-muted-foreground">Nenhum dado disponível</p>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Eventos por Severidade</CardTitle>
              </CardHeader>
              <CardContent>
                {indicators?.eventos_por_severidade &&
                Object.keys(indicators.eventos_por_severidade).length > 0 ? (
                  <div className="space-y-2">
                    {Object.entries(indicators.eventos_por_severidade).map(
                      ([severidade, count]) => (
                        <div
                          key={severidade}
                          className="flex items-center justify-between py-2 border-b last:border-0"
                        >
                          <Badge
                            className={
                              ADVERSE_EVENT_SEVERITIES[
                                severidade as keyof typeof ADVERSE_EVENT_SEVERITIES
                              ]?.color
                            }
                          >
                            {ADVERSE_EVENT_SEVERITIES[
                              severidade as keyof typeof ADVERSE_EVENT_SEVERITIES
                            ]?.label || severidade}
                          </Badge>
                          <span className="font-medium">{count}</span>
                        </div>
                      )
                    )}
                  </div>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>Nenhum evento no período</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Histórico de Indicadores</CardTitle>
            </CardHeader>
            <CardContent>
              {historicalIndicators && historicalIndicators.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Período</TableHead>
                      <TableHead className="text-right">Espera (min)</TableHead>
                      <TableHead className="text-right">Cancel. (%)</TableHead>
                      <TableHead className="text-right">No-Show (%)</TableHead>
                      <TableHead className="text-right">Completude (%)</TableHead>
                      <TableHead className="text-right">Ocupação (%)</TableHead>
                      <TableHead className="text-right">NPS</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {historicalIndicators.map((ind) => (
                      <TableRow key={ind.id}>
                        <TableCell>
                          {format(new Date(ind.periodo_inicio), "MMM/yyyy", {
                            locale: ptBR,
                          })}
                        </TableCell>
                        <TableCell className="text-right">
                          {ind.tempo_espera_medio?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ind.taxa_cancelamento?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ind.taxa_noshow?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ind.completude_prontuario?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ind.taxa_ocupacao_salas?.toFixed(1) ?? "—"}
                        </TableCell>
                        <TableCell className="text-right">
                          {ind.nps_score?.toFixed(0) ?? "—"}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-4">
                  Nenhum histórico disponível. Clique em "Recalcular" para gerar.
                </p>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
