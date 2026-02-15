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
  const openRef = useRef(false);
  const shownSummaryKeysRef = useRef<Set<string>>(new Set());

  const getStorageKey = () => {
    const tenantId = profile?.tenant_id ?? "";
    return `admin_profit_shown:${tenantId}`;
  };

  const buildSummaryKey = (summaryData: AdminProfitData) => {
    if (summaryData.summaryId) return `s:${summaryData.summaryId}`;
    if (summaryData.appointmentId) return `a:${summaryData.appointmentId}`;
    return null;
  };

  const loadShownFromStorage = () => {
    try {
      const raw = sessionStorage.getItem(getStorageKey());
      if (!raw) return;
      const arr = JSON.parse(raw);
      if (!Array.isArray(arr)) return;
      shownSummaryKeysRef.current = new Set(arr.filter((x) => typeof x === "string"));
    } catch {
      // ignore
    }
  };

  const persistShownToStorage = () => {
    try {
      const arr = Array.from(shownSummaryKeysRef.current).slice(-80);
      sessionStorage.setItem(getStorageKey(), JSON.stringify(arr));
    } catch {
      // ignore
    }
  };

  const markShown = (summaryData: AdminProfitData) => {
    const key = buildSummaryKey(summaryData);
    if (!key) return;
    shownSummaryKeysRef.current.add(key);
    persistShownToStorage();
  };

  const wasShown = (summaryData: AdminProfitData) => {
    const key = buildSummaryKey(summaryData);
    if (!key) return false;
    return shownSummaryKeysRef.current.has(key);
  };

  const showSummary = (summaryData: AdminProfitData) => {
    if (wasShown(summaryData)) return;
    markShown(summaryData);
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
      shownSummaryKeysRef.current = new Set();
      return;
    }

    loadShownFromStorage();
  }, [isAdmin, profile?.tenant_id]);

  useEffect(() => {
    openRef.current = open;
  }, [open]);

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
              summaryId: String(s.id ?? ""),
              appointmentId: s.appointment_id ? String(s.appointment_id) : undefined,
              professionalName: String(s.professional_name ?? ""),
              serviceName: String(s.service_name ?? "Serviço"),
              serviceProfit: Number(s.service_profit ?? 0),
              productSales,
              productProfitTotal: Number(s.product_profit_total ?? 0),
              totalProfit: Number(s.total_profit ?? 0),
            };
          });

          const filtered = summariesData.filter((s) => !wasShown(s));

          // Adicionar à fila de pendentes
          pendingSummariesRef.current = filtered;
          // Mostrar o primeiro
          if (filtered.length > 0) {
            showSummary(filtered[0]);
            pendingSummariesRef.current = filtered.slice(1);
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
            id?: string;
            appointment_id?: string | null;
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
            summaryId: row.id ? String(row.id) : undefined,
            appointmentId: row.appointment_id ? String(row.appointment_id) : undefined,
            professionalName: String(row.professional_name ?? ""),
            serviceName: String(row.service_name ?? "Serviço"),
            serviceProfit: Number(row.service_profit ?? 0),
            productSales,
            productProfitTotal: Number(row.product_profit_total ?? 0),
            totalProfit: Number(row.total_profit ?? 0),
          };

          if (wasShown(summaryData)) return;

          // Se já há um dialog aberto, adicionar à fila
          if (openRef.current) {
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
  }, [isAdmin, profile?.tenant_id]);

  return (
    <AdminProfitCongratulationsDialog
      open={open}
      onOpenChange={setOpen}
      data={data}
    />
  );
}
