/**
 * Relatórios Odontológicos — Fase 25H
 * Funções para gerar relatórios específicos de clínicas odontológicas
 */

import { supabase } from "@/integrations/supabase/client";
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, format } from "date-fns";
import { ptBR } from "date-fns/locale";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface RelatorioProdutividadeOdonto {
  periodo: { inicio: string; fim: string };
  profissional?: { id: string; nome: string };
  totais: {
    procedimentos_realizados: number;
    valor_total: number;
    pacientes_atendidos: number;
    planos_criados: number;
    planos_aprovados: number;
    taxa_aprovacao: number;
  };
  por_tipo_procedimento: { nome: string; quantidade: number; valor: number }[];
  por_dente: { dente: number; quantidade: number }[];
  evolucao_mensal: { mes: string; procedimentos: number; valor: number }[];
}

export interface RelatorioPlanosTratamento {
  periodo: { inicio: string; fim: string };
  totais: {
    total_planos: number;
    pendentes: number;
    apresentados: number;
    aprovados: number;
    em_andamento: number;
    concluidos: number;
    cancelados: number;
    valor_total_criado: number;
    valor_total_aprovado: number;
    valor_total_executado: number;
    taxa_conversao: number;
  };
  por_profissional: { nome: string; planos: number; valor_aprovado: number; taxa_conversao: number }[];
  por_status: { status: string; quantidade: number; valor: number }[];
  tempo_medio_aprovacao_dias: number;
}

export interface RelatorioProcedimentosTop {
  periodo: { inicio: string; fim: string };
  top_procedimentos: {
    codigo: string;
    nome: string;
    quantidade: number;
    valor_total: number;
    valor_medio: number;
    percentual: number;
  }[];
  por_categoria: { categoria: string; quantidade: number; valor: number }[];
}

// ─── Relatório de Produtividade ─────────────────────────────────────────────

export async function gerarRelatorioProdutividadeOdonto(
  tenantId: string,
  profissionalId?: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<RelatorioProdutividadeOdonto> {
  const inicio = dataInicio || startOfMonth(new Date());
  const fim = dataFim || endOfMonth(new Date());

  // Buscar itens de planos concluídos
  let query = supabase
    .from("treatment_plan_items")
    .select(`
      id, procedure_name, procedure_code, tooth_number, total_price, status, completed_at,
      treatment_plans!inner(tenant_id, professional_id, patient_id, profiles(name))
    `)
    .eq("treatment_plans.tenant_id", tenantId)
    .eq("status", "concluido")
    .gte("completed_at", inicio.toISOString())
    .lte("completed_at", fim.toISOString());

  if (profissionalId) {
    query = query.eq("treatment_plans.professional_id", profissionalId);
  }

  const { data: items } = await query;

  // Buscar planos criados no período
  let plansQuery = supabase
    .from("treatment_plans")
    .select("id, status, final_value, created_at, approved_at")
    .eq("tenant_id", tenantId)
    .gte("created_at", inicio.toISOString())
    .lte("created_at", fim.toISOString());

  if (profissionalId) {
    plansQuery = plansQuery.eq("professional_id", profissionalId);
  }

  const { data: plans } = await plansQuery;

  // Calcular totais
  const procedimentos = items || [];
  const planosList = plans || [];
  
  const valorTotal = procedimentos.reduce((sum, i) => sum + (i.total_price || 0), 0);
  const pacientesUnicos = new Set(procedimentos.map((i: any) => i.treatment_plans?.patient_id)).size;
  const planosAprovados = planosList.filter((p) => ["aprovado", "em_andamento", "concluido"].includes(p.status)).length;

  // Agrupar por tipo de procedimento
  const porTipo: Record<string, { quantidade: number; valor: number }> = {};
  procedimentos.forEach((i) => {
    const nome = i.procedure_name || "Outros";
    if (!porTipo[nome]) porTipo[nome] = { quantidade: 0, valor: 0 };
    porTipo[nome].quantidade++;
    porTipo[nome].valor += i.total_price || 0;
  });

  // Agrupar por dente
  const porDente: Record<number, number> = {};
  procedimentos.forEach((i) => {
    if (i.tooth_number) {
      porDente[i.tooth_number] = (porDente[i.tooth_number] || 0) + 1;
    }
  });

  // Evolução mensal (últimos 6 meses)
  const evolucao: { mes: string; procedimentos: number; valor: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const mesData = subMonths(new Date(), i);
    const mesInicio = startOfMonth(mesData);
    const mesFim = endOfMonth(mesData);
    
    const procsMes = procedimentos.filter((p) => {
      const data = new Date(p.completed_at);
      return data >= mesInicio && data <= mesFim;
    });

    evolucao.push({
      mes: format(mesData, "MMM/yy", { locale: ptBR }),
      procedimentos: procsMes.length,
      valor: procsMes.reduce((sum, p) => sum + (p.total_price || 0), 0),
    });
  }

  return {
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    totais: {
      procedimentos_realizados: procedimentos.length,
      valor_total: valorTotal,
      pacientes_atendidos: pacientesUnicos,
      planos_criados: planosList.length,
      planos_aprovados: planosAprovados,
      taxa_aprovacao: planosList.length > 0 ? (planosAprovados / planosList.length) * 100 : 0,
    },
    por_tipo_procedimento: Object.entries(porTipo)
      .map(([nome, data]) => ({ nome, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade),
    por_dente: Object.entries(porDente)
      .map(([dente, quantidade]) => ({ dente: parseInt(dente), quantidade }))
      .sort((a, b) => b.quantidade - a.quantidade),
    evolucao_mensal: evolucao,
  };
}

// ─── Relatório de Planos de Tratamento ──────────────────────────────────────

export async function gerarRelatorioPlanosTratamento(
  tenantId: string,
  dataInicio?: Date,
  dataFim?: Date
): Promise<RelatorioPlanosTratamento> {
  const inicio = dataInicio || startOfMonth(new Date());
  const fim = dataFim || endOfMonth(new Date());

  const { data: plans } = await supabase
    .from("treatment_plans")
    .select(`
      id, status, total_value, final_value, created_at, approved_at,
      professional_id, profiles(name),
      treatment_plan_items(id, status, total_price)
    `)
    .eq("tenant_id", tenantId)
    .gte("created_at", inicio.toISOString())
    .lte("created_at", fim.toISOString());

  const planosList = plans || [];

  // Contagem por status
  const statusCount: Record<string, { quantidade: number; valor: number }> = {
    pendente: { quantidade: 0, valor: 0 },
    apresentado: { quantidade: 0, valor: 0 },
    aprovado: { quantidade: 0, valor: 0 },
    em_andamento: { quantidade: 0, valor: 0 },
    concluido: { quantidade: 0, valor: 0 },
    cancelado: { quantidade: 0, valor: 0 },
  };

  planosList.forEach((p) => {
    if (statusCount[p.status]) {
      statusCount[p.status].quantidade++;
      statusCount[p.status].valor += p.final_value || 0;
    }
  });

  // Valor executado (itens concluídos)
  const valorExecutado = planosList.reduce((sum, p) => {
    const itens = (p as any).treatment_plan_items || [];
    return sum + itens.filter((i: any) => i.status === "concluido").reduce((s: number, i: any) => s + (i.total_price || 0), 0);
  }, 0);

  // Por profissional
  const porProf: Record<string, { nome: string; planos: number; aprovados: number; valor: number }> = {};
  planosList.forEach((p: any) => {
    const profId = p.professional_id;
    const profNome = p.profiles?.name || "—";
    if (!porProf[profId]) porProf[profId] = { nome: profNome, planos: 0, aprovados: 0, valor: 0 };
    porProf[profId].planos++;
    if (["aprovado", "em_andamento", "concluido"].includes(p.status)) {
      porProf[profId].aprovados++;
      porProf[profId].valor += p.final_value || 0;
    }
  });

  // Tempo médio de aprovação
  const planosAprovados = planosList.filter((p) => p.approved_at);
  const tempoMedio = planosAprovados.length > 0
    ? planosAprovados.reduce((sum, p) => {
        const criado = new Date(p.created_at);
        const aprovado = new Date(p.approved_at!);
        return sum + (aprovado.getTime() - criado.getTime()) / (1000 * 60 * 60 * 24);
      }, 0) / planosAprovados.length
    : 0;

  const totalAprovados = statusCount.aprovado.quantidade + statusCount.em_andamento.quantidade + statusCount.concluido.quantidade;
  const taxaConversao = planosList.length > 0 ? (totalAprovados / planosList.length) * 100 : 0;

  return {
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    totais: {
      total_planos: planosList.length,
      pendentes: statusCount.pendente.quantidade,
      apresentados: statusCount.apresentado.quantidade,
      aprovados: statusCount.aprovado.quantidade,
      em_andamento: statusCount.em_andamento.quantidade,
      concluidos: statusCount.concluido.quantidade,
      cancelados: statusCount.cancelado.quantidade,
      valor_total_criado: planosList.reduce((sum, p) => sum + (p.final_value || 0), 0),
      valor_total_aprovado: statusCount.aprovado.valor + statusCount.em_andamento.valor + statusCount.concluido.valor,
      valor_total_executado: valorExecutado,
      taxa_conversao: taxaConversao,
    },
    por_profissional: Object.values(porProf).map((p) => ({
      nome: p.nome,
      planos: p.planos,
      valor_aprovado: p.valor,
      taxa_conversao: p.planos > 0 ? (p.aprovados / p.planos) * 100 : 0,
    })).sort((a, b) => b.planos - a.planos),
    por_status: Object.entries(statusCount).map(([status, data]) => ({
      status,
      quantidade: data.quantidade,
      valor: data.valor,
    })),
    tempo_medio_aprovacao_dias: Math.round(tempoMedio * 10) / 10,
  };
}

// ─── Relatório de Procedimentos Mais Realizados ─────────────────────────────

export async function gerarRelatorioTopProcedimentos(
  tenantId: string,
  dataInicio?: Date,
  dataFim?: Date,
  limite: number = 10
): Promise<RelatorioProcedimentosTop> {
  const inicio = dataInicio || startOfMonth(new Date());
  const fim = dataFim || endOfMonth(new Date());

  const { data: items } = await supabase
    .from("treatment_plan_items")
    .select(`
      procedure_code, procedure_name, procedure_category, total_price,
      treatment_plans!inner(tenant_id)
    `)
    .eq("treatment_plans.tenant_id", tenantId)
    .eq("status", "concluido")
    .gte("completed_at", inicio.toISOString())
    .lte("completed_at", fim.toISOString());

  const procedimentos = items || [];
  const totalGeral = procedimentos.reduce((sum, i) => sum + (i.total_price || 0), 0);

  // Agrupar por procedimento
  const porProc: Record<string, { codigo: string; nome: string; quantidade: number; valor: number }> = {};
  procedimentos.forEach((i) => {
    const key = i.procedure_code || i.procedure_name || "outros";
    if (!porProc[key]) {
      porProc[key] = {
        codigo: i.procedure_code || "",
        nome: i.procedure_name || "Outros",
        quantidade: 0,
        valor: 0,
      };
    }
    porProc[key].quantidade++;
    porProc[key].valor += i.total_price || 0;
  });

  // Agrupar por categoria
  const porCat: Record<string, { quantidade: number; valor: number }> = {};
  procedimentos.forEach((i) => {
    const cat = i.procedure_category || "Outros";
    if (!porCat[cat]) porCat[cat] = { quantidade: 0, valor: 0 };
    porCat[cat].quantidade++;
    porCat[cat].valor += i.total_price || 0;
  });

  const topList = Object.values(porProc)
    .sort((a, b) => b.quantidade - a.quantidade)
    .slice(0, limite)
    .map((p) => ({
      ...p,
      valor_total: p.valor,
      valor_medio: p.quantidade > 0 ? p.valor / p.quantidade : 0,
      percentual: totalGeral > 0 ? (p.valor / totalGeral) * 100 : 0,
    }));

  return {
    periodo: { inicio: inicio.toISOString(), fim: fim.toISOString() },
    top_procedimentos: topList,
    por_categoria: Object.entries(porCat)
      .map(([categoria, data]) => ({ categoria, ...data }))
      .sort((a, b) => b.quantidade - a.quantidade),
  };
}

// ─── Labels de Status ───────────────────────────────────────────────────────

export const STATUS_PLANO_LABELS: Record<string, string> = {
  pendente: "Pendente",
  apresentado: "Apresentado",
  aprovado: "Aprovado",
  em_andamento: "Em Andamento",
  concluido: "Concluído",
  cancelado: "Cancelado",
};
