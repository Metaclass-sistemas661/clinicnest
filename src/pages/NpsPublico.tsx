import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { logger } from "@/lib/logger";

type PublicNps = {
  found: boolean;
  tenant_id?: string;
  tenant_name?: string;
  responded_at?: string | null;
  score?: number | null;
  comment?: string | null;
};

function scoreColor(score: number): string {
  if (score <= 3) return "bg-red-500 hover:bg-red-600 text-white";
  if (score <= 6) return "bg-yellow-500 hover:bg-yellow-600 text-black";
  return "bg-green-600 hover:bg-green-700 text-white";
}

export default function NpsPublico() {
  const { token } = useParams();
  const [isLoading, setIsLoading] = useState(true);
  const [data, setData] = useState<PublicNps | null>(null);
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDone, setIsDone] = useState(false);

  const tenantName = data?.tenant_name || "ClinicNest";

  const canSubmit = useMemo(() => selectedScore != null && selectedScore >= 0 && selectedScore <= 10, [selectedScore]);

  useEffect(() => {
    if (!token) {
      setIsLoading(false);
      setData({ found: false });
      return;
    }
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const load = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase.rpc("get_nps_public_v1", { p_token: token });
      if (error) throw error;
      const payload = (data as any) as PublicNps;
      setData(payload);
      if (!payload?.found) return;
      if (payload.responded_at) {
        setIsDone(true);
      }
      if (typeof payload.score === "number") setSelectedScore(payload.score);
      if (typeof payload.comment === "string") setComment(payload.comment);
    } catch (err) {
      logger.error("[NpsPublico] load error", err);
      toast.error("Erro ao carregar NPS");
      setData({ found: false });
    } finally {
      setIsLoading(false);
    }
  };

  const submit = async () => {
    if (!token) return;
    if (!canSubmit) {
      toast.error("Selecione uma nota");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await supabase.rpc("submit_nps_public_v1", {
        p_token: token,
        p_score: selectedScore,
        p_comment: comment,
      });
      if (error) throw error;

      if (data?.already_responded) {
        setIsDone(true);
        return;
      }

      setIsDone(true);
    } catch (err) {
      logger.error("[NpsPublico] submit error", err);
      toast.error("Erro ao enviar resposta");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-4">
      <div className="w-full max-w-xl space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Como foi seu atendimento em {tenantName}?</CardTitle>
            <CardDescription>
              De 0 a 10, o quanto você recomendaria a clínica para um amigo?
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando...
              </div>
            ) : !data?.found ? (
              <div className="text-sm text-muted-foreground">Link inválido ou expirado.</div>
            ) : isDone ? (
              <div className="space-y-2">
                <div className="text-base font-semibold">Obrigado pelo feedback!</div>
                <div className="text-sm text-muted-foreground">Sua resposta foi registrada.</div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-11 gap-2">
                  {Array.from({ length: 11 }).map((_, i) => {
                    const active = selectedScore === i;
                    return (
                      <Button
                        key={i}
                        type="button"
                        variant={active ? "default" : "outline"}
                        className={active ? scoreColor(i) : ""}
                        onClick={() => setSelectedScore(i)}
                      >
                        {i}
                      </Button>
                    );
                  })}
                </div>

                <div>
                  <div className="text-sm font-medium mb-2">Comentário (opcional)</div>
                  <Textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={4} />
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void submit()} disabled={isSubmitting || !canSubmit}>
                    {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
