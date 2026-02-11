import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import type { ProductSaleItem } from "@/types/supabase-extensions";
import { AdminProfitCongratulationsDialog, type AdminProfitData } from "@/components/agenda/AdminProfitCongratulationsDialog";

export function AdminProfitRealtimeListener() {
  const { profile, isAdmin } = useAuth();
  const [data, setData] = useState<AdminProfitData | null>(null);
  const [open, setOpen] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const pendingSummariesRef = useRef<AdminProfitData[]>([]);
  const hasCheckedPendingRef = useRef(false);

  const showSummary = (summaryData: AdminProfitData) => {
    setData(summaryData);
    setOpen(true);
  };

  const processPendingSummaries = () => {
    if (pendingSummariesRef.current.length > 0 && !open) {
      const next = pendingSummariesRef.current.shift();
      if (next) {
        showSummary(next);
      }
    }
  };

  // Resetar verificação quando admin sair
  useEffect(() => {
    if (!isAdmin || !profile?.tenant_id) {
      hasCheckedPendingRef.current = false;
      pendingSummariesRef.current = [];
      return;
    }
  }, [isAdmin, profile?.tenant_id]);

  // Buscar summaries pendentes quando admin entra na tela
  useEffect(() => {
    if (!isAdmin || !profile?.tenant_id || hasCheckedPendingRef.current) return;

    const checkPendingSummaries = async () => {
      try {
        // Buscar summaries criados nos últimos 10 minutos
        const tenMinutesAgo = new Date();
        tenMinutesAgo.setMinutes(tenMinutesAgo.getMinutes() - 10);

        const { data: summaries, error } = await supabase
          .from("appointment_completion_summaries")
          .select("*")
          .eq("tenant_id", profile.tenant_id)
          .gte("created_at", tenMinutesAgo.toISOString())
          .order("created_at", { ascending: true })
          .limit(10);

        if (error) {
          logger.error("Erro ao buscar summaries pendentes:", error);
          return;
        }

        if (summaries && summaries.length > 0) {
          const summariesData: AdminProfitData[] = summaries.map((s) => {
            const productSales = Array.isArray(s.product_sales)
              ? (s.product_sales as ProductSaleItem[]).map((p) => ({
                  product_name: p.product_name ?? "",
                  quantity: p.quantity ?? 0,
                  profit: p.profit ?? 0,
                }))
              : [];
            return {
              professionalName: String(s.professional_name ?? ""),
              serviceName: String(s.service_name ?? "Serviço"),
              serviceProfit: Number(s.service_profit ?? 0),
              productSales,
              productProfitTotal: Number(s.product_profit_total ?? 0),
              totalProfit: Number(s.total_profit ?? 0),
            };
          });

          // Adicionar à fila de pendentes
          pendingSummariesRef.current = summariesData;
          // Mostrar o primeiro
          if (summariesData.length > 0) {
            showSummary(summariesData[0]);
            pendingSummariesRef.current = summariesData.slice(1);
          }
        }

        hasCheckedPendingRef.current = true;
      } catch (error) {
        logger.error("Erro ao verificar summaries pendentes:", error);
      }
    };

    checkPendingSummaries();
  }, [isAdmin, profile?.tenant_id]);

  // Processar próximo summary pendente quando o dialog fechar
  useEffect(() => {
    if (!open) {
      // Pequeno delay para garantir que o dialog fechou completamente
      const timer = setTimeout(() => {
        processPendingSummaries();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [open]);

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
          const summaryData: AdminProfitData = {
            professionalName: String(row.professional_name ?? ""),
            serviceName: String(row.service_name ?? "Serviço"),
            serviceProfit: Number(row.service_profit ?? 0),
            productSales,
            productProfitTotal: Number(row.product_profit_total ?? 0),
            totalProfit: Number(row.total_profit ?? 0),
          };

          // Se já há um dialog aberto, adicionar à fila
          if (open) {
            pendingSummariesRef.current.push(summaryData);
          } else {
            showSummary(summaryData);
          }
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [isAdmin, profile?.tenant_id, open]);

  return (
    <AdminProfitCongratulationsDialog
      open={open}
      onOpenChange={setOpen}
      data={data}
    />
  );
}
