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
  X,
  Minimize2,
  Wrench,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { usePlanFeatures } from "@/hooks/usePlanFeatures";

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

export function AiAgentChat() {
  const { hasFeature } = usePlanFeatures();
  const { messages, isLoading, error, sendMessage, clearChat } = useAIAgentChat({
    functionName: "ai-agent-chat",
  });
  const [input, setInput] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  const greetingMessage: AIChatMessage = {
    id: "greeting",
    role: "assistant",
    content: "Olá! Eu sou a Nest, sua assistente de IA da clínica.\n\nPosso te ajudar a buscar pacientes, consultar prontuários, verificar a agenda, agendar consultas e muito mais. Em que posso te ajudar?",
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

  const handleQuickAction = (msg: string) => {
    sendMessage(msg);
  };

  const handleNewChat = () => {
    clearChat();
  };

  // Feature gate: hide if plan doesn't include AI agent chat
  if (!hasFeature('aiAgentChat')) return null;

  // Floating button when closed
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-teal-600 shadow-lg transition-all hover:scale-105 hover:bg-teal-700 active:scale-95 overflow-hidden ring-2 ring-teal-400/40"
        title="Assistente IA — Nest"
      >
        <NestAvatar size={44} className="rounded-full" />
      </button>
    );
  }

  // Minimized bar
  if (isMinimized) {
    return (
      <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-primary px-4 py-2 text-primary-foreground shadow-lg cursor-pointer hover:bg-primary/90 transition-all">
        <NestAvatar size={20} />
        <span className="text-sm font-medium" onClick={() => setIsMinimized(false)}>
          Nest
        </span>
        <button onClick={() => { setIsOpen(false); setIsMinimized(false); }} className="ml-1 hover:opacity-70">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col w-[400px] h-[560px] rounded-2xl border bg-background shadow-2xl overflow-hidden animate-in slide-in-from-bottom-4 duration-300">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-primary text-primary-foreground">
        <div className="flex items-center gap-2.5">
          <NestAvatar size={28} className="ring-1 ring-white/30" />
          <div>
            <h3 className="text-sm font-semibold">Nest</h3>
            <p className="text-xs opacity-80">Assistente IA</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={handleNewChat}
            title="Nova conversa"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setIsMinimized(true)}
            title="Minimizar"
          >
            <Minimize2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-primary-foreground hover:bg-primary-foreground/20"
            onClick={() => setIsOpen(false)}
            title="Fechar"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Messages area */}
      <ScrollArea ref={scrollRef} className="flex-1 px-4">
        {allMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-8 text-center">
            <div className="mb-4">
              <NestAvatar size={56} className="ring-2 ring-primary/20 shadow-md" />
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
                  onClick={() => handleQuickAction(action.message)}
                >
                  {action.label}
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4 py-4">
            {allMessages.map((msg) => (
              <MessageBubble key={msg.id} message={msg} />
            ))}
            {isLoading && (
              <div className="flex gap-3">
                <div className="flex-shrink-0">
                  <NestAvatar size={32} className="ring-1 ring-primary/20" />
                </div>
                <div className="bg-muted rounded-lg px-4 py-3 max-w-[80%]">
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
      <div className="p-3 border-t bg-muted/30">
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Digite sua mensagem..."
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

// ---------------------------------------------------------------------------
// Message bubble sub-component
// ---------------------------------------------------------------------------

function MessageBubble({ message }: { message: AIChatMessage }) {
  const isUser = message.role === "user";

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="flex-shrink-0">
          <NestAvatar size={32} className="ring-1 ring-primary/20" />
        </div>
      )}
      <div className={cn("max-w-[80%] space-y-1")}>
        {/* Tool usage badges */}
        {!isUser && message.toolsUsed && message.toolsUsed.length > 0 && (
          <div className="flex flex-wrap gap-1 mb-1">
            {message.toolsUsed.map((tool, idx) => (
              <Badge key={idx} variant="secondary" className="text-[10px] gap-1 py-0 h-5">
                <Wrench className="h-2.5 w-2.5" />
                {TOOL_LABELS[tool.name] ?? tool.name}
              </Badge>
            ))}
          </div>
        )}
        <div
          className={cn(
            "rounded-lg px-4 py-2.5",
            isUser ? "bg-primary text-primary-foreground" : "bg-muted",
          )}
        >
          <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
        </div>
        <span className="text-[10px] text-muted-foreground">
          {message.timestamp.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
      {isUser && (
        <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center">
          <User className="h-4 w-4 text-primary-foreground" />
        </div>
      )}
    </div>
  );
}
