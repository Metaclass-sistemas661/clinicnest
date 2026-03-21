import { Spinner } from "@/components/ui/spinner";
import { useState, useRef, useEffect } from "react";
import { useAIAgentChat, type AIChatMessage } from "@/hooks/useAIAgentChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { NestAvatar } from "@/components/patient/NestAvatar";
import {
  Send,
  User,
  Loader2,
  RefreshCw,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";
import { supabasePatient } from "@/integrations/supabase/client";

const PATIENT_QUICK_ACTIONS = [
  { label: "Meus agendamentos", message: "Quais são meus próximos agendamentos?" },
  { label: "Procedimentos disponíveis", message: "Quais procedimentos a clínica oferece?" },
  { label: "Contato da clínica", message: "Qual o telefone e endereço da clínica?" },
  { label: "Preparação consulta", message: "Como devo me preparar para minha consulta?" },
];

interface AiPatientChatProps {
  /** Optional: override supabase client for patient portal */
  supabaseClient?: typeof import("@/integrations/supabase/client").supabase;
  className?: string;
}

export function AiPatientChat({ supabaseClient, className }: AiPatientChatProps) {
  const { hasFeature } = usePlanFeatures();
  const { messages, isLoading, error, sendMessage, clearChat } = useAIAgentChat({
    functionName: "ai-patient-chat",
    client: supabaseClient ?? supabasePatient,
  });
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);

  const greetingMessage: AIChatMessage = {
    id: "greeting",
    role: "assistant",
    content: "Olá! Eu sou a Nest, assistente virtual da clínica.\n\nPosso te ajudar com informações sobre seus agendamentos, procedimentos disponíveis e muito mais. Em que posso te ajudar?",
    timestamp: new Date(),
  };

  const allMessages = messages.length === 0 && !isLoading ? [] : [greetingMessage, ...messages];
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      const scrollContainer = scrollRef.current.querySelector("[data-radix-scroll-area-viewport]");
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, isLoading]);

  const handleSend = () => {
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Feature gate: hide if plan doesn't include AI patient chat
  if (!hasFeature('aiPatientChat')) return null;

  // Floating button
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 shadow-lg transition-all hover:scale-105 hover:bg-teal-700 active:scale-95 overflow-hidden ring-2 ring-teal-400/40",
          className,
        )}
        title="Fale com a Nest"
      >
        <NestAvatar size={56} className="rounded-full" />
      </button>
    );
  }

  return (
    <div
      className={cn(
        "fixed bottom-6 right-6 z-50 flex flex-col w-[380px] h-[520px] rounded-2xl border bg-background shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300",
        className,
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-green-600 text-white">
        <div className="flex items-center gap-2.5">
          <NestAvatar size={28} className="ring-1 ring-white/30" />
          <div>
            <h3 className="text-sm font-semibold">Nest</h3>
            <p className="text-xs opacity-80">Assistente Virtual</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={clearChat}
            title="Nova conversa"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-white hover:bg-white/20"
            onClick={() => setIsOpen(false)}
            title="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="mb-4">
              <NestAvatar size={56} className="ring-2 ring-green-300/30 shadow-md" />
            </div>
            <h4 className="font-medium mb-1">Olá! Eu sou a Nest</h4>
            <p className="text-sm text-muted-foreground mb-6 max-w-[260px]">
              Assistente virtual da clínica. Em que posso te ajudar?
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {PATIENT_QUICK_ACTIONS.map((action) => (
                <Button
                  key={action.label}
                  variant="outline"
                  size="sm"
                  className="text-xs h-auto py-2 justify-start"
                  onClick={() => sendMessage(action.message)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {allMessages.map((msg) => (
              <PatientMessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <NestAvatar size={32} className="ring-1 ring-green-300/30" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Spinner size="sm" />
                    Digitando...
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Error */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t">
          <p className="text-xs text-destructive">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua dúvida..."
            disabled={isLoading}
            className="text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0 bg-green-600 hover:bg-green-700"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function PatientMessageBubble({ message }: { message: AIChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0">
          <NestAvatar size={32} className="ring-1 ring-green-300/30" />
        </div>
      )}
      <div className="max-w-[80%] space-y-1">
        <div
          className={cn(
            "rounded-lg px-4 py-2.5",
            isUser ? "bg-green-600 text-white" : "bg-muted",
          )}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-green-600 flex items-center justify-center">
          <User className="h-4 w-4 text-white" />
        </div>
      )}
    </div>
  );
}
