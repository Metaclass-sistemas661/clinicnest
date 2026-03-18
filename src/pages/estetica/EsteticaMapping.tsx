/**
 * EsteticaMapping — Página principal do módulo estética.
 * R13: Face/Body Mapping interativo com zonas clicáveis + quantidades.
 * Compõe AestheticChart + BeforeAfterGallery + ProductUsagePanel.
 */
import { useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sparkles, Save, MapPin, Camera, Package } from "lucide-react";
import { AestheticChart } from "@/components/estetica/AestheticChart";
import { BeforeAfterGallery } from "@/components/estetica/BeforeAfterGallery";
import { ProductUsagePanel, type ProductUsageRecord } from "@/components/estetica/ProductUsagePanel";
import {
  GLOGAU_SCALE,
  type ZoneApplication,
  type GlogauType,
} from "@/components/estetica/aestheticConstants";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export default function EsteticaMapping() {
  const { profile } = useAuth();
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get("paciente");

  const [applications, setApplications] = useState<ZoneApplication[]>([]);
  const [glogau, setGlogau] = useState<GlogauType | "">("");
  const [clinicalNotes, setClinicalNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [productUsages, setProductUsages] = useState<ProductUsageRecord[]>([]);

  const handleSave = useCallback(async () => {
    if (!profile?.tenant_id || !patientId) {
      toast.error("Selecione um paciente para salvar o mapeamento");
      return;
    }
    if (applications.length === 0) {
      toast.error("Adicione pelo menos uma aplicação");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("aesthetic_sessions").insert({
        tenant_id: profile.tenant_id,
        patient_id: patientId,
        professional_id: profile.id,
        applications,
        product_usages: productUsages,
        glogau_type: glogau || null,
        clinical_notes: clinicalNotes || null,
        session_date: new Date().toISOString(),
      });
      if (error) throw error;
      toast.success("Sessão estética salva com sucesso!");
      setApplications([]);
      setProductUsages([]);
      setGlogau("");
      setClinicalNotes("");
    } catch (e: any) {
      toast.error(`Erro ao salvar: ${e.message}`);
    } finally {
      setSaving(false);
    }
  }, [profile, patientId, applications, productUsages, glogau, clinicalNotes]);

  return (
    <div className="container mx-auto max-w-7xl space-y-6 py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-fuchsia-500 to-pink-500 text-white">
            <Sparkles className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">Mapeamento Estético</h1>
            <p className="text-sm text-muted-foreground">
              Clique nas zonas para adicionar procedimentos
            </p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={saving || applications.length === 0}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Salvando..." : "Salvar Sessão"}
        </Button>
      </div>

      <Tabs defaultValue="mapeamento" className="space-y-4">
        <TabsList>
          <TabsTrigger value="mapeamento" className="gap-1.5">
            <MapPin className="h-3.5 w-3.5" /> Mapeamento
          </TabsTrigger>
          <TabsTrigger value="fotos" className="gap-1.5">
            <Camera className="h-3.5 w-3.5" /> Fotos Antes/Depois
          </TabsTrigger>
          <TabsTrigger value="produtos" className="gap-1.5">
            <Package className="h-3.5 w-3.5" /> Produtos
          </TabsTrigger>
        </TabsList>

        {/* Tab 1 – Mapeamento de zonas */}
        <TabsContent value="mapeamento" className="space-y-4">
          <div className="flex items-center gap-3 mb-2">
            <Label className="text-sm text-muted-foreground">Classificação Glogau:</Label>
            <Select value={glogau} onValueChange={(v) => setGlogau(v as GlogauType)}>
              <SelectTrigger className="h-8 w-52 text-xs">
                <SelectValue placeholder="Selecionar tipo…" />
              </SelectTrigger>
              <SelectContent>
                {GLOGAU_SCALE.map((g) => (
                  <SelectItem key={g.value} value={g.value}>
                    {g.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <AestheticChart
            applications={applications}
            onApplicationsChange={setApplications}
            showStats
            showLegend
          />

          {/* Clinical Notes */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Observações Clínicas</CardTitle>
            </CardHeader>
            <CardContent>
              <Textarea
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                placeholder="Orientações pós-procedimento, reações observadas, próximos passos…"
                rows={3}
                className="text-sm"
              />
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab 2 – Fotos Antes/Depois */}
        <TabsContent value="fotos">
          {patientId ? (
            <BeforeAfterGallery pairs={[]} onPairsChange={() => {}} />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Camera className="mx-auto h-10 w-10 opacity-30 mb-2" />
                <p className="text-sm">Selecione um paciente para gerenciar fotos antes/depois</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Tab 3 – Produtos utilizados */}
        <TabsContent value="produtos">
          <ProductUsagePanel
            usages={productUsages}
            products={[]}
            onUsagesChange={setProductUsages}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
