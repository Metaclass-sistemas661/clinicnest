import { Spinner } from "@/components/ui/spinner";
/**
 * OdontogramaEmbed — Widget compacto do odontograma para prontuário
 * 
 * Versão reduzida do odontograma profissional para embedding dentro do prontuário.
 * Usa os mesmos componentes (OdontogramChart, ToothEditDialog) da página principal.
 */
import { useState, useEffect, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Smile, Trash2, Loader2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { normalizeError } from "@/utils/errorMessages";
import { Link } from "react-router-dom";

import { OdontogramChart, type ToothRecord } from "@/components/odontograma/OdontogramChart";
import { ToothEditDialog, type ToothFormData } from "@/components/odontograma/ToothEditDialog";
import {
  TOOTH_CONDITIONS,
  type DentitionType,
  type ToothConditionKey,
} from "@/components/odontograma/odontogramConstants";

interface Props {
  tenantId: string;
  patientId: string;
  professionalId: string;
  appointmentId?: string | null;
  readOnly?: boolean;
}

function getConditionInfo(condition: string) {
  return TOOTH_CONDITIONS.find(c => c.value === condition) ?? TOOTH_CONDITIONS[0];
}

export function OdontogramaEmbed({ tenantId, patientId, professionalId, appointmentId, readOnly = false }: Props) {
  const [teeth, setTeeth] = useState<Map<number, ToothRecord>>(new Map());
  const [dentitionType, setDentitionType] = useState<DentitionType>("permanent");
  const [selectedTooth, setSelectedTooth] = useState<number | null>(null);
  const [toothDialogOpen, setToothDialogOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    let cancelled = false;

    if (tenantId && patientId) {
      void loadLatestOdontogram(cancelled);
    }

    return () => {
      cancelled = true;
    };
  }, [tenantId, patientId]);

  const loadLatestOdontogram = async (cancelled = false) => {
    setIsLoading(true);
    try {
      const { data: odontograms, error } = await (supabase
        .rpc as any)("get_client_odontograms", {
          p_tenant_id: tenantId,
          p_client_id: patientId,
        });

      if (error) throw error;

      if (cancelled) return;

      if (odontograms && (odontograms as any[]).length > 0) {
        const latest = (odontograms as any[])[0];
        if (cancelled) return;
        setDentitionType((latest.dentition_type as DentitionType) || "permanent");

        const { data: teethData } = await (supabase
          .rpc as any)("get_odontogram_teeth", { p_odontogram_id: latest.id });

        if (cancelled) return;

        const map = new Map<number, ToothRecord>();
        for (const t of (teethData as any[]) || []) {
          map.set(t.tooth_number, {
            tooth_number: t.tooth_number,
            condition: (t.condition || "healthy") as ToothConditionKey,
            surfaces: t.surfaces || undefined,
            notes: t.notes || undefined,
            procedure_date: t.procedure_date || undefined,
            mobility_grade: t.mobility_grade ?? null,
            priority: t.priority || "normal",
          });
        }
        setTeeth(map);
      }
    } catch (err) {
      console.error("Erro ao carregar odontograma:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const openToothDialog = (toothNumber: number) => {
    if (readOnly) return;
    setSelectedTooth(toothNumber);
    setToothDialogOpen(true);
  };

  const handleSaveTooth = (data: ToothFormData) => {
    if (selectedTooth == null) return;
    const next = new Map(teeth);
    next.set(selectedTooth, {
      tooth_number: selectedTooth,
      condition: data.condition,
      surfaces: data.surfaces || undefined,
      notes: data.notes || undefined,
      procedure_date: data.procedure_date || undefined,
      mobility_grade: data.mobility_grade,
      priority: data.priority || "normal",
    });
    setTeeth(next);
    setIsDirty(true);
    setToothDialogOpen(false);
    toast.success(`Dente ${selectedTooth} atualizado`);
  };

  const handleRemoveTooth = () => {
    if (selectedTooth == null || readOnly) return;
    const next = new Map(teeth);
    next.delete(selectedTooth);
    setTeeth(next);
    setIsDirty(true);
    setToothDialogOpen(false);
    toast.success(`Dente ${selectedTooth} removido`);
  };

  const handleSaveOdontogram = async () => {
    if (readOnly) return;
    setIsSaving(true);

    try {
      const teethArray = Array.from(teeth.values()).map(t => ({
        tooth_number: t.tooth_number,
        condition: t.condition,
        surfaces: t.surfaces || null,
        notes: t.notes || null,
        procedure_date: t.procedure_date || null,
        mobility_grade: t.mobility_grade ?? null,
        priority: t.priority || "normal",
      }));

      const { error } = await (supabase
        .rpc as any)("create_odontogram_with_teeth", {
          p_tenant_id: tenantId,
          p_client_id: patientId,
          p_professional_id: professionalId,
          p_appointment_id: appointmentId || null,
          p_exam_date: new Date().toISOString().split("T")[0],
          p_notes: `Odontograma: ${teethArray.length} dente(s) — Dentição: ${dentitionType}`,
          p_teeth: teethArray,
          p_dentition_type: dentitionType,
        });

      if (error) throw error;

      toast.success("Odontograma salvo com sucesso");
      setIsDirty(false);
      await loadLatestOdontogram();
    } catch (err: any) {
      console.error("Erro ao salvar odontograma:", err);
      toast.error("Erro ao salvar odontograma", { description: normalizeError(err, "Não foi possível salvar o odontograma.") });
    } finally {
      setIsSaving(false);
    }
  };

  const records = useMemo(
    () => Array.from(teeth.values()).sort((a, b) => a.tooth_number - b.tooth_number),
    [teeth]
  );

  const selectedToothData = useMemo(
    () => (selectedTooth != null ? teeth.get(selectedTooth) : undefined),
    [selectedTooth, teeth]
  );

  if (isLoading) {
    return (
      <Card>
        <CardContent className="py-8 flex items-center justify-center gap-2">
          <Spinner size="sm" className="text-muted-foreground" />
          <span className="text-muted-foreground">Carregando odontograma...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Smile className="h-4 w-4" />
                Odontograma
                {isDirty && (
                  <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-600">Não salvo</Badge>
                )}
              </CardTitle>
              <CardDescription>Mapa dental do paciente (5 faces por dente)</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" asChild>
                <Link to="/odontograma">
                  <ExternalLink className="h-3 w-3 mr-1" />
                  Completo
                </Link>
              </Button>
              {!readOnly && records.length > 0 && (
                <Button size="sm" onClick={handleSaveOdontogram} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <Smile className="h-3 w-3 mr-1" />}
                  Salvar
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <OdontogramChart
            teeth={teeth}
            dentitionType={dentitionType}
            onDentitionChange={!readOnly ? setDentitionType : undefined}
            selectedTooth={selectedTooth}
            onToothClick={openToothDialog}
            compact
            readOnly={readOnly}
            showLegend
            showStats={false}
          />
        </CardContent>
      </Card>

      {/* Records table (compact) */}
      {records.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Registros ({records.length})</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-16">Dente</TableHead>
                  <TableHead>Condição</TableHead>
                  <TableHead>Faces</TableHead>
                  <TableHead>Obs</TableHead>
                  {!readOnly && <TableHead className="w-10" />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {records.map(r => {
                  const info = getConditionInfo(r.condition);
                  return (
                    <TableRow
                      key={r.tooth_number}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => openToothDialog(r.tooth_number)}
                    >
                      <TableCell className="font-mono font-bold text-sm">{r.tooth_number}</TableCell>
                      <TableCell>
                        <Badge style={{ backgroundColor: info.color, color: "white" }} className="text-[10px]">
                          {info.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">{r.surfaces || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[100px] truncate">
                        {r.notes || "—"}
                      </TableCell>
                      {!readOnly && (
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={(e) => {
                              e.stopPropagation();
                              const next = new Map(teeth);
                              next.delete(r.tooth_number);
                              setTeeth(next);
                              setIsDirty(true);
                            }}
                          >
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Tooth Edit Dialog */}
      <ToothEditDialog
        open={toothDialogOpen}
        onOpenChange={setToothDialogOpen}
        toothNumber={selectedTooth}
        initialData={selectedToothData ? {
          condition: selectedToothData.condition,
          surfaces: selectedToothData.surfaces,
          notes: selectedToothData.notes ?? "",
          procedure_date: selectedToothData.procedure_date ?? "",
          mobility_grade: selectedToothData.mobility_grade ?? null,
          priority: selectedToothData.priority ?? "normal",
        } : undefined}
        onSave={handleSaveTooth}
        onRemove={selectedTooth != null && teeth.has(selectedTooth) ? handleRemoveTooth : undefined}
      />
    </div>
  );
}
