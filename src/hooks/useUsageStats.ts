import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { LimitKey } from '@/types/subscription-plans';

export interface UsageStats {
  professionals: number;
  patients: number;
  appointmentsThisMonth: number;
  teleconsultasThisMonth: number;
  smsThisMonth: number;
  storageUsedGb: number;
  automations: number;
  webhooks: number;
  units: number;
  customReports: number;
}

const defaultStats: UsageStats = {
  professionals: 0,
  patients: 0,
  appointmentsThisMonth: 0,
  teleconsultasThisMonth: 0,
  smsThisMonth: 0,
  storageUsedGb: 0,
  automations: 0,
  webhooks: 0,
  units: 1,
  customReports: 0,
};

export function useUsageStats() {
  const { tenant } = useAuth();
  const tenantId = tenant?.id;

  return useQuery({
    queryKey: ['usage-stats', tenantId],
    queryFn: async (): Promise<UsageStats> => {
      if (!tenantId) return defaultStats;

      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

      const [
        professionalsResult,
        patientsResult,
        appointmentsResult,
        teleconsultasResult,
        automationsResult,
        customReportsResult,
      ] = await Promise.all([
        supabase
          .from('profiles')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from("patients")
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .gte('scheduled_at', startOfMonth)
          .lte('scheduled_at', endOfMonth),
        supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('telemedicine', true)
          .gte('scheduled_at', startOfMonth)
          .lte('scheduled_at', endOfMonth),
        supabase
          .from('automations')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId)
          .eq('is_active', true),
        supabase
          .from('custom_reports')
          .select('id', { count: 'exact', head: true })
          .eq('tenant_id', tenantId),
      ]);

      return {
        professionals: professionalsResult.count ?? 0,
        patients: patientsResult.count ?? 0,
        appointmentsThisMonth: appointmentsResult.count ?? 0,
        teleconsultasThisMonth: teleconsultasResult.count ?? 0,
        smsThisMonth: 0,
        storageUsedGb: 0,
        automations: automationsResult.count ?? 0,
        webhooks: 0,
        units: 1,
        customReports: customReportsResult.count ?? 0,
      };
    },
    enabled: !!tenantId,
    staleTime: 5 * 60 * 1000,
    refetchOnWindowFocus: false,
  });
}

export function useLimitCheck(limitKey: LimitKey) {
  const { data: stats, isLoading } = useUsageStats();

  const getCurrentValue = (): number => {
    if (!stats) return 0;

    switch (limitKey) {
      case 'professionals':
        return stats.professionals;
      case 'patients':
        return stats.patients;
      case 'appointmentsPerMonth':
        return stats.appointmentsThisMonth;
      case 'teleconsultasPerMonth':
        return stats.teleconsultasThisMonth;
      case 'smsPerMonth':
        return stats.smsThisMonth;
      case 'storageGb':
        return stats.storageUsedGb;
      case 'automations':
        return stats.automations;
      case 'webhooks':
        return stats.webhooks;
      case 'units':
        return stats.units;
      case 'customReports':
        return stats.customReports;
      default:
        return 0;
    }
  };

  return {
    currentValue: getCurrentValue(),
    isLoading,
    stats,
  };
}
