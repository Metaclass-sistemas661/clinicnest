/**
 * Centralized semantic color map utilities.
 *
 * Maps domain status values to Tailwind semantic token classes,
 * replacing hardcoded color families (teal-*, amber-*, green-*, red-*, etc.)
 * with the design system tokens (primary, warning, success, destructive, info, accent).
 *
 * Usage: const cls = APPOINTMENT_STATUS_COLORS[status] ?? APPOINTMENT_STATUS_COLORS.default;
 */

/** Appointment status → semantic classes */
export const APPOINTMENT_STATUS_COLORS: Record<string, string> = {
  confirmed: "bg-success/10 text-success border-success/20",
  scheduled: "bg-info/10 text-info border-info/20",
  pending: "bg-warning/10 text-warning border-warning/20",
  completed: "bg-primary/10 text-primary border-primary/20",
  cancelled: "bg-destructive/10 text-destructive border-destructive/20",
  no_show: "bg-destructive/10 text-destructive border-destructive/20",
  in_progress: "bg-accent/10 text-accent border-accent/20",
  waiting: "bg-warning/10 text-warning border-warning/20",
  default: "bg-muted text-muted-foreground border-border",
};

/** Order/comanda status → semantic classes */
export const ORDER_STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  open: "bg-info/10 text-info",
  paid: "bg-success/10 text-success",
  cancelled: "bg-destructive/10 text-destructive",
  refunded: "bg-warning/10 text-warning",
  default: "bg-muted text-muted-foreground",
};

/** Generic priority → semantic classes */
export const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/10 text-destructive border-destructive/20",
  urgent: "bg-destructive/10 text-destructive border-destructive/20",
  medium: "bg-warning/10 text-warning border-warning/20",
  normal: "bg-info/10 text-info border-info/20",
  low: "bg-muted text-muted-foreground border-border",
  default: "bg-muted text-muted-foreground border-border",
};

/** Document type → semantic icon/badge color */
export const DOC_TYPE_COLORS: Record<string, string> = {
  prontuario: "text-primary",
  receita: "text-info",
  atestado: "text-success",
  laudo: "text-warning",
  encaminhamento: "text-chart-4",
};

/** Helper: get color classes with fallback */
export function getStatusColor(
  map: Record<string, string>,
  status: string,
): string {
  return map[status] ?? map.default ?? "bg-muted text-muted-foreground";
}
