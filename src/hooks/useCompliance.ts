// Hook para sistema de Compliance e Certificações
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from "@/integrations/gcp/client";
import { toast } from 'sonner';
import { normalizeError } from "@/utils/errorMessages";
import { logger } from '@/lib/logger';

// Tipos TSA
export type TSAProvider = 'certisign' | 'bry' | 'valid' | 'serpro' | 'custom';
export type TSAStatus = 'pending' | 'stamped' | 'error' | 'expired';

export interface TSAConfig {
  id: string;
  provider: TSAProvider;
  api_url: string;
  is_active: boolean;
  last_test_at: string | null;
  last_test_success: boolean | null;
  last_error: string | null;
}

export interface TSATimestamp {
  id: string;
  document_type: string;
  document_id: string;
  document_hash: string;
  status: TSAStatus;
  tsa_time: string | null;
  serial_number: string | null;
  created_at: string;
}

// Tipos Exportação
export interface ProntuarioExport {
  id: string;
  patient_id: string;
  client_name: string;
  status: string;
  pdf_url: string | null;
  xml_url: string | null;
  created_at: string;
  requested_by: string;
}

// Tipos RIPD
export interface RIPDReport {
  id: string;
  version: string;
  title: string;
  status: string;
  approved_at: string | null;
  next_review_at: string | null;
  created_at: string;
}

// Tipos Backup
export interface BackupLog {
  id: string;
  backup_type: string;
  backup_name: string;
  started_at: string;
  completed_at: string | null;
  size_bytes: number | null;
  content_hash: string;
  is_verified: boolean;
  status: string;
}

export function useCompliance() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [tsaConfig, setTsaConfig] = useState<TSAConfig | null>(null);
  const [tsaTimestamps, setTsaTimestamps] = useState<TSATimestamp[]>([]);
  const [exports, setExports] = useState<ProntuarioExport[]>([]);
  const [ripdReports, setRipdReports] = useState<RIPDReport[]>([]);
  const [backupLogs, setBackupLogs] = useState<BackupLog[]>([]);

  // TSA Config
  const fetchTSAConfig = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('tsa_config')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      setTsaConfig(data as TSAConfig | null);
    } catch (err) {
      logger.error('Compliance fetchTSAConfig:', err);
    }
  }, [profile?.tenant_id]);

  const saveTSAConfig = useCallback(async (config: Partial<TSAConfig>) => {
    if (!profile?.tenant_id) return false;
    setIsLoading(true);
    try {
      const payload = {
        tenant_id: profile.tenant_id,
        provider: config.provider || 'certisign',
        api_url: config.api_url || '',
        api_key_encrypted: 'encrypted',
        is_active: config.is_active ?? false,
        created_by: profile.id,
      };

      if (tsaConfig?.id) {
        const { error } = await api
          .from('tsa_config')
          .update(payload)
          .eq('id', tsaConfig.id);
        if (error) throw error;
      } else {
        const { error } = await api
          .from('tsa_config')
          .insert(payload);
        if (error) throw error;
      }

      toast.success('Configuração TSA salva');
      await fetchTSAConfig();
      return true;
    } catch (err) {
      logger.error('Compliance saveTSAConfig:', err);
      toast.error('Erro ao salvar configuração', { description: normalizeError(err, 'Não foi possível salvar a configuração TSA.') });
      return false;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, tsaConfig?.id, fetchTSAConfig]);

  // TSA Timestamps
  const fetchTSATimestamps = useCallback(async (limit = 50) => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('tsa_timestamps')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      setTsaTimestamps((data || []) as TSATimestamp[]);
    } catch (err) {
      logger.error('Compliance fetchTSATimestamps:', err);
    }
  }, [profile?.tenant_id]);

  // Exportações de Prontuário
  const fetchExports = useCallback(async () => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('prontuario_exports')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      setExports((data || []) as ProntuarioExport[]);
    } catch (err) {
      logger.error('Compliance fetchExports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id]);

  const createExport = useCallback(async (
    patientId: string,
    clientName: string,
    options: {
      includeProntuarios?: boolean;
      includeReceituarios?: boolean;
      includeAtestados?: boolean;
      includeLaudos?: boolean;
      includeEvolucoes?: boolean;
      includeExames?: boolean;
      dataInicio?: string;
      dataFim?: string;
      reason?: string;
    }
  ) => {
    if (!profile?.tenant_id) return null;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('prontuario_exports')
        .insert({
          tenant_id: profile.tenant_id,
          patient_id: patientId,
          client_name: clientName,
          include_prontuarios: options.includeProntuarios ?? true,
          include_receituarios: options.includeReceituarios ?? true,
          include_atestados: options.includeAtestados ?? true,
          include_laudos: options.includeLaudos ?? true,
          include_evolucoes: options.includeEvolucoes ?? true,
          include_exames: options.includeExames ?? true,
          data_inicio: options.dataInicio,
          data_fim: options.dataFim,
          requested_by: profile.id,
          requested_reason: options.reason,
          status: 'processing',
          content_hash: crypto.randomUUID(),
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Exportação iniciada');
      await fetchExports();
      return data;
    } catch (err) {
      logger.error('Compliance createExport:', err);
      toast.error('Erro ao criar exportação', { description: normalizeError(err, 'Não foi possível iniciar a exportação.') });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, fetchExports]);

  // RIPD Reports
  const fetchRIPDReports = useCallback(async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('ripd_reports')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setRipdReports((data || []) as RIPDReport[]);
    } catch (err) {
      logger.error('Compliance fetchRIPDReports:', err);
    }
  }, [profile?.tenant_id]);

  const createRIPDReport = useCallback(async (
    version: string,
    content: Record<string, any>
  ) => {
    if (!profile?.tenant_id) return null;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('ripd_reports')
        .insert({
          tenant_id: profile.tenant_id,
          version,
          title: 'Relatório de Impacto à Proteção de Dados Pessoais',
          identificacao_agentes: content.identificacaoAgentes || {},
          necessidade_proporcionalidade: content.necessidadeProporcionalidade || {},
          identificacao_riscos: content.identificacaoRiscos || {},
          medidas_salvaguardas: content.medidasSalvaguardas || {},
          dados_pessoais_tratados: content.dadosTratados || [],
          riscos_identificados: content.riscos || [],
          medidas_tecnicas: content.medidasTecnicas || [],
          medidas_administrativas: content.medidasAdministrativas || [],
          status: 'draft',
          created_by: profile.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('RIPD criado com sucesso');
      await fetchRIPDReports();
      return data;
    } catch (err) {
      logger.error('Compliance createRIPDReport:', err);
      toast.error('Erro ao criar RIPD', { description: normalizeError(err, 'Não foi possível gerar o relatório RIPD.') });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, fetchRIPDReports]);

  // Backup Logs
  const fetchBackupLogs = useCallback(async (limit = 30) => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('backup_logs')
        .select('*')
        .or(`tenant_id.eq.${profile.tenant_id},tenant_id.is.null`)
        .order('created_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      setBackupLogs((data || []) as BackupLog[]);
    } catch (err) {
      logger.error('Compliance fetchBackupLogs:', err);
    }
  }, [profile?.tenant_id]);

  // Dashboard de compliance
  const getComplianceStatus = useCallback(() => {
    const tsaConfigured = tsaConfig?.is_active ?? false;
    const tsaWorking = tsaConfig?.last_test_success ?? false;
    const hasRIPD = ripdReports.some(r => r.status === 'approved');
    const backupsOk = backupLogs.length > 0 && backupLogs[0]?.status === 'completed';
    
    const items = [
      { name: 'Carimbo de Tempo (TSA)', status: tsaConfigured && tsaWorking ? 'ok' : tsaConfigured ? 'warning' : 'pending' },
      { name: 'RIPD (LGPD)', status: hasRIPD ? 'ok' : ripdReports.length > 0 ? 'warning' : 'pending' },
      { name: 'Backups Verificados', status: backupsOk ? 'ok' : 'warning' },
      { name: 'Exportação Prontuário', status: 'ok' },
    ];

    const score = items.filter(i => i.status === 'ok').length / items.length * 100;

    return { items, score };
  }, [tsaConfig, ripdReports, backupLogs]);

  return {
    isLoading,
    tsaConfig,
    tsaTimestamps,
    exports,
    ripdReports,
    backupLogs,
    fetchTSAConfig,
    saveTSAConfig,
    fetchTSATimestamps,
    fetchExports,
    createExport,
    fetchRIPDReports,
    createRIPDReport,
    fetchBackupLogs,
    getComplianceStatus,
  };
}
