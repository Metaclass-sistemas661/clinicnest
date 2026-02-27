import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  FileText,
  Loader2,
  RefreshCw,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

interface AiPatientSummaryProps {
  clientId: string;
  clientName?: string;
  className?: string;
}

export function AiPatientSummary({ clientId, clientName, className }: AiPatientSummaryProps) {
  const [summary, setSummary] = useState<string>("");
  const [generatedAt, setGeneratedAt] = useState<string>("");
  const [copied, setCopied] = useState(false);
  const [showOptions, setShowOptions] = useState(false);
  const [options, setOptions] = useState({
    include_appointments: true,
    include_prescriptions: true,
    include_exams: true,
    max_appointments: 5,
  });
  const summaryMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ai-summary", {
        body: {
          client_id: clientId,
          ...options,
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSummary(data.summary);
      setGeneratedAt(data.generated_at);
    },
    onError: () => {
      toast.error("Não foi possível gerar o resumo.");
    },
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast.success("Resumo copiado para a área de transferência.");
  };

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <FileText className="h-5 w-5 text-primary" />
            Resumo do Prontuário
            {clientName && (
              <span className="text-sm font-normal text-muted-foreground">
                - {clientName}
              </span>
            )}
          </CardTitle>
          {summary && (
            <div className="flex gap-2">
              <Button variant="ghost" size="sm" onClick={handleCopy}>
                {copied ? (
                  <Check className="h-4 w-4 text-green-500" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => summaryMutation.mutate()}
                disabled={summaryMutation.isPending}
              >
                <RefreshCw
                  className={cn("h-4 w-4", summaryMutation.isPending && "animate-spin")}
                />
              </Button>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {!summary ? (
          <div className="space-y-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowOptions(!showOptions)}
              className="w-full justify-between"
            >
              Opções de geração
              {showOptions ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </Button>

            {showOptions && (
              <div className="space-y-3 p-3 rounded-lg border">
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="appointments"
                    checked={options.include_appointments}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, include_appointments: !!checked }))
                    }
                  />
                  <Label htmlFor="appointments">Incluir consultas recentes</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="prescriptions"
                    checked={options.include_prescriptions}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, include_prescriptions: !!checked }))
                    }
                  />
                  <Label htmlFor="prescriptions">Incluir medicamentos ativos</Label>
                </div>
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="exams"
                    checked={options.include_exams}
                    onCheckedChange={(checked) =>
                      setOptions((prev) => ({ ...prev, include_exams: !!checked }))
                    }
                  />
                  <Label htmlFor="exams">Incluir exames recentes</Label>
                </div>
              </div>
            )}

            <Button
              onClick={() => summaryMutation.mutate()}
              disabled={summaryMutation.isPending}
              className="w-full"
            >
              {summaryMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Gerando resumo...
                </>
              ) : (
                <>
                  <FileText className="h-4 w-4 mr-2" />
                  Gerar Resumo com IA
                </>
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <ScrollArea className="h-[400px] rounded-lg border p-4">
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{summary}</ReactMarkdown>
              </div>
            </ScrollArea>
            {generatedAt && (
              <p className="text-xs text-muted-foreground text-right">
                Gerado em: {new Date(generatedAt).toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          O resumo é gerado por IA com base nos dados do prontuário. Sempre verifique as informações.
        </p>
      </CardContent>
    </Card>
  );
}
