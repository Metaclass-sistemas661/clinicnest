// Hook para sistema de relatórios customizáveis
import { useState, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { api } from "@/integrations/gcp/client";
import { toast } from 'sonner';
import { normalizeError } from "@/utils/errorMessages";
import { logger } from '@/lib/logger';

// Tipos
export type ReportFieldType = 'text' | 'number' | 'currency' | 'date' | 'datetime' | 'boolean' | 'percentage' | 'duration';
export type ReportAggregation = 'none' | 'count' | 'sum' | 'avg' | 'min' | 'max' | 'count_distinct';
export type ReportChartType = 'none' | 'line' | 'bar' | 'pie' | 'area' | 'donut' | 'stacked_bar';
export type ReportCategory = 'financeiro' | 'atendimento' | 'clinico' | 'marketing' | 'operacional' | 'custom';
export type ScheduleFrequency = 'daily' | 'weekly' | 'biweekly' | 'monthly';

export interface ReportField {
  name: string;
  label: string;
  type: ReportFieldType;
  source: string;
  aggregation?: ReportAggregation;
  format?: string;
  visible?: boolean;
  width?: number;
}

export interface ReportFilter {
  field: string;
  operator: 'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'in' | 'between';
  value?: any;
  label?: string;
}

export interface ReportGroupBy {
  field: string;
  interval?: 'day' | 'week' | 'month' | 'year';
}

export interface ReportDefinition {
  id: string;
  tenant_id: string | null;
  name: string;
  description: string | null;
  category: ReportCategory;
  is_template: boolean;
  base_table: string;
  fields: ReportField[];
  default_filters: ReportFilter[];
  group_by: ReportGroupBy[];
  chart_type: ReportChartType;
  chart_config: Record<string, any>;
  icon: string | null;
  color: string | null;
  is_active: boolean;
  created_at: string;
}

export interface SavedReport {
  id: string;
  tenant_id: string;
  user_id: string;
  report_definition_id: string;
  name: string;
  custom_filters: ReportFilter[];
  custom_fields: ReportField[] | null;
  custom_group_by: ReportGroupBy[] | null;
  is_favorite: boolean;
  last_run_at: string | null;
  run_count: number;
  created_at: string;
  report_definition?: ReportDefinition;
}

export interface ReportSchedule {
  id: string;
  saved_report_id: string;
  frequency: ScheduleFrequency;
  day_of_week: number | null;
  day_of_month: number | null;
  time_of_day: string;
  email_recipients: string[];
  include_pdf: boolean;
  include_excel: boolean;
  include_csv: boolean;
  is_active: boolean;
  last_sent_at: string | null;
  next_send_at: string | null;
}

export interface ReportExecution {
  id: string;
  report_definition_id: string | null;
  saved_report_id: string | null;
  filters_applied: ReportFilter[];
  row_count: number;
  execution_time_ms: number;
  export_format: string | null;
  status: string;
  executed_at: string;
}

export function useReports() {
  const { profile } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [templates, setTemplates] = useState<ReportDefinition[]>([]);
  const [savedReports, setSavedReports] = useState<SavedReport[]>([]);
  const [executions, setExecutions] = useState<ReportExecution[]>([]);

  // Buscar templates disponíveis
  const fetchTemplates = useCallback(async () => {
    try {
      const { data, error } = await api
        .from('report_definitions')
        .select('*')
        .eq('is_template', true)
        .eq('is_active', true)
        .order('category', { ascending: true });
      
      if (error) throw error;
      setTemplates((data || []) as unknown as ReportDefinition[]);
    } catch (err) {
      logger.error('Reports fetchTemplates:', err);
    }
  }, []);

  // Buscar relatórios salvos do usuário
  const fetchSavedReports = useCallback(async () => {
    if (!profile?.id) return;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('user_saved_reports')
        .select(`
          *,
          report_definition:report_definitions(*)
        `)
        .eq('user_id', profile.id)
        .order('is_favorite', { ascending: false })
        .order('last_run_at', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      setSavedReports((data || []) as unknown as SavedReport[]);
    } catch (err) {
      logger.error('Reports fetchSavedReports:', err);
    } finally {
      setIsLoading(false);
    }
  }, [profile?.id]);

  // Salvar relatório
  const saveReport = useCallback(async (
    reportDefinitionId: string,
    name: string,
    filters: ReportFilter[],
    customFields?: ReportField[],
    customGroupBy?: ReportGroupBy[]
  ) => {
    if (!profile?.tenant_id || !profile?.id) return null;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('user_saved_reports')
        .insert({
          tenant_id: profile.tenant_id,
          user_id: profile.id,
          report_definition_id: reportDefinitionId,
          name,
          custom_filters: filters,
          custom_fields: customFields || null,
          custom_group_by: customGroupBy || null,
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Relatório salvo com sucesso');
      await fetchSavedReports();
      return data;
    } catch (err) {
      logger.error('Reports saveReport:', err);
      toast.error('Erro ao salvar relatório', { description: normalizeError(err, 'Não foi possível salvar o relatório.') });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id, fetchSavedReports]);

  // Alternar favorito
  const toggleFavorite = useCallback(async (savedReportId: string, isFavorite: boolean) => {
    try {
      const { error } = await api
        .from('user_saved_reports')
        .update({ is_favorite: isFavorite })
        .eq('id', savedReportId);
      
      if (error) throw error;
      await fetchSavedReports();
    } catch (err) {
      logger.error('Reports toggleFavorite:', err);
    }
  }, [fetchSavedReports]);

  // Deletar relatório salvo
  const deleteSavedReport = useCallback(async (savedReportId: string) => {
    try {
      const { error } = await api
        .from('user_saved_reports')
        .delete()
        .eq('id', savedReportId);
      
      if (error) throw error;
      toast.success('Relatório removido');
      await fetchSavedReports();
    } catch (err) {
      logger.error('Reports deleteSavedReport:', err);
      toast.error('Erro ao remover relatório', { description: normalizeError(err, 'Não foi possível remover o relatório salvo.') });
    }
  }, [fetchSavedReports]);

  // Registrar execução
  const logExecution = useCallback(async (
    reportDefinitionId: string,
    savedReportId: string | null,
    filters: ReportFilter[],
    rowCount: number,
    executionTimeMs: number,
    exportFormat?: string
  ) => {
    if (!profile?.tenant_id) return;
    try {
      await api.from('report_executions').insert({
        tenant_id: profile.tenant_id,
        report_definition_id: reportDefinitionId,
        saved_report_id: savedReportId,
        filters_applied: filters,
        row_count: rowCount,
        execution_time_ms: executionTimeMs,
        export_format: exportFormat || null,
        executed_by: profile.id,
      });

      // Atualizar contador do relatório salvo
      if (savedReportId) {
        // Primeiro buscar o run_count atual
        const { data: currentReport } = await api
          .from('user_saved_reports')
          .select('run_count')
          .eq('id', savedReportId)
          .single();
        
        await api
          .from('user_saved_reports')
          .update({ 
            last_run_at: new Date().toISOString(),
            run_count: (currentReport?.run_count || 0) + 1
          })
          .eq('id', savedReportId);
      }
    } catch (err) {
      logger.error('Reports logExecution:', err);
    }
  }, [profile?.tenant_id, profile?.id]);

  // Buscar histórico de execuções
  const fetchExecutions = useCallback(async (limit = 50) => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await api
        .from('report_executions')
        .select('*')
        .eq('tenant_id', profile.tenant_id)
        .order('executed_at', { ascending: false })
        .limit(limit);
      
      if (error) throw error;
      setExecutions((data || []) as unknown as ReportExecution[]);
    } catch (err) {
      logger.error('Reports fetchExecutions:', err);
    }
  }, [profile?.tenant_id]);

  // Criar agendamento
  const createSchedule = useCallback(async (
    savedReportId: string,
    frequency: ScheduleFrequency,
    emailRecipients: string[],
    options: {
      dayOfWeek?: number;
      dayOfMonth?: number;
      timeOfDay?: string;
      includePdf?: boolean;
      includeExcel?: boolean;
      includeCsv?: boolean;
    } = {}
  ) => {
    if (!profile?.tenant_id) return null;
    setIsLoading(true);
    try {
      const { data, error } = await api
        .from('report_schedules')
        .insert({
          tenant_id: profile.tenant_id,
          saved_report_id: savedReportId,
          frequency,
          day_of_week: options.dayOfWeek ?? null,
          day_of_month: options.dayOfMonth ?? null,
          time_of_day: options.timeOfDay || '08:00',
          email_recipients: emailRecipients,
          include_pdf: options.includePdf ?? true,
          include_excel: options.includeExcel ?? false,
          include_csv: options.includeCsv ?? false,
          created_by: profile.id,
        })
        .select()
        .single();
      
      if (error) throw error;
      toast.success('Agendamento criado com sucesso');
      return data;
    } catch (err) {
      logger.error('Reports createSchedule:', err);
      toast.error('Erro ao criar agendamento', { description: normalizeError(err, 'Não foi possível criar o agendamento de relatório.') });
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [profile?.tenant_id, profile?.id]);

  return {
    isLoading,
    templates,
    savedReports,
    executions,
    fetchTemplates,
    fetchSavedReports,
    saveReport,
    toggleFavorite,
    deleteSavedReport,
    logExecution,
    fetchExecutions,
    createSchedule,
  };
}
