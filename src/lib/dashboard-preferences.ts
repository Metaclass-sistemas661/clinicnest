export type DashboardSectionKey =
  | "quick_actions"
  | "today"
  | "month"
  | "activity_feed"
  | "insights";

export type DashboardPreferences = {
  version: 1;
  order: DashboardSectionKey[];
  hidden: Partial<Record<DashboardSectionKey, boolean>>;
};

function storageKey(tenantId: string, userId: string) {
  return `beautygest:dashboard_prefs:v1:${tenantId}:${userId}`;
}

export function getDashboardPreferences(tenantId: string | null | undefined, userId: string | null | undefined): DashboardPreferences | null {
  if (!tenantId || !userId) return null;
  try {
    const raw = localStorage.getItem(storageKey(tenantId, userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as DashboardPreferences;
    if (!parsed || parsed.version !== 1) return null;
    if (!Array.isArray(parsed.order)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function setDashboardPreferences(
  tenantId: string | null | undefined,
  userId: string | null | undefined,
  prefs: DashboardPreferences
) {
  if (!tenantId || !userId) return;
  try {
    localStorage.setItem(storageKey(tenantId, userId), JSON.stringify(prefs));
  } catch {
    // ignore
  }
}

export function defaultDashboardPreferences(isAdmin: boolean): DashboardPreferences {
  const order: DashboardSectionKey[] = isAdmin
    ? ["quick_actions", "today", "month", "activity_feed", "insights"]
    : ["quick_actions", "today", "month", "insights"];

  return {
    version: 1,
    order,
    hidden: {},
  };
}

export function normalizeDashboardPreferences(
  prefs: DashboardPreferences,
  available: DashboardSectionKey[]
): DashboardPreferences {
  const dedup = (arr: DashboardSectionKey[]) => Array.from(new Set(arr));

  const nextOrder = dedup([
    ...prefs.order.filter((k) => available.includes(k)),
    ...available.filter((k) => !prefs.order.includes(k)),
  ]);

  const nextHidden: DashboardPreferences["hidden"] = {};
  for (const k of available) {
    if (prefs.hidden?.[k]) nextHidden[k] = true;
  }

  return {
    version: 1,
    order: nextOrder,
    hidden: nextHidden,
  };
}
