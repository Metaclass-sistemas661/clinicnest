import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Star, TrendingUp, TrendingDown, Minus, MessageCircle, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface RatingSummary {
  total_ratings: number;
  avg_rating: number;
  rating_1: number;
  rating_2: number;
  rating_3: number;
  rating_4: number;
  rating_5: number;
}

interface RecentRating {
  id: string;
  rating: number;
  comment: string | null;
  created_at: string;
  patient_name: string;
  service_name: string;
  professional_name: string;
}

interface ProfessionalRating {
  professional_name: string;
  avg_rating: number;
  total_ratings: number;
}

interface TabSatisfacaoProps {
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  isLoading?: boolean;
}

const RATING_COLORS = ["#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];
const RATING_LABELS = ["1 ★", "2 ★", "3 ★", "4 ★", "5 ★"];

export function TabSatisfacao({ tenantId, periodStart, periodEnd }: TabSatisfacaoProps) {
  const [summary, setSummary] = useState<RatingSummary | null>(null);
  const [recent, setRecent] = useState<RecentRating[]>([]);
  const [byProfessional, setByProfessional] = useState<ProfessionalRating[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!tenantId) return;
    void fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tenantId, periodStart, periodEnd]);

  const fetchData = async () => {
    setIsLoading(true);
    try {
      // Fetch summary stats
      const { data: ratingsData, error: ratingsError } = await supabase
        .from("appointment_ratings")
        .select("rating")
        .eq("tenant_id", tenantId)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd);

      if (ratingsError) throw ratingsError;

      const ratings = (ratingsData ?? []) as { rating: number }[];
      const total = ratings.length;
      const avg = total > 0 ? ratings.reduce((s, r) => s + r.rating, 0) / total : 0;
      const dist = [0, 0, 0, 0, 0];
      for (const r of ratings) {
        if (r.rating >= 1 && r.rating <= 5) dist[r.rating - 1]++;
      }

      setSummary({
        total_ratings: total,
        avg_rating: Math.round(avg * 10) / 10,
        rating_1: dist[0],
        rating_2: dist[1],
        rating_3: dist[2],
        rating_4: dist[3],
        rating_5: dist[4],
      });

      // Fetch recent ratings with details
      const { data: recentData, error: recentError } = await supabase
        .from("appointment_ratings")
        .select(`
          id,
          rating,
          comment,
          created_at,
          appointments!inner(
            client_id,
            service_id,
            professional_id,
            clients(full_name),
            services(name),
            profiles!appointments_professional_id_fkey(full_name)
          )
        `)
        .eq("tenant_id", tenantId)
        .gte("created_at", periodStart)
        .lte("created_at", periodEnd)
        .order("created_at", { ascending: false })
        .limit(20);

      if (!recentError && recentData) {
        setRecent(
          (recentData as any[]).map((r) => ({
            id: r.id,
            rating: r.rating,
            comment: r.comment,
            created_at: r.created_at,
            patient_name: r.appointments?.clients?.full_name ?? "—",
            service_name: r.appointments?.services?.name ?? "—",
            professional_name: r.appointments?.profiles?.full_name ?? "—",
          }))
        );
      }

      // Aggregate by professional
      const profMap = new Map<string, { sum: number; count: number; name: string }>();
      for (const r of (recentData ?? []) as any[]) {
        const name = r.appointments?.profiles?.full_name ?? "Sem profissional";
        const cur = profMap.get(name) ?? { sum: 0, count: 0, name };
        cur.sum += r.rating;
        cur.count += 1;
        profMap.set(name, cur);
      }
      // If we have more data from the full ratings, do full aggregation
      if (ratings.length > 0 && ratings.length > 20) {
        // For full professional aggregation, do a separate query
        const { data: profData } = await supabase
          .from("appointment_ratings")
          .select(`
            rating,
            appointments!inner(
              professional_id,
              profiles!appointments_professional_id_fkey(full_name)
            )
          `)
          .eq("tenant_id", tenantId)
          .gte("created_at", periodStart)
          .lte("created_at", periodEnd);

        if (profData) {
          profMap.clear();
          for (const r of profData as any[]) {
            const name = r.appointments?.profiles?.full_name ?? "Sem profissional";
            const cur = profMap.get(name) ?? { sum: 0, count: 0, name };
            cur.sum += r.rating;
            cur.count += 1;
            profMap.set(name, cur);
          }
        }
      }

      setByProfessional(
        Array.from(profMap.values())
          .map((p) => ({
            professional_name: p.name,
            avg_rating: Math.round((p.sum / p.count) * 10) / 10,
            total_ratings: p.count,
          }))
          .sort((a, b) => b.avg_rating - a.avg_rating)
      );
    } catch (err) {
      logger.error("TabSatisfacao fetchData:", err);
    } finally {
      setIsLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardContent className="py-6">
              <Skeleton className="h-8 w-24 mb-2" />
              <Skeleton className="h-4 w-40" />
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!summary || summary.total_ratings === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <Star className="h-12 w-12 mx-auto text-muted-foreground/30 mb-4" />
          <h3 className="text-lg font-semibold mb-1">Nenhuma avaliação no período</h3>
          <p className="text-sm text-muted-foreground">
            Quando pacientes avaliarem o atendimento, os dados aparecerão aqui.
          </p>
        </CardContent>
      </Card>
    );
  }

  const distributionData = [
    { name: "1 ★", value: summary.rating_1, fill: RATING_COLORS[0] },
    { name: "2 ★", value: summary.rating_2, fill: RATING_COLORS[1] },
    { name: "3 ★", value: summary.rating_3, fill: RATING_COLORS[2] },
    { name: "4 ★", value: summary.rating_4, fill: RATING_COLORS[3] },
    { name: "5 ★", value: summary.rating_5, fill: RATING_COLORS[4] },
  ];

  const nps = summary.total_ratings > 0
    ? Math.round(
        ((summary.rating_5 + summary.rating_4 - summary.rating_1 - summary.rating_2) /
          summary.total_ratings) *
          100
      )
    : 0;

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Nota Média</p>
                <p className="text-3xl font-bold flex items-center gap-1">
                  {summary.avg_rating}
                  <Star className="h-5 w-5 fill-yellow-400 text-yellow-400" />
                </p>
              </div>
              {summary.avg_rating >= 4 ? (
                <TrendingUp className="h-8 w-8 text-green-500" />
              ) : summary.avg_rating >= 3 ? (
                <Minus className="h-8 w-8 text-yellow-500" />
              ) : (
                <TrendingDown className="h-8 w-8 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Total de Avaliações</p>
              <p className="text-3xl font-bold flex items-center gap-2">
                {summary.total_ratings}
                <Users className="h-5 w-5 text-muted-foreground" />
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">NPS Estimado</p>
              <p className="text-3xl font-bold">
                <span className={nps >= 50 ? "text-green-600" : nps >= 0 ? "text-yellow-600" : "text-red-600"}>
                  {nps}
                </span>
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {nps >= 75 ? "Excelente" : nps >= 50 ? "Bom" : nps >= 0 ? "Regular" : "Crítico"}
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div>
              <p className="text-sm text-muted-foreground">Com Comentário</p>
              <p className="text-3xl font-bold flex items-center gap-2">
                {recent.filter((r) => r.comment).length}
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Distribution Chart + By Professional */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuição de Notas</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={distributionData} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={40} />
                <Tooltip />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {distributionData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Por Profissional</CardTitle>
          </CardHeader>
          <CardContent>
            {byProfessional.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Sem dados</p>
            ) : (
              <div className="space-y-3">
                {byProfessional.map((prof) => (
                  <div key={prof.professional_name} className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{prof.professional_name}</p>
                      <p className="text-xs text-muted-foreground">{prof.total_ratings} avaliações</p>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold">{prof.avg_rating}</span>
                      <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Recent comments */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Avaliações Recentes</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {recent.slice(0, 10).map((r) => (
              <div key={r.id} className="flex gap-3 border-b pb-3 last:border-b-0">
                <div className="flex-shrink-0">
                  <Badge
                    variant={r.rating >= 4 ? "default" : r.rating >= 3 ? "secondary" : "destructive"}
                    className="gap-0.5"
                  >
                    {r.rating} <Star className="h-3 w-3" />
                  </Badge>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{r.patient_name}</span>
                    <span className="text-muted-foreground">·</span>
                    <span className="text-muted-foreground text-xs">
                      {format(parseISO(r.created_at), "dd/MM/yyyy", { locale: ptBR })}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {r.service_name} — {r.professional_name}
                  </p>
                  {r.comment && (
                    <p className="text-sm mt-1 text-foreground bg-muted/50 rounded-lg px-3 py-2">
                      "{r.comment}"
                    </p>
                  )}
                </div>
              </div>
            ))}
            {recent.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Nenhuma avaliação com comentário no período.
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
