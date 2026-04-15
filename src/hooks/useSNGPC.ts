// Hook para integração SNGPC
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from "@/integrations/gcp/client";
import { toast } from 'sonner';
import { normalizeError } from "@/utils/errorMessages";
import { logger } from '@/lib/logger';
import { encrypt } from '@/lib/crypto';

export interface SNGPCCredenciais {
  id: string;
  cnpj: string;
  razao_social: string | null;
  cpf_responsavel: string;
  nome_responsavel: string;
  crf_responsavel: string | null;
  email_notificacao: string | null;
  ativo: boolean;
  ultima_autenticacao: string | null;
}

export interface SNGPCTransmissao {
  id: string;
  tipo: 'movimentacao' | 'inventario' | 'retificacao';
  hash_anvisa: string | null;
  protocolo: string | null;
  data_inicio: string;
  data_fim: string;
  status: 'pendente' | 'enviado' | 'validado' | 'erro' | 'rejeitado';
  data_envio: string | null;
  data_validacao: string | null;
  erros: string[] | null;
  avisos: string[] | null;
  total_entradas: number;
  total_saidas_venda: number;
  total_saidas_transferencia: number;
  total_saidas_perda: number;
  total_medicamentos: number;
  enviado_por_nome: string | null;
  created_at: string;
}

export interface SNGPCMovimentacao {
  id: string;
  tipo_movimentacao: string;
  data_movimentacao: string;
  medicamento_nome: string;
  medicamento_codigo: string;
  lista: string;
  lote: string;
  quantidade: number;
  paciente_nome: string | null;
  prescriptor_nome: string | null;
  numero_receita: string | null;
}

export interface SNGPCDashboard {
  total_transmissoes: number;
  total_validados: number;
  total_erros: number;
  total_pendentes: number;
  taxa_sucesso: number;
  ultima_transmissao: string | null;
  total_medicamentos: number;
}

export function useSNGPC() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [credenciais, setCredenciais] = useState<SNGPCCredenciais | null>(null);
  const [transmissoes, setTransmissoes] = useState<SNGPCTransmissao[]>([]);
  const [movimentacoes, setMovimentacoes] = useState<SNGPCMovimentacao[]>([]);
  const [dashboard, setDashboard] = useState<SNGPCDashboard | null>(null);

  // Buscar credenciais
  const fetchCredenciais = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('sngpc_credenciais')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      setCredenciais(data as SNGPCCredenciais | null);
    } catch (err) {
      logger.error('SNGPC fetchCredenciais:', err);
    }
  }, [profile?.tenant_id]);

  // Salvar credenciais
  const saveCredenciais = useCallback(async (dados: Partial<SNGPCCredenciais> & { username?: string; password?: string }) => {
    if (!profile?.tenant_id) return false;
    setIsLoading(true);
    try {
      // Criptografar username e password com AES-256-GCM
      const usernameEnc = dados.username
        ? await encrypt(dados.username, profile.tenant_id)
        : undefined;
      const passwordEnc = dados.password
        ? await encrypt(dados.password, profile.tenant_id)
        : undefined;

      const payload: Record<string, unknown> = {
        tenant_id: profile.tenant_id,
        cnpj: dados.cnpj,
        razao_social: dados.razao_social,
        cpf_responsavel: dados.cpf_responsavel,
        nome_responsavel: dados.nome_responsavel,
        crf_responsavel: dados.crf_responsavel,
        email_notificacao: dados.email_notificacao,
        ativo: true,
      };

      // Só atualiza campos criptografados se novos valores foram fornecidos
      if (usernameEnc) payload.username_encrypted = usernameEnc;
      if (passwordEnc) payload.password_encrypted = passwordEnc;

      if (credenciais?.id) {
        const { error } = await api
          .from('sngpc_credenciais')
          .update(payload)
          .eq('id', credenciais.id);
        if (error) throw error;
      } else {
        const { error } = await api
          .from('sngpc_credenciais')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('Credenciais salvas com sucesso');
      await fetchCredenciais();
      return true;
    } catch (err) {
      logger.error('SNGPC saveCredenciais:', err);
      toast.error('Erro ao salvar credenciais', { description: normalizeError(err, 'Não foi possível salvar as credenciais SNGPC.') });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, credenciais?.id, fetchCredenciais]);

  // Buscar transmissões
  const fetchTransmissoes = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('sngpc_transmissoes')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      setTransmissoes((data || []) as SNGPCTransmissao[]);
    } catch (err) {
      logger.error('SNGPC fetchTransmissoes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  // Buscar movimentações do período
  const fetchMovimentacoes = useCallback(async (dataInicio: string, dataFim: string) => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('sngpc_movimentacoes')
        .select(`
          id,
          tipo_movimentacao,
          data_movimentacao,
          quantidade,
          paciente_nome,
          prescriptor_nome,
          numero_receita,
          sngpc_estoque (
            medicamento_nome,
            medicamento_codigo,
            lista,
            lote
          )
        `)
        .eq('tenant_id', profile.tenant_id)
        .gte('data_movimentacao', `${dataInicio}T00:00:00`)
        .lte('data_movimentacao', `${dataFim}T23:59:59`)
        .order('data_movimentacao', { ascending: false });
      
      if (error) throw error;
      
      const mapped = (data || []).map((m: any) => ({
        id: m.id,
        tipo_movimentacao: m.tipo_movimentacao,
        data_movimentacao: m.data_movimentacao,
        quantidade: m.quantidade,
        paciente_nome: m.paciente_nome,
        prescriptor_nome: m.prescriptor_nome,
        numero_receita: m.numero_receita,
        medicamento_nome: m.sngpc_estoque?.medicamento_nome || '',
        medicamento_codigo: m.sngpc_estoque?.medicamento_codigo || '',
        lista: m.sngpc_estoque?.lista || '',
        lote: m.sngpc_estoque?.lote || '',
      }));
      
      setMovimentacoes(mapped);
      return mapped;
    } catch (err) {
      logger.error('SNGPC fetchMovimentacoes:', err);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  // Calcular dashboard
  const fetchDashboard = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('sngpc_transmissoes')
        .select('status, total_medicamentos, data_envio')
        .eq('tenant_id', profile.tenant_id);
      
      if (error) throw error;
      
      const transmissoes = data || [];
      const validados = transmissoes.filter(t => t.status === 'validado').length;
      const erros = transmissoes.filter(t => t.status === 'erro' || t.status === 'rejeitado').length;
      const pendentes = transmissoes.filter(t => t.status === 'pendente' || t.status === 'enviado').length;
      const totalMeds = transmissoes.reduce((acc, t) => acc + (t.total_medicamentos || 0), 0);
      const ultimaTransmissao = transmissoes
        .filter(t => t.data_envio)
        .sort((a, b) => new Date(b.data_envio!).getTime() - new Date(a.data_envio!).getTime())[0]?.data_envio;

      setDashboard({
        total_transmissoes: transmissoes.length,
        total_validados: validados,
        total_erros: erros,
        total_pendentes: pendentes,
        taxa_sucesso: transmissoes.length > 0 ? (validados / transmissoes.length) * 100 : 0,
        ultima_transmissao: ultimaTransmissao || null,
        total_medicamentos: totalMeds,
      });
    } catch (err) {
      logger.error('SNGPC fetchDashboard:', err);
    }
  }, [profile?.tenant_id]);

  // Criar transmissão
  const criarTransmissao = useCallback(async (
    tipo: 'movimentacao' | 'inventario',
    dataInicio: string,
    dataFim: string,
    xml: string,
    totais: {
      entradas: number;
      saidasVenda: number;
      saidasTransferencia: number;
      saidasPerda: number;
    }
  ) => {
    if (!profile?.tenant_id) return null;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('sngpc_transmissoes')
        .insert({
          tenant_id: profile.tenant_id,
          tipo,
          data_inicio: dataInicio,
          data_fim: dataFim,
          xml_enviado: xml,
          status: 'pendente',
          total_entradas: totais.entradas,
          total_saidas_venda: totais.saidasVenda,
          total_saidas_transferencia: totais.saidasTransferencia,
          total_saidas_perda: totais.saidasPerda,
          total_medicamentos: totais.entradas + totais.saidasVenda + totais.saidasTransferencia + totais.saidasPerda,
          enviado_por: profile.id,
          enviado_por_nome: profile.full_name,
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Transmissão criada com sucesso');
      await fetchTransmissoes();
      return data;
    } catch (err) {
      logger.error('SNGPC criarTransmissao:', err);
      toast.error('Erro ao criar transmissão', { description: normalizeError(err, 'Não foi possível criar a transmissão SNGPC.') });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, profile?.full_name, fetchTransmissoes]);

  // Atualizar status da transmissão
  const atualizarTransmissao = useCallback(async (
    id: string,
    status: 'enviado' | 'validado' | 'erro' | 'rejeitado',
    hash?: string,
    erros?: string[]
  ) => {
    if (!profile?.tenant_id) return false;
    try {
      const updates: any = { status };
      if (hash) updates.hash_anvisa = hash;
      if (erros) updates.erros = erros;
      if (status === 'enviado') updates.data_envio = new Date().toISOString();
      if (status === 'validado') updates.data_validacao = new Date().toISOString();

      const { error } = await api
        .from('sngpc_transmissoes')
        .update(updates)
        .eq('id', id)
        .eq('tenant_id', profile.tenant_id);
      
      if (error) throw error;
      toast.success('Status atualizado');
      await fetchTransmissoes();
      return true;
    } catch (err) {
      logger.error('SNGPC atualizarTransmissao:', err);
      toast.error('Erro ao atualizar status', { description: normalizeError(err, 'Não foi possível atualizar o status da transmissão.') });
      return false;
    }
  }, [profile?.tenant_id, fetchTransmissoes]);

  return {
    isLoading,
    credenciais,
    transmissoes,
    movimentacoes,
    dashboard,
    fetchCredenciais,
    saveCredenciais,
    fetchTransmissoes,
    fetchMovimentacoes,
    fetchDashboard,
    criarTransmissao,
    atualizarTransmissao,
  };
}
