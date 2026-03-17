import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Calculator, Download } from "lucide-react";
import { generateConsultaXML, generateSPSADTXML, downloadTissXml, generateLotNumber } from "@/lib/tiss";

type InsurancePlan = { id: string; name: string; ans_code: string | null; tiss_version: string | null };
type PatientOption = { id: string; name: string; cpf: string | null; insurance_card_number: string | null };
type ProcedureOption = { id: string; name: string; tuss_code: string | null; insurance_price: number };

export default function NovaGuiaTISS() {
  const navigate = useNavigate();
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [plans, setPlans] = useState<InsurancePlan[]>([]);
  const [patients, setPatients] = useState<PatientOption[]>([]);
  const [procedures, setProcedures] = useState<ProcedureOption[]>([]);

  const [guideType, setGuideType] = useState<"consulta" | "sadt">("consulta");
  const [planId, setPlanId] = useState("");
  const [patientId, setPatientId] = useState("");
  const [procedureId, setProcedureId] = useState("");
  const [dataAtendimento, setDataAtendimento] = useState(new Date().toISOString().slice(0, 10));
  const [horaInicial, setHoraInicial] = useState("08:00");
  const [cidCode, setCidCode] = useState("");
  const [authorization, setAuthorization] = useState("");
  const [tipoConsulta, setTipoConsulta] = useState("1");
  const [indicacaoAcidente, setIndicacaoAcidente] = useState("0");
  const [caraterAtendimento, setCaraterAtendimento] = useState("1");
  const [tipoAtendimento, setTipoAtendimento] = useState("05");
  const [observacao, setObservacao] = useState("");
  const [quantidade, setQuantidade] = useState("1");

  useEffect(() => {
    if (profile?.tenant_id) loadData();
  }, [profile?.tenant_id]);

  const loadData = async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const [plansRes, patientsRes, proceduresRes] = await Promise.all([
        supabase.from("insurance_plans").select("id, name, ans_code, tiss_version").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("name"),
        supabase.from("patients").select("id, name, cpf, insurance_card_number").eq("tenant_id", profile.tenant_id).order("name").limit(500),
        supabase.from("procedures").select("id, name, tuss_code, insurance_price").eq("tenant_id", profile.tenant_id).eq("is_active", true).order("name"),
      ]);
      setPlans((plansRes.data ?? []) as InsurancePlan[]);
      setPatients((patientsRes.data ?? []) as PatientOption[]);
      setProcedures((proceduresRes.data ?? []) as ProcedureOption[]);
    } catch (err) {
      logger.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const selectedPlan = plans.find((p) => p.id === planId);
  const selectedPatient = patients.find((c) => c.id === patientId);
  const selectedProcedure = procedures.find((s) => s.id === procedureId);
  const valorTotal = (selectedProcedure?.insurance_price ?? 0) * Number(quantidade || 1);

  const handleGenerate = async () => {
    if (!planId || !patientId || !procedureId) {
      toast.error("Preencha convênio, paciente e procedimento");
      return;
    }
    if (!profile?.tenant_id) return;

    setIsSaving(true);
    try {
      const tenant = (await supabase.from("tenants").select("*").eq("id", profile.tenant_id).single()).data;
      if (!tenant) throw new Error("Tenant não encontrado");

      const lotNum = generateLotNumber(1);
      const guideNum = `${lotNum}0001`;
      const ver = selectedPlan?.tiss_version ?? "3.05.00";
      const todayStr = new Date().toISOString().slice(0, 10);
      const cnpj = tenant.cnpj ?? "00000000000000";
      const cnes = tenant.cnes_code ?? "0000000";
      const crm = tenant.responsible_crm ?? "000000";

      let xml: string;

      if (guideType === "sadt") {
        xml = generateSPSADTXML({
          prestadorCnpj: cnpj,
          prestadorCnes: cnes,
          prestadorNome: tenant.name,
          profissionalSolicitante: tenant.responsible_name ?? "Profissional",
          profissionalSolicitanteCRM: crm,
          profissionalSolicitanteConselho: "CRM",
          profissionalSolicitanteUF: "SP",
          operadoraRegistroANS: selectedPlan?.ans_code ?? "000000",
          beneficiarioNome: selectedPatient?.name ?? "",
          beneficiarioCarteirinha: selectedPatient?.insurance_card_number ?? "000000000000000",
          beneficiarioCpf: selectedPatient?.cpf ?? undefined,
          dataAtendimento,
          dataSolicitacao: dataAtendimento,
          numeroGuia: guideNum,
          senhaAutorizacao: authorization || undefined,
          caraterAtendimento,
          tipoAtendimento,
          indicacaoAcidente,
          indicacaoClinica: cidCode ? `CID: ${cidCode}` : undefined,
          procedimentos: [{
            codigoTabela: "22",
            codigoProcedimento: selectedProcedure?.tuss_code ?? "10101012",
            descricao: selectedProcedure?.name ?? "",
            quantidade: Number(quantidade),
            valorUnitario: selectedProcedure?.insurance_price ?? 0,
            valorTotal,
          }],
          observacao: observacao || undefined,
          numLote: lotNum,
          dataEnvio: todayStr,
          tissVersion: ver,
        });
      } else {
        xml = generateConsultaXML({
          prestadorCnpj: cnpj,
          prestadorCnes: cnes,
          prestadorNome: tenant.name,
          profissionalNome: tenant.responsible_name ?? "Profissional",
          profissionalCrm: crm,
          profissionalConselho: "CRM",
          profissionalUF: "SP",
          operadoraRegistroANS: selectedPlan?.ans_code ?? "000000",
          beneficiarioNome: selectedPatient?.name ?? "",
          beneficiarioCarteirinha: selectedPatient?.insurance_card_number ?? "000000000000000",
          beneficiarioCpf: selectedPatient?.cpf ?? undefined,
          dataAtendimento,
          horaInicial,
          numeroGuia: guideNum,
          indicacaoAcidente,
          tipoConsulta,
          tussCode: selectedProcedure?.tuss_code ?? "10101012",
          procedimentoDescricao: selectedProcedure?.name ?? "",
          valorProcedimento: selectedProcedure?.insurance_price ?? 0,
          valorTotal,
          observacao: observacao || undefined,
          numLote: lotNum,
          dataEnvio: todayStr,
          tissVersion: ver,
        });
      }

      const { error } = await supabase.from("tiss_guides").insert({
        tenant_id: profile.tenant_id,
        insurance_plan_id: planId,
        lot_number: lotNum,
        guide_number: guideNum,
        guide_type: guideType,
        status: "pending",
        xml_content: xml,
        tiss_version: ver,
        total_value: valorTotal,
      });
      if (error) throw error;

      downloadTissXml(xml, `guia_${guideType}_${guideNum}.xml`);
      toast.success(`Guia ${guideNum} gerada com sucesso!`);
      navigate("/faturamento-tiss");
    } catch (err) {
      logger.error(err);
      toast.error("Erro ao gerar guia");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout title="Carregando..." subtitle="">
        <Skeleton className="h-64 w-full" />
      </MainLayout>
    );
  }

  return (
    <MainLayout
      title="Nova Guia TISS"
      subtitle="Gere uma guia eletrônica para faturamento"
      actions={
        <Button variant="outline" onClick={() => navigate("/faturamento-tiss")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      }
    >
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados da Guia</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Tipo de Guia *</Label>
              <Select value={guideType} onValueChange={(v) => setGuideType(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="consulta">Consulta</SelectItem>
                  <SelectItem value="sadt">SP/SADT</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Convênio *</Label>
              <Select value={planId} onValueChange={setPlanId}>
                <SelectTrigger><SelectValue placeholder="Selecione o convênio" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>{p.name} {p.ans_code && `(${p.ans_code})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Paciente *</Label>
              <Select value={patientId} onValueChange={setPatientId}>
                <SelectTrigger><SelectValue placeholder="Selecione o paciente" /></SelectTrigger>
                <SelectContent>
                  {patients.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Procedimento *</Label>
              <Select value={procedureId} onValueChange={setProcedureId}>
                <SelectTrigger><SelectValue placeholder="Selecione o procedimento" /></SelectTrigger>
                <SelectContent>
                  {procedures.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} {s.tuss_code && `(${s.tuss_code})`}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Data do Atendimento</Label>
                <Input type="date" value={dataAtendimento} onChange={(e) => setDataAtendimento(e.target.value)} />
              </div>
              {guideType === "consulta" && (
                <div className="space-y-2">
                  <Label>Hora Inicial</Label>
                  <Input type="time" value={horaInicial} onChange={(e) => setHoraInicial(e.target.value)} />
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Quantidade</Label>
                <Input type="number" min="1" value={quantidade} onChange={(e) => setQuantidade(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>CID (opcional)</Label>
                <Input value={cidCode} onChange={(e) => setCidCode(e.target.value)} placeholder="Ex: J06.9" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Informações Adicionais</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Senha de Autorização</Label>
              <Input value={authorization} onChange={(e) => setAuthorization(e.target.value)} placeholder="Se houver" />
            </div>

            {guideType === "consulta" && (
              <div className="space-y-2">
                <Label>Tipo de Consulta</Label>
                <Select value={tipoConsulta} onValueChange={setTipoConsulta}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">Primeira consulta</SelectItem>
                    <SelectItem value="2">Retorno</SelectItem>
                    <SelectItem value="3">Pré-natal</SelectItem>
                    <SelectItem value="4">Por encaminhamento</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {guideType === "sadt" && (
              <>
                <div className="space-y-2">
                  <Label>Caráter do Atendimento</Label>
                  <Select value={caraterAtendimento} onValueChange={setCaraterAtendimento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="1">Eletivo</SelectItem>
                      <SelectItem value="2">Urgência/Emergência</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Tipo de Atendimento</Label>
                  <Select value={tipoAtendimento} onValueChange={setTipoAtendimento}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="01">Remoção</SelectItem>
                      <SelectItem value="02">Pequena cirurgia</SelectItem>
                      <SelectItem value="03">Terapias</SelectItem>
                      <SelectItem value="04">Consulta</SelectItem>
                      <SelectItem value="05">Exames</SelectItem>
                      <SelectItem value="06">Atendimento domiciliar</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label>Indicação de Acidente</Label>
              <Select value={indicacaoAcidente} onValueChange={setIndicacaoAcidente}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="0">Não</SelectItem>
                  <SelectItem value="1">Trabalho</SelectItem>
                  <SelectItem value="2">Trânsito</SelectItem>
                  <SelectItem value="9">Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Observações</Label>
              <Textarea value={observacao} onChange={(e) => setObservacao(e.target.value)} rows={3} placeholder="Observações adicionais..." />
            </div>

            <div className="rounded-lg bg-muted/50 p-4">
              <p className="text-sm text-muted-foreground mb-1">Valor Total</p>
              <p className="text-2xl font-bold">R$ {valorTotal.toFixed(2)}</p>
            </div>

            <Button onClick={handleGenerate} disabled={isSaving} variant="gradient" className="w-full">
              {isSaving ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Gerando...</> : <><Calculator className="mr-2 h-4 w-4" />Gerar Guia TISS</>}
            </Button>
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
