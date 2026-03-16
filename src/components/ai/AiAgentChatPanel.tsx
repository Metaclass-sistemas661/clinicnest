/**
 * AiAgentChatPanel — Embeddable chat panel for the Right Sidebar.
 * Extracted from AiAgentChat, without floating/minimized behaviour.
 */
import { useState, useRef, useEffect } from "react";
import { useAIAgentChat, type AIChatMessage } from "@/hooks/useAIAgentChat";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { NestAvatar } from "@/components/patient/NestAvatar";
import {
  Send,
  User,
  Loader2,
  RefreshCw,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";

const TOOL_LABELS: Record<string, string> = {
  buscar_pacientes: "Buscando pacientes",
  dados_paciente: "Consultando dados",
  prontuario_paciente: "Acessando prontuário",
  agenda_hoje: "Verificando agenda",
  agenda_paciente: "Buscando agendamentos",
  agendar_consulta: "Criando agendamento",
  servicos_disponiveis: "Listando serviços",
  resumo_financeiro: "Calculando financeiro",
};

const QUICK_ACTIONS = [
  { label: "Agenda de hoje", message: "Qual a agenda de hoje?" },
  { label: "Buscar paciente", message: "Preciso buscar um paciente" },
  { label: "Resumo financeiro", message: "Resumo financeiro do mês" },
  { label: "Serviços", message: "Quais serviços estão disponíveis?" },
];

export function AiAgentChatPanel() {
  const { messages, isLoading, error, sendMessage, clearChat } = useAIAgentChat({
    functionName: "ai-agent-chat",
  });
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const greetingMessage: AIChatMessage = {
    id: "greeting",
    role: "assistant",
    content:
      "Olá! Eu sou a Nest, sua assistente de IA da clínica.\n\nPosso te ajudar a buscar pacientes, consultar prontuários, verificar a agenda, agendar consultas e muito mais. Em que posso te ajudar?",
    timestamp: new Date(),
  };

  const allMessages =
    messages.length === 0 && !isLoading ? [] : [greetingMessage, ...messages];

  useEffect(() => {
    if (scrollRef.current) {
      const viewport = scrollRef.current.querySelector(
        "[data-radix-scroll-area-viewport]",
      );
      if (viewport) {
        viewport.scrollTop = viewport.scrollHeight;
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

  return (
    <div className="flex h-full flex-col">
      {/* New chat button */}
      <div className="flex justify-end px-3 py-1.5">
        <Button
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          onClick={clearChat}
        >
          <RefreshCw className="h-3 w-3" />
          Nova conversa
        </Button>
      </div>

      {/* Messages */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center">
            <div className="mb-4">
              <NestAvatar
                size={56}
                className="ring-2 ring-primary/20 shadow-md"
              />
            </div>
            <h4 className="font-medium mb-1">Olá! Eu sou a Nest</h4>
            <p className="text-sm text-muted-foreground mb-6 max-w-[280px]">
              Seu assistente de IA da clínica. Em que posso te ajudar?
            </p>
            <div className="grid grid-cols-2 gap-2 w-full">
              {QUICK_ACTIONS.map((action) => (
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
              <PanelMessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <NestAvatar
                    size={28}
                    className="ring-1 ring-primary/20"
                  />
                </div>
                <div className="rounded-lg bg-muted px-4 py-3 max-w-[80%]">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Processando...
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
      <div className="p-3 border-t border-border/50 bg-muted/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Pergunte algo..."
            disabled={isLoading}
            className="text-sm"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isLoading}
            size="icon"
            className="shrink-0"
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

/* ── Message Bubble ────────────────────────────────────────── */

function PanelMessageBubble({ message }: { message: AIChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div
      className={cn("flex gap-2.5", isUser ? "justify-end" : "justify-start")}
    >
      {!isUser && (
        <div className="flex-shrink-0 mt-0.5">
          <NestAvatar size={28} className="ring-1 ring-primary/20" />
        </div>
      )}
      <div className="max-w-[85%] space-y-1">
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.toolsUsed.map((tool, idx) => (
              <Badge
                key={idx}
                variant="secondary"
                className="text-[10px] gap-1 py-0 h-5"
              >
                <Wrench className="h-2.5 w-2.5" />
                {TOOL_LABELS[tool.name] ?? tool.name}
              </Badge>
            ))}
          </div>
        )}
        <div
          className={cn(
            "rounded-lg px-3.5 py-2.5",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">
            {message.content}
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {message.timestamp.toLocaleTimeString("pt-BR", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </span>
      </div>
      {isUser && (
        <div className="flex-shrink-0 mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-primary">
          <User className="h-3.5 w-3.5 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
