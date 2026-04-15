import { useState, useEffect, useRef } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  MessageCircle,
  Send,
  Loader2,
  RefreshCw,
  User,
  Building2,
  Search,
  ChevronLeft,
} from "lucide-react";
import { api } from "@/integrations/gcp/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

interface Conversation {
  patient_id: string;
  client_name: string;
  last_message: string;
  last_message_at: string;
  last_sender_type: "patient" | "clinic";
  unread_count: number;
}

interface Message {
  id: string;
  sender_type: "patient" | "clinic";
  sender_name: string | null;
  content: string;
  read_at: string | null;
  created_at: string;
}

export default function MensagensPacientes() {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [searchTerm, setSearchTerm] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void loadConversations();
  }, []);

  useEffect(() => {
    if (selectedConversation) {
      void loadMessages(selectedConversation.patient_id);
    }
  }, [selectedConversation]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const loadConversations = async () => {
    setIsLoadingConversations(true);
    try {
      const { data, error } = await (api as any).rpc("get_patient_conversations");
      if (error) throw error;
      setConversations((data as Conversation[]) || []);
    } catch (err) {
      logger.error("Error loading conversations:", err);
    } finally {
      setIsLoadingConversations(false);
    }
  };

  const loadMessages = async (patientId: string) => {
    setIsLoadingMessages(true);
    try {
      const { data, error } = await (api as any).rpc("get_messages_for_patient", {
        p_client_id: patientId,
        p_limit: 100,
      });
      if (error) throw error;
      setMessages((data as Message[]) || []);
      void loadConversations(); // Refresh unread counts
    } catch (err) {
      logger.error("Error loading messages:", err);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  const handleSend = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    setIsSending(true);
    try {
      const { data, error } = await (api as any).rpc("send_clinic_message_to_patient", {
        p_client_id: selectedConversation.patient_id,
        p_content: newMessage.trim(),
      });
      if (error) throw error;

      const result = data as { success?: boolean };
      if (result?.success) {
        setNewMessage("");
        void loadMessages(selectedConversation.patient_id);
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
    if (isToday(date)) return format(date, "HH:mm");
    if (isYesterday(date)) return `Ontem ${format(date, "HH:mm")}`;
    return format(date, "dd/MM HH:mm");
  };

  const filteredConversations = conversations.filter((c) =>
    c.client_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  // Mobile: show either list or chat
  const showList = !isMobile || !selectedConversation;
  const showChat = !isMobile || selectedConversation;

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-120px)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold">Mensagens de Pacientes</h1>
            <p className="text-sm text-muted-foreground">
              {totalUnread > 0 ? `${totalUnread} mensagens não lidas` : "Todas as mensagens lidas"}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => void loadConversations()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Atualizar
          </Button>
        </div>

        <div className="flex gap-4 flex-1 min-h-0">
          {/* Conversations list */}
          {showList && (
            <Card className={cn("flex flex-col", isMobile ? "w-full" : "w-80 flex-shrink-0")}>
              <CardHeader className="pb-3">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar paciente..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </CardHeader>
              <CardContent className="flex-1 overflow-hidden p-0">
                <ScrollArea className="h-full">
                  {isLoadingConversations ? (
                    <div className="p-4 space-y-3">
                      {[1, 2, 3].map((i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : filteredConversations.length === 0 ? (
                    <div className="p-4">
                      <EmptyState
                        icon={MessageCircle}
                        title="Nenhuma conversa"
                        description="As conversas com pacientes aparecerão aqui."
                      />
                    </div>
                  ) : (
                    <div className="divide-y">
                      {filteredConversations.map((conv) => (
                        <button
                          key={conv.patient_id}
                          onClick={() => setSelectedConversation(conv)}
                          className={cn(
                            "w-full p-4 text-left hover:bg-muted/50 transition-colors",
                            selectedConversation?.patient_id === conv.patient_id && "bg-muted"
                          )}
                        >
                          <div className="flex items-start gap-3">
                            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900 flex-shrink-0">
                              <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <span className="font-medium truncate">{conv.client_name}</span>
                                {conv.unread_count > 0 && (
                                  <Badge variant="default" className="bg-teal-600">
                                    {conv.unread_count}
                                  </Badge>
                                )}
                              </div>
                              <p className="text-sm text-muted-foreground truncate mt-0.5">
                                {conv.last_sender_type === "clinic" && "Você: "}
                                {conv.last_message}
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {formatMessageDate(conv.last_message_at)}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </CardContent>
            </Card>
          )}

          {/* Chat area */}
          {showChat && (
            <Card className="flex-1 flex flex-col min-w-0">
              {selectedConversation ? (
                <>
                  {/* Chat header */}
                  <CardHeader className="pb-3 border-b">
                    <div className="flex items-center gap-3">
                      {isMobile && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <ChevronLeft className="h-5 w-5" />
                        </Button>
                      )}
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-teal-100 dark:bg-teal-900">
                        <User className="h-5 w-5 text-teal-600 dark:text-teal-400" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{selectedConversation.client_name}</CardTitle>
                        <p className="text-xs text-muted-foreground">Paciente</p>
                      </div>
                    </div>
                  </CardHeader>

                  {/* Messages */}
                  <CardContent className="flex-1 overflow-y-auto p-4">
                    {isLoadingMessages ? (
                      <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                          <div key={i} className={cn("flex", i % 2 === 0 ? "justify-end" : "justify-start")}>
                            <Skeleton className="h-16 w-64 rounded-2xl" />
                          </div>
                        ))}
                      </div>
                    ) : messages.length === 0 ? (
                      <EmptyState
                        icon={MessageCircle}
                        title="Nenhuma mensagem"
                        description="Inicie a conversa enviando uma mensagem."
                      />
                    ) : (
                      <>
                        {messages.map((message) => {
                          const isClinic = message.sender_type === "clinic";
                          return (
                            <div
                              key={message.id}
                              className={cn("flex mb-3", isClinic ? "justify-end" : "justify-start")}
                            >
                              <div className="max-w-[80%]">
                                {!isClinic && (
                                  <div className="flex items-center gap-1.5 mb-1 ml-1">
                                    <User className="h-3 w-3 text-muted-foreground" />
                                    <span className="text-xs text-muted-foreground">
                                      {message.sender_name || "Paciente"}
                                    </span>
                                  </div>
                                )}
                                <div
                                  className={cn(
                                    "rounded-2xl px-4 py-2.5",
                                    isClinic
                                      ? "bg-teal-600 text-white rounded-br-md"
                                      : "bg-muted rounded-bl-md"
                                  )}
                                >
                                  <p className="text-sm whitespace-pre-wrap break-words">
                                    {message.content}
                                  </p>
                                </div>
                                <div
                                  className={cn(
                                    "text-[10px] text-muted-foreground mt-1",
                                    isClinic ? "text-right mr-1" : "ml-1"
                                  )}
                                >
                                  {formatMessageDate(message.created_at)}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        <div ref={messagesEndRef} />
                      </>
                    )}
                  </CardContent>

                  {/* Input */}
                  <div className="border-t p-4">
                    <div className="flex gap-2">
                      <Textarea
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite sua resposta..."
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
                  </div>
                </>
              ) : (
                <CardContent className="flex-1 flex items-center justify-center">
                  <EmptyState
                    icon={MessageCircle}
                    title="Selecione uma conversa"
                    description="Escolha um paciente na lista para ver as mensagens."
                  />
                </CardContent>
              )}
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
