import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  User,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureGate } from "@/components/subscription/FeatureGate";

const NEST_AVATAR = "/nest-avatar.png";

interface Message {
  role: "user" | "assistant";
  content: string;
}

interface TriageResult {
  specialty?: string;
  urgency?: "EMERGENCIA" | "URGENTE" | "ROTINA";
  isComplete: boolean;
}

interface AiTriageChatbotProps {
  onComplete?: (result: TriageResult & { messages: Message[] }) => void;
  className?: string;
}

export function AiTriageChatbot({ onComplete, className }: AiTriageChatbotProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [result, setResult] = useState<TriageResult | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const triageMutation = useMutation({
    mutationFn: async (msgs: Message[]) => {
      const { data, error } = await supabase.functions.invoke("ai-triage", {
        body: { messages: msgs },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
      if (data.isComplete) {
        setResult({
          specialty: data.specialty,
          urgency: data.urgency,
          isComplete: true,
        });
        onComplete?.({
          specialty: data.specialty,
          urgency: data.urgency,
          isComplete: true,
          messages: [...messages, { role: "assistant", content: data.message }],
        });
      }
    },
  });

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (!input.trim() || triageMutation.isPending) return;

    const userMessage: Message = { role: "user", content: input.trim() };
    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput("");
    triageMutation.mutate(newMessages);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleReset = () => {
    setMessages([]);
    setResult(null);
    setInput("");
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "EMERGENCIA":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            Emergência
          </Badge>
        );
      case "URGENTE":
        return (
          <Badge variant="default" className="gap-1 bg-orange-500">
            <Clock className="h-3 w-3" />
            Urgente
          </Badge>
        );
      case "ROTINA":
        return (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Rotina
          </Badge>
        );
      default:
        return null;
    }
  };

  return (
    <FeatureGate feature="aiTriage" className={className}>
    <Card className={cn("flex flex-col h-full overflow-hidden", className)}>
      <CardHeader className="flex-shrink-0 pb-3 border-b">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2.5 text-lg">
            <img
              src={NEST_AVATAR}
              alt="Nest IA"
              className="h-7 w-7 rounded-full object-cover ring-2 ring-teal-400/40 bg-teal-600"
            />
            <span>Triagem Virtual</span>
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset} className="text-xs">
              <RefreshCw className="h-3.5 w-3.5 mr-1" />
              Reiniciar
            </Button>
          )}
        </div>
        {result && (
          <div className="flex items-center gap-2 mt-2">
            <span className="text-sm text-muted-foreground">Resultado:</span>
            <Badge variant="outline">{result.specialty}</Badge>
            {result.urgency && getUrgencyBadge(result.urgency)}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex-1 flex flex-col p-0 min-h-0">
        <ScrollArea ref={scrollRef} className="flex-1 px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center py-12 px-4">
              <img
                src={NEST_AVATAR}
                alt="Nest IA"
                className="h-16 w-16 rounded-full object-cover ring-2 ring-teal-400/40 bg-teal-600 mb-4"
              />
              <p className="font-medium text-foreground">
                Olá! Sou a Nest, assistente de triagem virtual.
              </p>
              <p className="text-sm text-muted-foreground mt-1.5 max-w-xs">
                Descreva seus sintomas e vou ajudar a identificar a especialidade mais adequada.
              </p>
            </div>
          ) : (
            <div className="space-y-3 py-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-2.5 items-start",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <img
                      src={NEST_AVATAR}
                      alt="Nest"
                      className="flex-shrink-0 w-7 h-7 rounded-full object-cover ring-1 ring-teal-400/40 bg-teal-600 mt-0.5"
                    />
                  )}
                  <div
                    className={cn(
                      "max-w-[75%] rounded-2xl px-3.5 py-2.5 shadow-sm",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted/70 border border-border/50 rounded-bl-md"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap leading-relaxed">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/80 flex items-center justify-center mt-0.5">
                      <User className="h-3.5 w-3.5 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {triageMutation.isPending && (
                <div className="flex gap-2.5 items-start">
                  <img
                    src={NEST_AVATAR}
                    alt="Nest"
                    className="flex-shrink-0 w-7 h-7 rounded-full object-cover ring-1 ring-teal-400/40 bg-teal-600 mt-0.5"
                  />
                  <div className="bg-muted/70 border border-border/50 rounded-2xl rounded-bl-md px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-primary" />
                      <span className="text-xs text-muted-foreground">Analisando...</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="flex-shrink-0 p-3 border-t bg-background/50">
          <div className="flex gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder={
                result?.isComplete
                  ? "Triagem concluída"
                  : "Descreva seus sintomas..."
              }
              disabled={triageMutation.isPending || result?.isComplete}
              className="text-sm"
            />
            <Button
              onClick={handleSend}
              size="icon"
              disabled={!input.trim() || triageMutation.isPending || result?.isComplete}
              className="shrink-0"
            >
              {triageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {triageMutation.isError && (
            <p className="text-xs text-destructive mt-1.5">
              Erro ao processar. Tente novamente.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
    </FeatureGate>
  );
}
