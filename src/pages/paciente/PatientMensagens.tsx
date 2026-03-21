import { useState, useEffect, useRef } from "react";
import { PatientLayout } from "@/components/layout/PatientLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import {
  MessageCircle,
  Send,
  Loader2,
  RefreshCw,
  User,
  Building2,
} from "lucide-react";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender_type: "patient" | "clinic";
  sender_name: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

export default function PatientMensagens() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    void loadMessages();
  }, []);

  // ── Supabase Realtime: escutar novas mensagens em tempo real ──
  useEffect(() => {
    let channel: ReturnType<typeof supabasePatient.channel> | null = null;

    const setupRealtime = async () => {
      try {
        const { data: { user } } = await supabasePatient.auth.getUser();
        if (!user) return;

        // Buscar patient_profile para obter client_id e tenant_id
        const { data: link } = await supabasePatient
          .from("patient_profiles")
          .select("client_id, tenant_id")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .limit(1)
          .single();

        if (!link?.client_id) return;

        channel = supabasePatient
          .channel("patient-messages-realtime")
          .on(
            "postgres_changes" as any,
            {
              event: "INSERT",
              schema: "public",
              table: "patient_messages",
              filter: `patient_id=eq.${link.client_id}`,
            },
            (payload: any) => {
              // Nova mensagem recebida — recarregar lista completa
              if (payload.new?.sender_type === "clinic") {
                void loadMessages();
              }
            }
          )
          .subscribe();
      } catch {
        // Falha no realtime não deve impedir o uso da página
      }
    };

    void setupRealtime();

    return () => {
      if (channel) {
        void supabasePatient.removeChannel(channel);
      }
    };
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadMessages = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("get_patient_messages", {
        p_limit: 100,
        p_offset: 0,
      });
      if (error) throw error;
      setMessages((data as Message[]) || []);
    } catch (err) {
      logger.error("Error loading messages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc("send_patient_message", {
        p_content: newMessage.trim(),
      });
      if (error) throw error;

      const result = data as { success?: boolean; message_id?: string };
      if (result?.success) {
        setNewMessage("");
        void loadMessages();
        textareaRef.current?.focus();
      }
    } catch (err: any) {
      logger.error("Error sending message:", err);
      toast.error(err?.message || "Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const formatMessageDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) {
      return format(date, "HH:mm");
    }
    if (isYesterday(date)) {
      return `Ontem ${format(date, "HH:mm")}`;
    }
    return format(date, "dd/MM/yyyy HH:mm");
  };

  const groupMessagesByDate = (msgs: Message[]) => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentDate = "";

    msgs.forEach((msg) => {
      const msgDate = format(new Date(msg.created_at), "yyyy-MM-dd");
      if (msgDate !== currentDate) {
        currentDate = msgDate;
        groups.push({ date: msgDate, messages: [msg] });
      } else {
        groups[groups.length - 1].messages.push(msg);
      }
    });

    return groups;
  };

  const formatGroupDate = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isToday(date)) return "Hoje";
    if (isYesterday(date)) return "Ontem";
    return format(date, "EEEE, dd 'de' MMMM", { locale: ptBR });
  };

  const messageGroups = groupMessagesByDate(messages);

  return (
    <PatientLayout
      title="Mensagens"
      subtitle="Converse com a clínica"
      actions={
        <Button variant="outline" size="sm" onClick={() => void loadMessages()} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? "animate-spin" : ""}`} />
          Atualizar
        </Button>
      }
    >
      <Card className="flex flex-col h-[calc(100vh-220px)] min-h-[400px]">
        {/* Messages area */}
        <CardContent className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                  <Skeleton className="h-16 w-64 rounded-2xl" />
                </div>
              ))}
            </div>
          ) : messages.length === 0 ? (
            <div className="flex items-center justify-center h-full">
              <EmptyState
                icon={MessageCircle}
                title="Nenhuma mensagem"
                description="Envie uma mensagem para iniciar a conversa com a clínica."
              />
            </div>
          ) : (
            <>
              {messageGroups.map((group) => (
                <div key={group.date}>
                  {/* Date separator */}
                  <div className="flex items-center justify-center my-4">
                    <span className="text-xs text-muted-foreground bg-muted px-3 py-1 rounded-full capitalize">
                      {formatGroupDate(group.date)}
                    </span>
                  </div>

                  {/* Messages */}
                  {group.messages.map((message) => {
                    const isPatient = message.sender_type === "patient";
                    return (
                      <div
                        key={message.id}
                        className={cn("flex mb-3", isPatient ? "justify-end" : "justify-start")}
                      >
                        <div
                          className={cn(
                            "max-w-[80%] sm:max-w-[70%]",
                            isPatient ? "order-2" : "order-1"
                          )}
                        >
                          {/* Sender info */}
                          {!isPatient && (
                            <div className="flex items-center gap-1.5 mb-1 ml-1">
                              <Building2 className="h-3 w-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground">
                                {message.sender_name || "Clínica"}
                              </span>
                            </div>
                          )}

                          {/* Message bubble */}
                          <div
                            className={cn(
                              "rounded-2xl px-4 py-2.5",
                              isPatient
                                ? "bg-teal-600 text-white rounded-br-md"
                                : "bg-muted rounded-bl-md"
                            )}
                          >
                            <p className="text-sm whitespace-pre-wrap break-words">
                              {message.content}
                            </p>
                          </div>

                          {/* Time */}
                          <div
                            className={cn(
                              "text-[10px] text-muted-foreground mt-1",
                              isPatient ? "text-right mr-1" : "ml-1"
                            )}
                          >
                            {formatMessageDate(message.created_at)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}
              <div ref={messagesEndRef} />
            </>
          )}
        </CardContent>

        {/* Input area */}
        <div className="border-t p-4">
          <div className="flex gap-2">
            <Textarea
              ref={textareaRef}
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Digite sua mensagem..."
              className="min-h-[44px] max-h-[120px] resize-none"
              rows={1}
              disabled={isSending}
            />
            <Button
              onClick={() => void handleSend()}
              disabled={isSending || !newMessage.trim()}
              className="bg-teal-600 hover:bg-teal-700 h-[44px] px-4"
            >
              {isSending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">
            Pressione Enter para enviar ou Shift+Enter para nova linha
          </p>
        </div>
      </Card>
    </PatientLayout>
  );
}
