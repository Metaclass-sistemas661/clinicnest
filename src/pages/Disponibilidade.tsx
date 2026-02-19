import { useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { logger } from "@/lib/logger";
import { toastRpcError } from "@/lib/rpc-error";
import { createScheduleBlockV1, deleteScheduleBlockV1, upsertProfessionalWorkingHoursV1 } from "@/lib/supabase-typed-rpc";
import { CalendarX, Clock } from "lucide-react";
import type { Profile } from "@/types/database";

type WorkingHoursRow = {
  id: string;
  tenant_id: string;
  professional_id: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

type ScheduleBlockRow = {
  id: string;
  tenant_id: string;
  professional_id: string | null;
  start_at: string;
  end_at: string;
  reason: string | null;
  created_by: string | null;
  created_at: string;
  professional?: { id: string; full_name: string } | null;
};

const DOW_LABEL: Record<number, string> = {
  0: "Dom",
  1: "Seg",
  2: "Ter",
  3: "Qua",
  4: "Qui",
  5: "Sex",
  6: "Sáb",
};

function toLocalInputValue(iso: string) {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function generateTimeOptions(stepMinutes: number) {
  const slots: string[] = [];
  for (let hour = 0; hour <= 23; hour++) {
    for (let minute = 0; minute < 60; minute += stepMinutes) {
      const h = String(hour).padStart(2, "0");
      const m = String(minute).padStart(2, "0");
      slots.push(`${h}:${m}`);
    }
  }
  return slots;
}

const WORKING_HOURS_OPTIONS = generateTimeOptions(15);

export default function Disponibilidade() {
  const { profile, isAdmin } = useAuth();

  const [isLoading, setIsLoading] = useState(true);
  const [professionals, setProfessionals] = useState<Profile[]>([]);
  const [selectedProfessionalId, setSelectedProfessionalId] = useState<string>("");
  const [workingHours, setWorkingHours] = useState<WorkingHoursRow[]>([]);
  const [blocks, setBlocks] = useState<ScheduleBlockRow[]>([]);

  const [isSavingHours, setIsSavingHours] = useState(false);
  const [hoursDraftByDow, setHoursDraftByDow] = useState<Record<number, { start: string; end: string; active: boolean }>>({});

  const [isCreatingBlock, setIsCreatingBlock] = useState(false);
  const [blockProfessionalId, setBlockProfessionalId] = useState<string>("global");
  const [blockStartAt, setBlockStartAt] = useState<string>("");
  const [blockEndAt, setBlockEndAt] = useState<string>("");
  const [blockReason, setBlockReason] = useState<string>("");

  const [blockToDelete, setBlockToDelete] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void refresh();
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (!isAdmin && profile?.id) {
      setSelectedProfessionalId(profile.id);
      setBlockProfessionalId(profile.id);
    }
  }, [isAdmin, profile?.id]);

  useEffect(() => {
    if (selectedProfessionalId) {
      void refreshWorkingHours(selectedProfessionalId);
    }
  }, [selectedProfessionalId]);

  const refresh = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const [profRes, blocksRes] = await Promise.all([
        supabase
          .from("profiles")
          .select("id,user_id,tenant_id,full_name,email,phone,avatar_url,created_at,updated_at")
          .eq("tenant_id", profile.tenant_id)
          .order("full_name"),
        supabase
          .from("schedule_blocks")
          .select("*, professional:profiles(id, full_name)")
          .eq("tenant_id", profile.tenant_id)
          .order("start_at", { ascending: true })
          .limit(200),
      ]);

      if (profRes.error) throw profRes.error;
      if (blocksRes.error) throw blocksRes.error;

      const profs = ((profRes.data as unknown as Profile[]) || []).filter(Boolean);
      setProfessionals(profs);

      if (!selectedProfessionalId) {
        if (!isAdmin && profile?.id) setSelectedProfessionalId(profile.id);
        else if (profs.length > 0) setSelectedProfessionalId(profs[0].id);
      }

      setBlocks((blocksRes.data as unknown as ScheduleBlockRow[]) || []);

      const now = new Date();
      now.setMinutes(0, 0, 0);
      now.setHours(now.getHours() + 1);
      const later = new Date(now.getTime() + 60 * 60 * 1000);
      setBlockStartAt(toLocalInputValue(now.toISOString()));
      setBlockEndAt(toLocalInputValue(later.toISOString()));
    } catch (e) {
      logger.error("[Disponibilidade] refresh error", e);
      toast.error("Erro ao carregar disponibilidade.");
    } finally {
      setIsLoading(false);
    }
  };

  const refreshWorkingHours = async (professionalId: string) => {
    if (!profile?.tenant_id || !professionalId) return;
    try {
      const { data, error } = await supabase
        .from("professional_working_hours")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .eq("professional_id", professionalId);

      if (error) throw error;

      const rows = (data as unknown as WorkingHoursRow[]) || [];
      setWorkingHours(rows);

      const nextDraft: Record<number, { start: string; end: string; active: boolean }> = {};
      for (let dow = 0; dow <= 6; dow++) {
        const row = rows.find((r) => r.day_of_week === dow);
        nextDraft[dow] = {
          start: row?.start_time ?? "08:00:00",
          end: row?.end_time ?? "20:00:00",
          active: row?.is_active ?? false,
        };
      }
      setHoursDraftByDow(nextDraft);
    } catch (e) {
      logger.error("[Disponibilidade] refreshWorkingHours error", e);
      toast.error("Erro ao carregar jornada.");
    }
  };

  const selectedProfessional = useMemo(
    () => professionals.find((p) => p.id === selectedProfessionalId) ?? null,
    [professionals, selectedProfessionalId]
  );

  const handleSaveWorkingHours = async () => {
    if (!selectedProfessionalId) return;
    setIsSavingHours(true);
    try {
      const results = await Promise.all(
        Array.from({ length: 7 }).map((_, dow) => {
          const draft = hoursDraftByDow[dow];
          if (!draft) return Promise.resolve({ error: null });
          return upsertProfessionalWorkingHoursV1({
            p_professional_id: selectedProfessionalId,
            p_day_of_week: dow,
            p_start_time: draft.start,
            p_end_time: draft.end,
            p_is_active: draft.active,
          });
        })
      );

      const failed = results.find((r) => r.error);
      if (failed) {
        toastRpcError(toast, failed.error as any, "Erro ao salvar jornada");
        return;
      }

      toast.success("Jornada salva!");
      await refreshWorkingHours(selectedProfessionalId);
    } catch (e) {
      logger.error("[Disponibilidade] handleSaveWorkingHours error", e);
      toast.error("Erro ao salvar jornada");
    } finally {
      setIsSavingHours(false);
    }
  };

  const handleCreateBlock = async () => {
    if (!profile?.tenant_id) return;

    if (new Date(blockStartAt) >= new Date(blockEndAt)) {
      toast.error("O fim do bloqueio deve ser após o início.");
      return;
    }

    setIsCreatingBlock(true);
    try {
      const professionalId = blockProfessionalId === "global" ? null : blockProfessionalId;
      const startIso = new Date(blockStartAt).toISOString();
      const endIso = new Date(blockEndAt).toISOString();

      const { error } = await createScheduleBlockV1({
        p_professional_id: professionalId,
        p_start_at: startIso,
        p_end_at: endIso,
        p_reason: blockReason || null,
      });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao criar bloqueio");
        return;
      }

      toast.success("Bloqueio criado!");
      setBlockReason("");
      await refresh();
    } catch (e) {
      logger.error("[Disponibilidade] handleCreateBlock error", e);
      toast.error("Erro ao criar bloqueio");
    } finally {
      setIsCreatingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    try {
      const { error } = await deleteScheduleBlockV1({ p_block_id: blockId });
      if (error) {
        toastRpcError(toast, error as any, "Erro ao remover bloqueio");
        return;
      }
      toast.success("Bloqueio removido!");
      await refresh();
    } catch (e) {
      logger.error("[Disponibilidade] delete block error", e);
      toast.error("Erro ao remover bloqueio");
    }
  };

  const visibleBlocks = useMemo(() => {
    if (!isAdmin && profile?.id) {
      return blocks.filter((b) => b.professional_id === null || b.professional_id === profile.id);
    }
    return blocks;
  }, [blocks, isAdmin, profile?.id]);

  const TimeSelect = ({
    value,
    onChange,
    disabled,
  }: {
    value: string;
    onChange: (next: string) => void;
    disabled?: boolean;
  }) => {
    const valueHHMM = value.slice(0, 5);
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className="w-full justify-between font-mono"
          >
            <span>{valueHHMM}</span>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="border-b px-3 py-2">
            <div className="text-sm font-medium text-foreground">Selecione um horário</div>
            <div className="text-xs text-muted-foreground">Passos de 15 minutos</div>
          </div>
          <ScrollArea className="h-56">
            <div className="grid grid-cols-4 gap-1 p-2">
              {WORKING_HOURS_OPTIONS.map((t) => {
                const isSelected = t === valueHHMM;
                return (
                  <Button
                    key={t}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "ghost"}
                    className={isSelected ? "gradient-primary text-primary-foreground" : "font-mono"}
                    onClick={() => onChange(`${t}:00`)}
                  >
                    {t}
                  </Button>
                );
              })}
            </div>
          </ScrollArea>
        </PopoverContent>
      </Popover>
    );
  };

  return (
    <MainLayout title="Disponibilidade" subtitle="Jornada e bloqueios de agenda">
      {isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Jornada do profissional</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {isAdmin ? (
                <div className="space-y-2">
                  <Label>Profissional</Label>
                  <Select value={selectedProfessionalId} onValueChange={setSelectedProfessionalId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {professionals.map((p) => (
                        <SelectItem key={p.id} value={p.id}>
                          {p.full_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">
                  Profissional: <span className="font-medium text-foreground">{selectedProfessional?.full_name}</span>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Array.from({ length: 7 }).map((_, i) => {
                  const dow = i;
                  const draft = hoursDraftByDow[dow];
                  if (!draft) return null;
                  return (
                    <div key={dow} className="rounded-lg border p-3 space-y-2 hover:bg-muted/50 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="font-medium">{DOW_LABEL[dow]}</div>
                        <Badge variant={draft.active ? "default" : "secondary"}>{draft.active ? "Ativo" : "Inativo"}</Badge>
                      </div>
                      <div className="grid grid-cols-3 gap-2 items-end">
                        <div className="space-y-1">
                          <Label className="text-xs">Início</Label>
                          <TimeSelect
                            value={draft.start}
                            onChange={(next) =>
                              setHoursDraftByDow((prev) => ({
                                ...prev,
                                [dow]: { ...prev[dow], start: next },
                              }))
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Fim</Label>
                          <TimeSelect
                            value={draft.end}
                            onChange={(next) =>
                              setHoursDraftByDow((prev) => ({
                                ...prev,
                                [dow]: { ...prev[dow], end: next },
                              }))
                            }
                          />
                        </div>
                        <Button
                          type="button"
                          variant={draft.active ? "outline" : "default"}
                          className={draft.active ? "" : "gradient-primary text-primary-foreground"}
                          onClick={() =>
                            setHoursDraftByDow((prev) => ({
                              ...prev,
                              [dow]: { ...prev[dow], active: !prev[dow].active },
                            }))
                          }
                        >
                          {draft.active ? "Desativar" : "Ativar"}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex justify-end">
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={handleSaveWorkingHours}
                  disabled={isSavingHours || !selectedProfessionalId}
                >
                  {isSavingHours ? "Salvando..." : "Salvar jornada"}
                </Button>
              </div>

              <p className="text-xs text-muted-foreground">
                Se nenhuma jornada estiver ativa, o sistema permite agendar em qualquer horário (modo compatível). Ao ativar a jornada,
                agendamentos fora desse intervalo serão bloqueados.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Bloqueios</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Escopo</Label>
                  <Select value={blockProfessionalId} onValueChange={setBlockProfessionalId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {isAdmin && <SelectItem value="global">Clínica (global)</SelectItem>}
                      {professionals
                        .filter((p) => (isAdmin ? true : p.id === profile?.id))
                        .map((p) => (
                          <SelectItem key={p.id} value={p.id}>
                            {p.full_name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Motivo</Label>
                  <Textarea value={blockReason} onChange={(e) => setBlockReason(e.target.value)} rows={2} />
                </div>
                <div className="space-y-2">
                  <Label>Início</Label>
                  <Input type="datetime-local" value={blockStartAt} onChange={(e) => setBlockStartAt(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Fim</Label>
                  <Input type="datetime-local" value={blockEndAt} onChange={(e) => setBlockEndAt(e.target.value)} />
                </div>
              </div>

              <div className="flex justify-end">
                <Button
                  className="gradient-primary text-primary-foreground"
                  onClick={handleCreateBlock}
                  disabled={isCreatingBlock || !blockStartAt || !blockEndAt}
                >
                  {isCreatingBlock ? "Criando..." : "Criar bloqueio"}
                </Button>
              </div>

              <Separator />

              {visibleBlocks.length === 0 ? (
                <EmptyState
                  icon={CalendarX}
                  title="Nenhum bloqueio cadastrado"
                  description="Crie um bloqueio para indisponibilizar períodos na agenda."
                />
              ) : (
                <div className="space-y-2">
                  {visibleBlocks.map((b) => (
                    <div key={b.id} className="rounded-lg border p-3 flex items-start justify-between gap-4 hover:bg-muted/50 transition-colors">
                      <div className="space-y-1">
                        <div className="text-sm font-medium">
                          {b.professional_id ? `Profissional: ${b.professional?.full_name ?? "—"}` : "Global (clínica)"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(b.start_at).toLocaleString("pt-BR")} → {new Date(b.end_at).toLocaleString("pt-BR")}
                        </div>
                        {b.reason && <div className="text-xs text-muted-foreground">{b.reason}</div>}
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setBlockToDelete(b.id)}
                        aria-label={`Remover bloqueio de ${b.professional?.full_name ?? "clínica"}`}
                      >
                        Remover
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Confirmação de exclusão de bloqueio */}
      <AlertDialog open={!!blockToDelete} onOpenChange={(open) => !open && setBlockToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover bloqueio?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O período será liberado na agenda.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBlockToDelete(null)}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={async () => {
                if (blockToDelete) {
                  await handleDeleteBlock(blockToDelete);
                  setBlockToDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </MainLayout>
  );
}
