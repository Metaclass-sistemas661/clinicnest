import { useState, useRef, useEffect, useCallback } from "react";
import { X, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Message {
  role: "user" | "assistant";
  content: string;
}

const WELCOME_MSG: Message = {
  role: "assistant",
  content:
    "Olá! 👋 Sou o **Nest**, assistente do ClinicNest. Posso ajudar com dúvidas sobre funcionalidades, planos e preços. Como posso te ajudar?",
};

export function LandingChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([WELCOME_MSG]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Scroll to bottom on new messages
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Focus input when opened
  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 200);
  }, [open]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = { role: "user", content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput("");
    setLoading(true);

    try {
      // Envia apenas as mensagens do chat (sem a welcome hardcoded se for a primeira)
      const chatHistory = updatedMessages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch(`${SUPABASE_URL}/functions/v1/landing-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_KEY,
        },
        body: JSON.stringify({ messages: chatHistory }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Erro ${res.status}`);
      }

      const data = await res.json();
      setMessages((prev) => [...prev, { role: "assistant", content: data.message }]);
    } catch (err) {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content:
            "Desculpe, tive um problema. Tente novamente ou fale conosco pelo WhatsApp! 😊",
        },
      ]);
    } finally {
      setLoading(false);
    }
  }, [input, loading, messages]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  // Parse simple markdown bold
  const renderContent = (text: string) => {
    return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => {
      if (part.startsWith("**") && part.endsWith("**")) {
        return (
          <strong key={i} className="font-semibold">
            {part.slice(2, -2)}
          </strong>
        );
      }
      return <span key={i}>{part}</span>;
    });
  };

  return (
    <>
      {/* Chat Bubble Button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "fixed bottom-6 right-[5.5rem] z-[51] flex items-center justify-center",
          "w-[3.5rem] h-[3.5rem] rounded-full shadow-xl transition-all duration-300",
          "bg-gradient-to-br from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700",
          "text-white hover:scale-105 active:scale-95",
          open && "rotate-90 scale-90",
        )}
        aria-label={open ? "Fechar chat" : "Abrir chat com Nest IA"}
      >
        {open ? (
          <X className="w-6 h-6" />
        ) : (
          <img
            src="/nest-avatar.png"
            alt="Nest IA"
            className="w-12 h-12 rounded-full object-cover"
          />
        )}
      </button>

      {/* Notification dot when closed */}
      {!open && (
        <span className="fixed bottom-[4.5rem] right-[5.25rem] z-[52] flex h-3.5 w-3.5 pointer-events-none">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-3.5 w-3.5 bg-orange-500" />
        </span>
      )}

      {/* Chat Window */}
      {open && (
        <div
          className={cn(
            "fixed bottom-[5rem] right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)]",
            "flex flex-col rounded-2xl shadow-2xl border border-border/50",
            "bg-background overflow-hidden",
            "animate-in slide-in-from-bottom-5 fade-in duration-300",
          )}
          style={{ height: "min(500px, calc(100vh - 6rem))" }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white">
            <div className="relative">
              <img
                src="/nest-avatar.png"
                alt="Nest IA"
                className="w-9 h-9 rounded-full border-2 border-white/30 object-cover bg-teal-500"
              />
              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-400 rounded-full border-2 border-teal-600" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm leading-tight">Nest IA</p>
              <p className="text-[11px] text-white/70">Assistente ClinicNest • Online</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="p-1 rounded hover:bg-white/20 transition"
              aria-label="Fechar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={cn(
                  "flex gap-2 max-w-[85%]",
                  msg.role === "user" ? "ml-auto flex-row-reverse" : "",
                )}
              >
                {msg.role === "assistant" && (
                  <img
                    src="/nest-avatar.png"
                    alt=""
                    className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 bg-teal-600 object-cover"
                  />
                )}
                <div
                  className={cn(
                    "rounded-2xl px-3 py-2 text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-teal-600 text-white rounded-br-md"
                      : "bg-muted rounded-bl-md",
                  )}
                >
                  {renderContent(msg.content)}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex gap-2 max-w-[85%]">
                <img
                  src="/nest-avatar.png"
                  alt=""
                  className="w-7 h-7 rounded-full flex-shrink-0 mt-0.5 bg-teal-600 object-cover"
                />
                <div className="rounded-2xl px-3 py-2 bg-muted rounded-bl-md">
                  <Loader2 className="w-4 h-4 animate-spin text-teal-600" />
                </div>
              </div>
            )}
          </div>

          {/* Input */}
          <div className="border-t p-3">
            <div className="flex gap-2">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua dúvida..."
                maxLength={500}
                disabled={loading}
                className={cn(
                  "flex-1 rounded-xl border px-3 py-2 text-sm",
                  "bg-muted/50 placeholder:text-muted-foreground/60",
                  "focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-500",
                  "disabled:opacity-50",
                )}
              />
              <Button
                size="icon"
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="rounded-xl bg-teal-600 hover:bg-teal-700 h-9 w-9 flex-shrink-0"
              >
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
