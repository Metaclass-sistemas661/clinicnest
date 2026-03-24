import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { normalizeError } from "@/utils/errorMessages";
import { logger } from '@/lib/logger';
import {
  MODULE_DEFINITIONS,
  CLINIC_TYPE_PRESETS,
  type ClinicType,
} from '@/types/clinic-type-presets';
import type { FeatureKey } from '@/types/subscription-plans';

/**
 * Hook that manages the tenant's enabled modules and clinic type.
 *
 * - `enabledModules`: array of module keys currently active. `null` means "all modules".
 * - `clinicType`: the clinic_type stored in the tenant row.
 * - `isModuleEnabled(key)`: returns true if a specific module is enabled.
 * - `isFeatureEnabledByModule(feature)`: returns true if the FeatureKey belongs to an active module.
 * - `toggleModule(key)`: adds/removes a module and persists.
 * - `applyPreset(clinicType)`: overrides enabled modules with the preset for that clinic type.
 */
export function useEnabledModules() {
  const { tenant, isAdmin, refreshProfile } = useAuth();

  const [enabledModules, setEnabledModules] = useState<string[] | null>(null);
  const [clinicType, setClinicType] = useState<string>('clinica_geral');
  const [isSaving, setIsSaving] = useState(false);

  // Load from tenant
  useEffect(() => {
    if (!tenant) return;
    setClinicType((tenant as any).clinic_type ?? 'clinica_geral');

    const raw = (tenant as any).enabled_modules;
    if (Array.isArray(raw)) {
      setEnabledModules(raw);
    } else {
      // null = all modules enabled
      setEnabledModules(null);
    }
  }, [tenant]);

  const allModuleKeys = MODULE_DEFINITIONS.map(m => m.key);

  /** Effective list — null means all modules are active */
  const effectiveModules: string[] = enabledModules ?? allModuleKeys;

  const isModuleEnabled = useCallback(
    (key: string) => {
      if (enabledModules === null) return true; // all enabled by default
      return enabledModules.includes(key);
    },
    [enabledModules],
  );

  const isFeatureEnabledByModule = useCallback(
    (feature: FeatureKey) => {
      if (enabledModules === null) return true; // no filtering
      for (const mod of MODULE_DEFINITIONS) {
        if (enabledModules.includes(mod.key) && mod.features.includes(feature)) {
          return true;
        }
      }
      return false;
    },
    [enabledModules],
  );

  // Persist to Supabase
  const persist = useCallback(
    async (modules: string[] | null, newClinicType?: string) => {
      if (!tenant?.id || !isAdmin) return;
      setIsSaving(true);
      try {
        const update: Record<string, unknown> = { enabled_modules: modules };
        if (newClinicType !== undefined) {
          update.clinic_type = newClinicType;
        }
        const { error } = await supabase
          .from('tenants')
          .update(update as any)
          .eq('id', tenant.id);
        if (error) throw error;

        await refreshProfile();
      } catch (err) {
        logger.error('useEnabledModules.persist', err);
        toast.error('Erro ao salvar módulos', { description: normalizeError(err, 'Não foi possível salvar os módulos habilitados.') });
      } finally {
        setIsSaving(false);
      }
    },
    [tenant?.id, isAdmin, refreshProfile],
  );

  const toggleModule = useCallback(
    async (key: string) => {
      const current = enabledModules ?? [...allModuleKeys];
      const next = current.includes(key)
        ? current.filter(k => k !== key)
        : [...current, key];

      setEnabledModules(next);
      await persist(next);
    },
    [enabledModules, allModuleKeys, persist],
  );

  const applyPreset = useCallback(
    async (type: ClinicType) => {
      const preset = CLINIC_TYPE_PRESETS[type] ?? CLINIC_TYPE_PRESETS.clinica_geral;
      setClinicType(type);
      setEnabledModules([...preset]);
      await persist([...preset], type);
      toast.success('Preset aplicado com sucesso');
    },
    [persist],
  );

  const saveClinicType = useCallback(
    async (type: string) => {
      if (!tenant?.id || !isAdmin) return;
      setClinicType(type);
      setIsSaving(true);
      try {
        const { error } = await supabase
          .from('tenants')
          .update({ clinic_type: type } as any)
          .eq('id', tenant.id);
        if (error) throw error;
        await refreshProfile();
      } catch (err) {
        logger.error('useEnabledModules.saveClinicType', err);
        toast.error('Erro ao salvar tipo de clínica', { description: normalizeError(err, 'Não foi possível salvar o tipo de clínica.') });
      } finally {
        setIsSaving(false);
      }
    },
    [tenant?.id, isAdmin, refreshProfile],
  );

  return {
    clinicType,
    enabledModules: effectiveModules,
    rawEnabledModules: enabledModules,
    isModuleEnabled,
    isFeatureEnabledByModule,
    toggleModule,
    applyPreset,
    saveClinicType,
    isSaving,
  };
}
