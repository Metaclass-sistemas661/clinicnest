import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Sparkles, Loader2, Send, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface Props {
  className?: string;
}

export function AiWeeklySummaryCard({ className }: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    tenants_processed: number;
    emails_sent: number;
    errors: number;
  } | null>(null);

  const handleGenerate = async () => {
    setLoading(true);
    setResult(null);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast.error("Sessão expirada. Faça login novamente.");
        return;
      }

      const res = await supabase.functions.invoke("ai-weekly-summary", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });

      if (res.error) throw res.error;

      const data = res.data;
      setResult(data);
      if (data.emails_sent > 0) {
        toast.success(`Resumo enviado para ${data.emails_sent} administrador(es)!`);
      } else if (data.errors > 0) {
        toast.error(`Erro ao enviar emails. Verifique a configuração.`);
      } else {
        toast.info("Nenhuma atividade na semana. Resumo não enviado.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao gerar resumo semanal");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Resumo Semanal IA
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          Gera um resumo executivo da semana com métricas e recomendações via IA.
          Enviado automaticamente aos domingos às 08h, ou clique para gerar agora.
        </p>
        <Button
          onClick={handleGenerate}
          disabled={loading}
          size="sm"
          className="w-full"
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : result ? (
            <RefreshCw className="mr-2 h-4 w-4" />
          ) : (
            <Send className="mr-2 h-4 w-4" />
          )}
          {loading ? "Gerando resumo..." : result ? "Gerar novamente" : "Gerar e enviar agora"}
        </Button>
        {result && (
          <div className="text-xs bg-muted rounded-md p-2 space-y-1">
            <p><strong>Emails enviados:</strong> {result.emails_sent}</p>
            {result.errors > 0 && (
              <p className="text-destructive"><strong>Erros:</strong> {result.errors}</p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
