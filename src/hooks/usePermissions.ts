import { useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import type { ProfessionalType, PermissionAction, ResourcePermission, PermissionsMap } from '@/types/database';

const EMPTY_PERMISSION: ResourcePermission = { view: false, create: false, edit: false, delete: false };
const FULL_PERMISSION: ResourcePermission = { view: true, create: true, edit: true, delete: true };

const CLINICAL_TYPES: ProfessionalType[] = [
  'medico', 'dentista', 'enfermeiro', 'fisioterapeuta',
  'nutricionista', 'psicologo', 'fonoaudiologo',
];

const PRESCRIBER_TYPES: ProfessionalType[] = ['medico', 'dentista'];

export function usePermissions() {
  const { isAdmin, professionalType, permissions } = useAuth();

  const can = useCallback(
    (resource: string, action: PermissionAction = 'view'): boolean => {
      if (isAdmin) return true;
      const perm = permissions[resource];
      if (!perm) return false;
      return !!perm[action];
    },
    [isAdmin, permissions]
  );

  const getResourcePermission = useCallback(
    (resource: string): ResourcePermission => {
      if (isAdmin) return FULL_PERMISSION;
      return permissions[resource] ?? EMPTY_PERMISSION;
    },
    [isAdmin, permissions]
  );

  const isClinical = useMemo(
    () => isAdmin || CLINICAL_TYPES.includes(professionalType),
    [isAdmin, professionalType]
  );

  const isPrescriber = useMemo(
    () => isAdmin || PRESCRIBER_TYPES.includes(professionalType),
    [isAdmin, professionalType]
  );

  const visibleResources = useMemo(() => {
    if (isAdmin) return Object.keys(permissions);
    return Object.entries(permissions)
      .filter(([, perm]) => perm.view)
      .map(([resource]) => resource);
  }, [isAdmin, permissions]);

  return {
    permissions,
    professionalType,
    isAdmin,
    isClinical,
    isPrescriber,
    can,
    getResourcePermission,
    visibleResources,
  };
}
