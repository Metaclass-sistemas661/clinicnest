import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { AdminProfitCongratulationsDialog, type AdminProfitData } from "@/components/agenda/AdminProfitCongratulationsDialog";

export function AdminProfitRealtimeListener() {
  const { profile, isAdmin } = useAuth();
  const [data, setData] = useState<AdminProfitData | null>(null);
  const [open, setOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    if (!isAdmin || !profile?.tenant_id) return;

    const channel = supabase
      .channel("appointment-completion-summaries")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "appointment_completion_summaries",
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          const row = payload.new as {
            professional_name?: string;
            service_name?: string;
            service_profit?: number;
            product_sales?: { product_name: string; quantity: number; profit: number }[];
            product_profit_total?: number;
            total_profit?: number;
          };
          const productSales = Array.isArray(row.product_sales)
            ? row.product_sales.map((p: { product_name?: string; quantity?: number; profit?: number }) => ({
                product_name: p.product_name ?? "",
                quantity: p.quantity ?? 0,
                profit: p.profit ?? 0,
              }))
            : [];
          setData({
            professionalName: String(row.professional_name ?? ""),
            serviceName: String(row.service_name ?? "Serviço"),
            serviceProfit: Number(row.service_profit ?? 0),
            productSales,
            productProfitTotal: Number(row.product_profit_total ?? 0),
            totalProfit: Number(row.total_profit ?? 0),
          });
          setOpen(true);
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [isAdmin, profile?.tenant_id]);

  return (
    <AdminProfitCongratulationsDialog
      open={open}
      onOpenChange={setOpen}
      data={data}
    />
  );
}
