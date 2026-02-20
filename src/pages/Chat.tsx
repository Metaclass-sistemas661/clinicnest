import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MessageSquare, Send, Hash, User } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Message {
  id: string;
  channel: string;
  content: string;
  created_at: string;
  sender_id: string | null;
  sender_name: string;
  sender_initials: string;
  is_own: boolean;
}

interface Member {
  id: string;
  full_name: string;
  user_id: string;
}

const CHANNELS_FIXED = [{ id: "geral", label: "Geral", icon: Hash }];

function formatMessageDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (isToday(d)) return format(d, "HH:mm");
  if (isYesterday(d)) return `Ontem ${format(d, "HH:mm")}`;
  return format(d, "dd/MM HH:mm", { locale: ptBR });
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

export default function Chat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [activeChannel, setActiveChannel] = useState("geral");
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const myProfileId = profile?.id ?? null;

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void fetchMembers();
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void fetchMessages(activeChannel);

    // Realtime subscription
    const channel = supabase
      .channel(`chat:${profile.tenant_id}:${activeChannel}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "internal_messages",
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            channel: string;
            content: string;
            created_at: string;
            sender_id: string | null;
          };
          if (row.channel !== activeChannel) return;
          const sender = members.find((m) => m.id === row.sender_id);
          const name = sender?.full_name ?? "Desconhecido";
          setMessages((prev) => [
            ...prev,
            {
              id: row.id,
              channel: row.channel,
              content: row.content,
              created_at: row.created_at,
              sender_id: row.sender_id,
              sender_name: name,
              sender_initials: getInitials(name),
              is_own: row.sender_id === myProfileId,
            },
          ]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.tenant_id, activeChannel, members]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "auto" });
  }, [messages]);

  const fetchMembers = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, user_id")
        .eq("tenant_id", profile.tenant_id)
        .order("full_name");
      if (error) throw error;
      setMembers(data ?? []);
    } catch (err) {
      logger.error("Chat fetchMembers:", err);
    }
  };

  const fetchMessages = async (channel: string) => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from("internal_messages")
        .select("id, channel, content, created_at, sender_id, profiles(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .eq("channel", channel)
        .order("created_at", { ascending: true })
        .limit(100);
      if (error) throw error;
      const mapped: Message[] = (data ?? []).map((r: any) => {
        const name = r.profiles?.full_name ?? "Desconhecido";
        return {
          id: r.id,
          channel: r.channel,
          content: r.content,
          created_at: r.created_at,
          sender_id: r.sender_id,
          sender_name: name,
          sender_initials: getInitials(name),
          is_own: r.sender_id === myProfileId,
        };
      });
      setMessages(mapped);
    } catch (err) {
      logger.error("Chat fetchMessages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if (!text || !profile?.tenant_id || !myProfileId || isSending) return;
    setIsSending(true);
    try {
      const { error } = await supabase.from("internal_messages").insert({
        tenant_id: profile.tenant_id,
        sender_id: myProfileId,
        channel: activeChannel,
        content: text,
      });
      if (error) throw error;
      setNewMessage("");
      inputRef.current?.focus();
    } catch (err) {
      logger.error("Chat sendMessage:", err);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const allChannels = [
    ...CHANNELS_FIXED,
    ...members
      .filter((m) => m.id !== myProfileId)
      .map((m) => ({
        id: `dm:${m.id}`,
        label: m.full_name,
        icon: User,
      })),
  ];

  const activeLabel =
    allChannels.find((c) => c.id === activeChannel)?.label ?? activeChannel;

  return (
    <MainLayout title="Chat Interno" subtitle="Comunicação em tempo real com a equipe">
      <div className="flex h-[calc(100vh-10rem)] rounded-xl border border-border overflow-hidden bg-background">
        {/* Sidebar de canais */}
        <div className="w-56 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col">
          <div className="p-3 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canais</p>
          </div>
          <ScrollArea className="flex-1 p-2">
            {allChannels.map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.id}
                  onClick={() => setActiveChannel(ch.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors mb-0.5",
                    activeChannel === ch.id
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  )}
                >
                  <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                  <span className="truncate">{ch.label}</span>
                </button>
              );
            })}
          </ScrollArea>
        </div>

        {/* Área de mensagens */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Header do canal */}
          <div className="px-4 py-3 border-b border-border flex items-center gap-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="font-medium text-sm">{activeLabel}</span>
            <Badge variant="secondary" className="text-xs ml-auto">
              {messages.length} mensagens
            </Badge>
          </div>

          {/* Lista de mensagens */}
          <ScrollArea className="flex-1 p-4">
            {isLoading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <Skeleton className="h-8 w-8 rounded-full" />
                    <div className="space-y-1">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-4 w-64" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">Nenhuma mensagem ainda.</p>
                <p className="text-muted-foreground/60 text-xs mt-1">Seja o primeiro a enviar uma mensagem!</p>
              </div>
            ) : (
              <div className="space-y-1">
                {messages.map((msg, idx) => {
                  const showHeader =
                    idx === 0 || messages[idx - 1].sender_id !== msg.sender_id;
                  return (
                    <div
                      key={msg.id}
                      className={cn("flex items-start gap-3", msg.is_own ? "flex-row-reverse" : "flex-row", showHeader ? "mt-4" : "mt-0.5")}
                    >
                      {showHeader && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback className={cn("text-xs", msg.is_own ? "bg-primary text-primary-foreground" : "bg-muted")}>
                            {msg.sender_initials}
                          </AvatarFallback>
                        </Avatar>
                      )}
                      {!showHeader && <div className="w-8 flex-shrink-0" />}
                      <div className={cn("max-w-[70%]", msg.is_own ? "items-end" : "items-start", "flex flex-col")}>
                        {showHeader && (
                          <div className={cn("flex items-baseline gap-2 mb-0.5", msg.is_own ? "flex-row-reverse" : "flex-row")}>
                            <span className="text-xs font-medium">{msg.is_own ? "Você" : msg.sender_name}</span>
                            <span className="text-xs text-muted-foreground">{formatMessageDate(msg.created_at)}</span>
                          </div>
                        )}
                        <div
                          className={cn(
                            "px-3 py-2 rounded-xl text-sm leading-relaxed",
                            msg.is_own
                              ? "bg-primary text-primary-foreground rounded-tr-none"
                              : "bg-muted text-foreground rounded-tl-none"
                          )}
                        >
                          {msg.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>
            )}
          </ScrollArea>

          {/* Input de mensagem */}
          <div className="p-3 border-t border-border">
            <div className="flex gap-2">
              <Input
                ref={inputRef}
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Mensagem em #${activeLabel}...`}
                className="flex-1"
                disabled={isSending}
              />
              <Button
                size="icon"
                onClick={() => void sendMessage()}
                disabled={!newMessage.trim() || isSending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Enter para enviar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
