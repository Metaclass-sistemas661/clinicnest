import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  Loader2,
  CheckCircle,
  AlertCircle,
  HelpCircle,
  Copy,
  Check,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { FeatureGate } from "@/components/subscription/FeatureGate";

interface CidSuggestion {
  code: string;
  description: string;
  confidence: "alta" | "media" | "baixa";
  notes?: string;
}

interface AiCidSuggestProps {
  onSelect?: (code: string, description: string) => void;
  specialty?: string;
  className?: string;
}

export function AiCidSuggest({ onSelect, specialty, className }: AiCidSuggestProps) {
  const [description, setDescription] = useState("");
  const [suggestions, setSuggestions] = useState<CidSuggestion[]>([]);
  const [observations, setObservations] = useState<string>("");
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  const suggestMutation = useMutation({
    mutationFn: async (desc: string) => {
      const { data, error } = await supabase.functions.invoke("ai-cid-suggest", {
        body: { description: desc, specialty },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setSuggestions(data.suggestions || []);
      setObservations(data.observations || "");
    },
    onError: () => {
      toast.error("Não foi possível obter sugestões de CID.");
    },
  });

  const handleSuggest = () => {
    if (!description.trim() || description.length < 5) {
      toast.error("Forneça uma descrição clínica mais detalhada.");
      return;
    }
    suggestMutation.mutate(description);
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const handleSelect = (suggestion: CidSuggestion) => {
    onSelect?.(suggestion.code, suggestion.description);
    toast.success(`CID selecionado: ${suggestion.code} - ${suggestion.description}`);
  };

  const getConfidenceBadge = (confidence: string) => {
    switch (confidence) {
      case "alta":
        return (
          <Badge variant="default" className="gap-1 bg-green-500">
            <CheckCircle className="h-3 w-3" />
            Alta
          </Badge>
        );
      case "media":
        return (
          <Badge variant="default" className="gap-1 bg-yellow-500">
            <AlertCircle className="h-3 w-3" />
            Média
          </Badge>
        );
      case "baixa":
        return (
          <Badge variant="secondary" className="gap-1">
            <HelpCircle className="h-3 w-3" />
            Baixa
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <FeatureGate feature="aiCidSuggest" className={className}>
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Sparkles className="h-5 w-5 text-primary" />
          Sugestão de CID com IA
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Descreva o quadro clínico do paciente..."
            rows={3}
          />
          <Button
            onClick={handleSuggest}
            disabled={suggestMutation.isPending || description.length < 5}
            className="w-full"
          >
            {suggestMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analisando...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Sugerir CID
              </>
            )}
          </Button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium text-muted-foreground">
              Sugestões ({suggestions.length})
            </p>
            <div className="space-y-2">
              {suggestions.map((suggestion, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer transition-colors"
                  onClick={() => handleSelect(suggestion)}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <code className="text-sm font-mono font-bold text-primary">
                        {suggestion.code}
                      </code>
                      {getConfidenceBadge(suggestion.confidence)}
                    </div>
                    <p className="text-sm">{suggestion.description}</p>
                    {suggestion.notes && (
                      <p className="text-xs text-muted-foreground mt-1">
                        {suggestion.notes}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="flex-shrink-0"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCopy(suggestion.code);
                    }}
                  >
                    {copiedCode === suggestion.code ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {observations && (
          <div className="p-3 rounded-lg bg-muted">
            <p className="text-sm text-muted-foreground">{observations}</p>
          </div>
        )}

        <p className="text-xs text-muted-foreground">
          As sugestões são geradas por IA e devem ser validadas pelo profissional de saúde.
        </p>
      </CardContent>
    </Card>
    </FeatureGate>
  );
}
