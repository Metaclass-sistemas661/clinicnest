import { useState, useEffect, useCallback, useMemo } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { EmptyState } from "@/components/ui/empty-state";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useDebounce } from "@/hooks/useDebounce";
import { logger } from "@/lib/logger";
import {
  FileSignature,
  Search,
  Eye,
  Download,
  Camera,
  Clock,
  Globe,
  Monitor,
  User,
  FileText,
  ShieldCheck,
  CheckCircle2,
  Filter,
  ChevronDown,
  ChevronUp,
  CalendarDays,
  X,
  History,
  SlidersHorizontal,
} from "lucide-react";
import { format, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

const RECENT_LIMIT = 3;

interface SignedConsent {
  id: string;
  patient_id: string;
  client_name: string;
  template_id: string;
  template_title: string;
  template_slug: string;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  facial_photo_path: string | null;
  template_snapshot_html: string | null;
}

export default function ContratosTermos() {
  const { profile } = useAuth();
  const [consents, setConsents] = useState<SignedConsent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [templateFilter, setTemplateFilter] = useState("all");
  const [patientFilter, setPatientFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewConsent, setViewConsent] = useState<SignedConsent | null>(null);
  const [viewPhotoUrl, setViewPhotoUrl] = useState<string | null>(null);

  const fetchConsents = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("patient_consents")
        .select("*, patient:patients(name), consent_templates(title, slug)")
        .eq("tenant_id", profile.tenant_id)
        .order("signed_at", { ascending: false });

      if (error) throw error;

      setConsents(
        (data ?? []).map((row: any) => ({
          id: row.id,
          patient_id: row.patient_id,
          client_name: row.patient?.name ?? "Paciente removido",
          template_id: row.template_id,
          template_title: row.consent_templates?.title ?? "Termo removido",
          template_slug: row.consent_templates?.slug ?? "",
          signed_at: row.signed_at,
          ip_address: row.ip_address,
          user_agent: row.user_agent,
          facial_photo_path: row.facial_photo_path,
          template_snapshot_html: row.template_snapshot_html,
        }))
      );
    } catch (err) {
      logger.error("[ContratosTermos] fetch error", err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  useEffect(() => {
    fetchConsents();
  }, [fetchConsents]);

  useEffect(() => {
    if (!viewConsent?.facial_photo_path) {
      setViewPhotoUrl(null);
      return;
    }
    const loadPhoto = async () => {
      const { data } = await supabase.storage
        .from("consent-photos")
        .createSignedUrl(viewConsent.facial_photo_path!, 300);
      setViewPhotoUrl(data?.signedUrl ?? null);
    };
    loadPhoto();
  }, [viewConsent]);

  const templateOptions = useMemo(() => {
    const map = new Map<string, string>();
    consents.forEach((c) => map.set(c.template_id, c.template_title));
    return Array.from(map.entries()).map(([id, title]) => ({ id, title }));
  }, [consents]);

  const patientOptions = useMemo(() => {
    const map = new Map<string, string>();
    consents.forEach((c) => map.set(c.patient_id, c.client_name));
    return Array.from(map.entries())
      .map(([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [consents]);

  const hasActiveFilters = useMemo(
    () =>
      debouncedSearch.trim() !== "" ||
      templateFilter !== "all" ||
      patientFilter !== "all" ||
      dateFrom !== "" ||
      dateTo !== "",
    [debouncedSearch, templateFilter, patientFilter, dateFrom, dateTo]
  );

  const clearAllFilters = useCallback(() => {
    setSearchQuery("");
    setTemplateFilter("all");
    setPatientFilter("all");
    setDateFrom("");
    setDateTo("");
  }, []);

  const filtered = useMemo(() => {
    let list = consents;
    if (templateFilter !== "all") {
      list = list.filter((c) => c.template_id === templateFilter);
    }
    if (patientFilter !== "all") {
      list = list.filter((c) => c.patient_id === patientFilter);
    }
    if (dateFrom) {
      const from = startOfDay(new Date(dateFrom));
      list = list.filter((c) => !isBefore(new Date(c.signed_at), from));
    }
    if (dateTo) {
      const to = endOfDay(new Date(dateTo));
      list = list.filter((c) => !isAfter(new Date(c.signed_at), to));
    }
    if (debouncedSearch.trim()) {
      const q = debouncedSearch.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.client_name.toLowerCase().includes(q) ||
          c.template_title.toLowerCase().includes(q)
      );
    }
    return list;
  }, [consents, templateFilter, patientFilter, dateFrom, dateTo, debouncedSearch]);

  /** When no filters → show only recent; when filters active → show all filtered */
  const displayList = useMemo(
    () => (hasActiveFilters ? filtered : filtered.slice(0, RECENT_LIMIT)),
    [filtered, hasActiveFilters]
  );

  const handleExport = (consent: SignedConsent) => {
    const html = `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Comprovante - ${consent.template_title} - ${consent.client_name}</title>
  <style>
    body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 40px; color: #333; }
    h1 { font-size: 20px; border-bottom: 2px solid #333; padding-bottom: 10px; }
    h2 { font-size: 16px; color: #555; margin-top: 30px; }
    .meta { background: #f5f5f5; padding: 15px; border-radius: 8px; margin: 20px 0; }
    .meta p { margin: 5px 0; font-size: 13px; }
    .meta strong { display: inline-block; width: 140px; }
    .term-content { border: 1px solid #ddd; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .stamp { background: #e8f5e9; border: 1px solid #4caf50; padding: 10px 15px; border-radius: 8px; text-align: center; color: #2e7d32; font-weight: bold; margin: 20px 0; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 11px; color: #888; }
  </style>
</head>
<body>
  <h1>Comprovante de Assinatura Digital</h1>
  <div class="stamp">TERMO ASSINADO DIGITALMENTE COM RECONHECIMENTO FACIAL</div>
  <div class="meta">
    <p><strong>Paciente:</strong> ${consent.client_name}</p>
    <p><strong>Termo:</strong> ${consent.template_title}</p>
    <p><strong>Data/Hora:</strong> ${format(new Date(consent.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}</p>
    <p><strong>Endereço IP:</strong> ${consent.ip_address || "Não registrado"}</p>
    <p><strong>Navegador:</strong> ${consent.user_agent || "Não registrado"}</p>
    <p><strong>ID Assinatura:</strong> ${consent.id}</p>
  </div>
  <h2>Conteúdo do Termo (versão assinada)</h2>
  <div class="term-content">${consent.template_snapshot_html || "<p>Conteúdo não disponível</p>"}</div>
  <div class="footer">
    <p>Este documento é um comprovante digital de assinatura com reconhecimento facial.</p>
    <p>Gerado em: ${format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}</p>
  </div>
</body>
</html>`;
    const blob = new Blob([html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `comprovante-${consent.template_slug || "termo"}-${consent.client_name.replace(/\s+/g, "_")}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <MainLayout
      title="Contratos e Termos Assinados"
      subtitle="Registro jurídico de todos os documentos assinados por pacientes"
    >
      <div className="space-y-6">
        {/* Info banner */}
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="py-4 px-5">
            <div className="flex items-start gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 flex-shrink-0 mt-0.5">
                <ShieldCheck className="h-4.5 w-4.5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold text-sm text-foreground mb-1">
                  Resguardo jurídico da clínica
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  Todos os termos assinados ficam registrados com <strong>foto facial</strong>, <strong>data/hora</strong>,
                  {" "}<strong>endereço IP</strong> e <strong>snapshot do conteúdo</strong> na versão exata assinada pelo paciente.
                  Esses registros servem como prova jurídica e podem ser exportados a qualquer momento.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats row */}
        {!isLoading && consents.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 flex-shrink-0">
                  <FileSignature className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-bold">{consents.length}</p>
                  <p className="text-[11px] text-muted-foreground">Total assinaturas</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500/10 flex-shrink-0">
                  <User className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{new Set(consents.map((c) => c.patient_id)).size}</p>
                  <p className="text-[11px] text-muted-foreground">Pacientes</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-500/10 flex-shrink-0">
                  <FileText className="h-4 w-4 text-amber-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{templateOptions.length}</p>
                  <p className="text-[11px] text-muted-foreground">Tipos de termo</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="py-3 px-4 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-green-500/10 flex-shrink-0">
                  <Camera className="h-4 w-4 text-green-600" />
                </div>
                <div>
                  <p className="text-lg font-bold">{consents.filter((c) => c.facial_photo_path).length}</p>
                  <p className="text-[11px] text-muted-foreground">Com foto facial</p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* ── Section: Últimas Assinaturas (default) ── */}
        {!hasActiveFilters && !isLoading && consents.length > 0 && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h2 className="text-sm font-semibold">Últimas assinaturas</h2>
                <Badge variant="secondary" className="text-[10px]">{Math.min(RECENT_LIMIT, consents.length)} recentes</Badge>
              </div>
              {consents.length > RECENT_LIMIT && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-xs text-primary hover:text-primary/80 gap-1.5"
                  onClick={() => setFiltersOpen(true)}
                >
                  <History className="h-3.5 w-3.5" />
                  Ver histórico completo ({consents.length})
                </Button>
              )}
            </div>
          </div>
        )}

        {/* ── Advanced Filters Panel ── */}
        <Card className="border-dashed">
          <button
            type="button"
            className="w-full flex items-center justify-between px-5 py-3 hover:bg-muted/50 transition-colors"
            onClick={() => setFiltersOpen((prev) => !prev)}
          >
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">Filtros avançados</span>
              {hasActiveFilters && (
                <Badge variant="default" className="text-[10px] h-5">
                  {[
                    debouncedSearch.trim() ? 1 : 0,
                    templateFilter !== "all" ? 1 : 0,
                    patientFilter !== "all" ? 1 : 0,
                    dateFrom ? 1 : 0,
                    dateTo ? 1 : 0,
                  ].reduce((a, b) => a + b, 0)}{" "}
                  ativo{[debouncedSearch.trim() ? 1 : 0, templateFilter !== "all" ? 1 : 0, patientFilter !== "all" ? 1 : 0, dateFrom ? 1 : 0, dateTo ? 1 : 0].reduce((a, b) => a + b, 0) > 1 ? "s" : ""}
                </Badge>
              )}
            </div>
            {filtersOpen ? (
              <ChevronUp className="h-4 w-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            )}
          </button>

          {filtersOpen && (
            <CardContent className="pt-0 pb-4 px-5 space-y-4 border-t">
              {/* Row 1: Search + Patient */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Busca</label>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Nome do paciente ou termo..."
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Paciente</label>
                  <Select value={patientFilter} onValueChange={setPatientFilter}>
                    <SelectTrigger>
                      <User className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Todos os pacientes" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os pacientes</SelectItem>
                      {patientOptions.map((p) => (
                        <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Row 2: Template + Date range */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Tipo de documento</label>
                  <Select value={templateFilter} onValueChange={setTemplateFilter}>
                    <SelectTrigger>
                      <FileText className="h-4 w-4 mr-2 text-muted-foreground" />
                      <SelectValue placeholder="Todos os tipos" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos os tipos</SelectItem>
                      {templateOptions.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Data início</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Data fim</label>
                  <div className="relative">
                    <CalendarDays className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground pointer-events-none" />
                    <Input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              {/* Clear filters */}
              {hasActiveFilters && (
                <div className="flex items-center justify-between pt-1">
                  <Badge variant="secondary" className="text-xs">
                    {filtered.length} resultado{filtered.length !== 1 ? "s" : ""} encontrado{filtered.length !== 1 ? "s" : ""}
                  </Badge>
                  <Button variant="ghost" size="sm" className="text-xs gap-1.5 text-muted-foreground hover:text-foreground" onClick={clearAllFilters}>
                    <X className="h-3.5 w-3.5" />
                    Limpar filtros
                  </Button>
                </div>
              )}
            </CardContent>
          )}
        </Card>

        {/* ── Results ── */}
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : displayList.length === 0 ? (
          <EmptyState
            icon={FileSignature}
            title={hasActiveFilters ? "Nenhum resultado encontrado" : "Nenhum documento assinado"}
            description={
              hasActiveFilters
                ? "Ajuste os filtros para encontrar os documentos."
                : "Quando um paciente assinar um termo no portal, ele aparecerá aqui."
            }
          />
        ) : (
          <>
            {/* Active filter indicator */}
            {hasActiveFilters && (
              <div className="flex items-center gap-2 mb-1">
                <Filter className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-medium text-muted-foreground">
                  Exibindo {filtered.length} de {consents.length} assinaturas
                </span>
              </div>
            )}

            {/* Mobile: Cards */}
            <div className="block md:hidden space-y-3">
              {displayList.map((c) => (
                <Card key={c.id}>
                  <CardContent className="py-3 px-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <User className="h-4 w-4 text-primary flex-shrink-0" />
                          <p className="font-medium text-sm truncate">{c.client_name}</p>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">{c.template_title}</p>
                        <div className="flex items-center gap-2 mt-1.5 text-[11px] text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(c.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          {c.facial_photo_path && (
                            <span className="flex items-center gap-1 text-green-600">
                              <Camera className="h-3 w-3" /> Foto
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewConsent(c)}>
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExport(c)}>
                          <Download className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Desktop: Table */}
            <div className="hidden md:block">
              <Card>
                <CardContent className="p-0">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Paciente</TableHead>
                        <TableHead>Documento</TableHead>
                        <TableHead>Data/Hora</TableHead>
                        <TableHead>Foto Facial</TableHead>
                        <TableHead>IP</TableHead>
                        <TableHead className="text-right">Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayList.map((c) => (
                        <TableRow key={c.id}>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <User className="h-4 w-4 text-primary" />
                              <span className="font-medium">{c.client_name}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground" />
                              <div>
                                <p className="text-sm">{c.template_title}</p>
                                <p className="text-[10px] text-muted-foreground font-mono">{c.template_slug}</p>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {format(new Date(c.signed_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                          </TableCell>
                          <TableCell>
                            {c.facial_photo_path ? (
                              <Badge variant="outline" className="text-[10px] text-green-600 border-green-300 gap-1">
                                <Camera className="h-3 w-3" /> Sim
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {c.ip_address || "—"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setViewConsent(c)} title="Ver detalhes">
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleExport(c)} title="Exportar comprovante">
                                <Download className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            {/* "Ver mais" prompt when showing only recent */}
            {!hasActiveFilters && consents.length > RECENT_LIMIT && (
              <div className="flex justify-center pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 text-xs"
                  onClick={() => setFiltersOpen(true)}
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                  Buscar no histórico completo ({consents.length} documentos)
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Detail Dialog */}
      <Dialog open={!!viewConsent} onOpenChange={() => setViewConsent(null)}>
        <DialogContent className="max-w-[95vw] w-full lg:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-green-600" />
              Comprovante de Assinatura
            </DialogTitle>
            <DialogDescription>
              Prova jurídica da assinatura digital com reconhecimento facial
            </DialogDescription>
          </DialogHeader>

          {viewConsent && (
            <div className="space-y-5 py-2">
              <Card className="bg-green-50/50 dark:bg-green-950/30 border-green-200 dark:border-green-800">
                <CardContent className="py-4 px-5">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Paciente</p>
                        <p className="font-medium">{viewConsent.client_name}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Documento</p>
                        <p className="font-medium">{viewConsent.template_title}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Data/Hora</p>
                        <p className="font-medium">
                          {format(new Date(viewConsent.signed_at), "dd/MM/yyyy 'às' HH:mm:ss", { locale: ptBR })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Globe className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Endereço IP</p>
                        <p className="font-medium font-mono text-xs">{viewConsent.ip_address || "Não registrado"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <Monitor className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">Navegador</p>
                        <p className="font-medium text-xs truncate max-w-full">{viewConsent.user_agent || "Não registrado"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 sm:col-span-2">
                      <ShieldCheck className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <div>
                        <p className="text-[11px] text-muted-foreground">ID da Assinatura</p>
                        <p className="font-medium font-mono text-xs">{viewConsent.id}</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {viewConsent.facial_photo_path && (
                <div className="space-y-2">
                  <h4 className="text-sm font-semibold flex items-center gap-2">
                    <Camera className="h-4 w-4" />
                    Foto Facial (momento da assinatura)
                  </h4>
                  <div className="flex justify-center">
                    {viewPhotoUrl ? (
                      <img
                        src={viewPhotoUrl}
                        alt="Foto facial do paciente no momento da assinatura"
                        className="max-w-[200px] rounded-xl border-2 border-green-200 dark:border-green-800 shadow-md"
                      />
                    ) : (
                      <div className="w-[200px] h-[150px] bg-muted rounded-xl flex items-center justify-center">
                        <Camera className="h-8 w-8 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </div>
              )}

              <Separator />

              <div className="space-y-2">
                <h4 className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  Conteúdo do Termo (versão assinada)
                </h4>
                <div
                  className="prose prose-sm dark:prose-invert max-w-none border rounded-lg p-6 bg-card max-h-[40vh] overflow-y-auto"
                  dangerouslySetInnerHTML={{ __html: viewConsent.template_snapshot_html || "<p>Conteúdo não disponível</p>" }}
                />
              </div>

              <div className="flex justify-end">
                <Button variant="outline" onClick={() => handleExport(viewConsent)}>
                  <Download className="mr-2 h-4 w-4" />
                  Exportar Comprovante
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </MainLayout>
  );
}
