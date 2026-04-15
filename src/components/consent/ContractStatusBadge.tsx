import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { api } from "@/integrations/gcp/client";
import { CheckCircle2, AlertCircle } from "lucide-react";

interface ContractStatusBadgeProps {
  patientId: string;
  tenantId: string;
}

export function ContractStatusBadge({ patientId, tenantId }: ContractStatusBadgeProps) {
  const [status, setStatus] = useState<"loading" | "all-signed" | "pending" | "none">("loading");
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    if (!patientId || !tenantId) return;
    let cancelled = false;

    const load = async () => {
      try {
        const [consentsRes, templatesRes] = await Promise.all([
          (api as any)
            .from("patient_consents")
            .select("template_id")
            .eq("patient_id", patientId),
          (api as any)
            .from("consent_templates")
            .select("id")
            .eq("tenant_id", tenantId)
            .eq("is_active", true)
            .eq("is_required", true),
        ]);

        if (cancelled) return;

        const signedIds = new Set(
          ((consentsRes.data ?? []) as any[]).map((c: any) => c.template_id as string),
        );
        const requiredTemplates = (templatesRes.data ?? []) as any[];

        if (requiredTemplates.length === 0) {
          setStatus("none");
          return;
        }

        const pending = requiredTemplates.filter((t: any) => !signedIds.has(t.id)).length;
        setPendingCount(pending);
        setStatus(pending === 0 ? "all-signed" : "pending");
      } catch {
        if (!cancelled) setStatus("none");
      }
    };

    load();
    return () => { cancelled = true; };
  }, [patientId, tenantId]);

  if (status === "loading" || status === "none") return null;

  if (status === "all-signed") {
    return (
      <Badge variant="outline" className="gap-1 text-[10px] bg-success/10 text-success border-success/20">
        <CheckCircle2 className="h-3 w-3" />
        Termos OK
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="gap-1 text-[10px] bg-warning/10 text-warning border-warning/20">
      <AlertCircle className="h-3 w-3" />
      {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
    </Badge>
  );
}
