import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  Send,
  User,
  AlertTriangle,
  Clock,
  CheckCircle,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { cn } from "@/lib/utils";

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
    <Card className={cn("flex flex-col h-[500px]", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <Bot className="h-5 w-5 text-primary" />
            Triagem Virtual
          </CardTitle>
          {messages.length > 0 && (
            <Button variant="ghost" size="sm" onClick={handleReset}>
              <RefreshCw className="h-4 w-4 mr-1" />
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

      <CardContent className="flex-1 flex flex-col p-0">
        <ScrollArea ref={scrollRef} className="flex-1 px-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center p-4">
              <Bot className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground">
                Olá! Sou o assistente de triagem virtual.
              </p>
              <p className="text-sm text-muted-foreground mt-2">
                Descreva seus sintomas e vou ajudar a identificar a especialidade mais adequada.
              </p>
            </div>
          ) : (
            <div className="space-y-4 py-4">
              {messages.map((msg, idx) => (
                <div
                  key={idx}
                  className={cn(
                    "flex gap-3",
                    msg.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                  {msg.role === "assistant" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                      <Bot className="h-4 w-4 text-primary" />
                    </div>
                  )}
                  <div
                    className={cn(
                      "max-w-[80%] rounded-lg px-4 py-2",
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted"
                    )}
                  >
                    <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                  </div>
                  {msg.role === "user" && (
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
                      <User className="h-4 w-4 text-primary-foreground" />
                    </div>
                  )}
                </div>
              ))}
              {triageMutation.isPending && (
                <div className="flex gap-3">
                  <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                  <div className="bg-muted rounded-lg px-4 py-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                </div>
              )}
            </div>
          )}
        </ScrollArea>

        <div className="p-4 border-t">
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
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || triageMutation.isPending || result?.isComplete}
            >
              {triageMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          {triageMutation.isError && (
            <p className="text-sm text-destructive mt-2">
              Erro ao processar. Tente novamente.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
