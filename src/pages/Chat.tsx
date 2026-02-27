import { useState, useEffect, useRef, useCallback } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  MessageSquare,
  Send,
  Hash,
  User,
  Lock,
  Settings,
  Search,
  Paperclip,
  MoreVertical,
  Pencil,
  Trash2,
  X,
  FileIcon,
  ImageIcon,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { format, isToday, isYesterday } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChannelManager } from "@/components/chat/ChannelManager";
import { MentionInput, MentionInputRef } from "@/components/chat/MentionInput";
import { AttachmentUpload, Attachment } from "@/components/chat/AttachmentUpload";

interface Message {
  id: string;
  channel: string;
  channel_id: string | null;
  content: string;
  created_at: string;
  sender_id: string | null;
  sender_name: string;
  sender_initials: string;
  is_own: boolean;
  mentions: string[];
  attachments: Attachment[];
  edited_at: string | null;
  deleted_at: string | null;
}

interface Member {
  id: string;
  full_name: string;
  user_id: string;
}

interface ChatChannel {
  id: string;
  name: string;
  description: string | null;
  is_private: boolean;
  is_default: boolean;
}

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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Chat() {
  const { profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [activeChannel, setActiveChannel] = useState("geral");
  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [mentions, setMentions] = useState<string[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [showChannelManager, setShowChannelManager] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Message[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<MentionInputRef>(null);

  const myProfileId = profile?.id ?? null;

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void fetchMembers();
    void fetchChannels();
  }, [profile?.tenant_id]);

  useEffect(() => {
    if (!profile?.tenant_id) return;
    void fetchMessages(activeChannel, activeChannelId);
    void markAsRead();

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
            channel_id: string | null;
            content: string;
            created_at: string;
            sender_id: string | null;
            mentions: string[] | null;
            attachments: Attachment[] | null;
            edited_at: string | null;
            deleted_at: string | null;
          };
          if (row.channel !== activeChannel) return;
          if (row.deleted_at) return;
          const sender = members.find((m) => m.id === row.sender_id);
          const name = sender?.full_name ?? "Desconhecido";
          setMessages((prev) => [
            ...prev,
            {
              id: row.id,
              channel: row.channel,
              channel_id: row.channel_id,
              content: row.content,
              created_at: row.created_at,
              sender_id: row.sender_id,
              sender_name: name,
              sender_initials: getInitials(name),
              is_own: row.sender_id === myProfileId,
              mentions: row.mentions ?? [],
              attachments: row.attachments ?? [],
              edited_at: row.edited_at,
              deleted_at: row.deleted_at,
            },
          ]);
          setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
        }
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "internal_messages",
          filter: `tenant_id=eq.${profile.tenant_id}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            content: string;
            edited_at: string | null;
            deleted_at: string | null;
          };
          setMessages((prev) =>
            prev.map((m) =>
              m.id === row.id
                ? {
                    ...m,
                    content: row.content,
                    edited_at: row.edited_at,
                    deleted_at: row.deleted_at,
                  }
                : m
            ).filter((m) => !m.deleted_at)
          );
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [profile?.tenant_id, activeChannel, activeChannelId, members, myProfileId]);

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

  const fetchChannels = async () => {
    if (!profile?.tenant_id) return;
    try {
      const { data, error } = await supabase
        .from("chat_channels")
        .select("*")
        .eq("tenant_id", profile.tenant_id)
        .order("is_default", { ascending: false })
        .order("name");
      if (error) throw error;
      setChannels(data ?? []);
      
      const defaultChannel = data?.find((c) => c.is_default);
      if (defaultChannel) {
        setActiveChannel(defaultChannel.name.toLowerCase());
        setActiveChannelId(defaultChannel.id);
      }
    } catch (err) {
      logger.error("Chat fetchChannels:", err);
    }
  };

  const fetchMessages = async (channel: string, channelId: string | null) => {
    if (!profile?.tenant_id) return;
    setIsLoading(true);
    try {
      let query = supabase
        .from("internal_messages")
        .select("id, channel, channel_id, content, created_at, sender_id, mentions, attachments, edited_at, deleted_at, profiles(full_name)")
        .eq("tenant_id", profile.tenant_id)
        .is("deleted_at", null)
        .order("created_at", { ascending: true })
        .limit(100);

      if (channelId) {
        query = query.eq("channel_id", channelId);
      } else {
        query = query.eq("channel", channel);
      }

      const { data, error } = await query;
      if (error) throw error;
      const mapped: Message[] = (data ?? []).map((r: any) => {
        const name = r.profiles?.full_name ?? "Desconhecido";
        return {
          id: r.id,
          channel: r.channel,
          channel_id: r.channel_id,
          content: r.content,
          created_at: r.created_at,
          sender_id: r.sender_id,
          sender_name: name,
          sender_initials: getInitials(name),
          is_own: r.sender_id === myProfileId,
          mentions: r.mentions ?? [],
          attachments: r.attachments ?? [],
          edited_at: r.edited_at,
          deleted_at: r.deleted_at,
        };
      });
      setMessages(mapped);
    } catch (err) {
      logger.error("Chat fetchMessages:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const markAsRead = async () => {
    if (!profile?.tenant_id || !myProfileId) return;
    try {
      await supabase.rpc("mark_chat_as_read", {
        p_channel: activeChannel,
        p_channel_id: activeChannelId,
      });
    } catch (err) {
      logger.error("Chat markAsRead:", err);
    }
  };

  const sendMessage = async () => {
    const text = newMessage.trim();
    if ((!text && attachments.length === 0) || !profile?.tenant_id || !myProfileId || isSending) return;
    setIsSending(true);
    try {
      const mentionIds = mentions.length > 0 ? mentions : [];
      const { error } = await supabase.rpc("send_chat_message", {
        p_channel: activeChannel,
        p_channel_id: activeChannelId,
        p_content: text,
        p_mentions: mentionIds,
        p_attachments: attachments.length > 0 ? JSON.stringify(attachments) : "[]",
      });
      if (error) throw error;
      setNewMessage("");
      setMentions([]);
      setAttachments([]);
      inputRef.current?.focus();
    } catch (err) {
      logger.error("Chat sendMessage:", err);
      toast.error("Erro ao enviar mensagem");
    } finally {
      setIsSending(false);
    }
  };

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim() || !profile?.tenant_id) return;
    setIsSearching(true);
    try {
      const { data, error } = await supabase.rpc("search_chat_messages", {
        p_query: searchQuery.trim(),
        p_channel: null,
        p_limit: 50,
      });
      if (error) throw error;
      setSearchResults(
        (data ?? []).map((r: any) => ({
          id: r.id,
          channel: r.channel,
          channel_id: null,
          content: r.content,
          created_at: r.created_at,
          sender_id: r.sender_id,
          sender_name: r.sender_name ?? "Desconhecido",
          sender_initials: getInitials(r.sender_name ?? "D"),
          is_own: r.sender_id === myProfileId,
          mentions: [],
          attachments: [],
          edited_at: null,
          deleted_at: null,
        }))
      );
    } catch (err) {
      logger.error("Chat search:", err);
      toast.error("Erro na busca");
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery, profile?.tenant_id, myProfileId]);

  const handleEditMessage = async (messageId: string) => {
    if (!editContent.trim()) return;
    try {
      const { data, error } = await supabase.rpc("edit_chat_message", {
        p_message_id: messageId,
        p_content: editContent.trim(),
      });
      if (error) throw error;
      if (data) {
        toast.success("Mensagem editada");
        setEditingMessageId(null);
        setEditContent("");
      }
    } catch (err) {
      logger.error("Chat editMessage:", err);
      toast.error("Erro ao editar mensagem");
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!confirm("Excluir esta mensagem?")) return;
    try {
      const { data, error } = await supabase.rpc("delete_chat_message", {
        p_message_id: messageId,
      });
      if (error) throw error;
      if (data) {
        toast.success("Mensagem excluída");
      }
    } catch (err) {
      logger.error("Chat deleteMessage:", err);
      toast.error("Erro ao excluir mensagem");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void sendMessage();
    }
  };

  const handleChannelSelect = (channelName: string, channelId: string | null, isDM: boolean) => {
    setActiveChannel(isDM ? channelName : channelName.toLowerCase());
    setActiveChannelId(channelId);
    setShowSearch(false);
    setSearchResults([]);
  };

  const allChannels = [
    ...channels.map((c) => ({
      id: c.id,
      channelName: c.name.toLowerCase(),
      label: c.name,
      icon: c.is_private ? Lock : Hash,
      isPrivate: c.is_private,
      isDM: false,
    })),
    ...members
      .filter((m) => m.id !== myProfileId)
      .map((m) => ({
        id: null,
        channelName: `dm:${m.id}`,
        label: m.full_name,
        icon: User,
        isPrivate: false,
        isDM: true,
      })),
  ];

  const activeLabel =
    allChannels.find((c) => c.channelName === activeChannel)?.label ?? activeChannel;

  const renderContent = (content: string) => {
    return content.replace(/@\[([^\]]+)\]\([^)]+\)/g, (_, name) => `@${name}`);
  };

  return (
    <MainLayout title="Chat Interno" subtitle="Comunicação em tempo real com a equipe">
      <div className="flex h-[calc(100vh-10rem)] rounded-xl border border-border overflow-hidden bg-background">
        {/* Sidebar de canais */}
        <div className="w-56 flex-shrink-0 border-r border-border bg-muted/30 flex flex-col">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Canais</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => setShowChannelManager(true)}
            >
              <Settings className="h-3.5 w-3.5" />
            </Button>
          </div>
          <ScrollArea className="flex-1 p-2">
            {allChannels.map((ch) => {
              const Icon = ch.icon;
              return (
                <button
                  key={ch.channelName}
                  onClick={() => handleChannelSelect(ch.channelName, ch.id, ch.isDM)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-left transition-colors mb-0.5",
                    activeChannel === ch.channelName
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
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => setShowSearch(!showSearch)}
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>

          {/* Barra de busca */}
          {showSearch && (
            <div className="px-4 py-2 border-b border-border bg-muted/30">
              <div className="flex gap-2">
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar mensagens..."
                  className="flex-1"
                  onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                />
                <Button size="sm" onClick={handleSearch} disabled={isSearching}>
                  {isSearching ? "Buscando..." : "Buscar"}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => {
                    setShowSearch(false);
                    setSearchResults([]);
                    setSearchQuery("");
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 text-xs text-muted-foreground">
                  {searchResults.length} resultado(s) encontrado(s)
                </div>
              )}
            </div>
          )}

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
            ) : (showSearch && searchResults.length > 0 ? searchResults : messages).length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full py-16 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/40 mb-3" />
                <p className="text-muted-foreground text-sm">
                  {showSearch ? "Nenhum resultado encontrado." : "Nenhuma mensagem ainda."}
                </p>
                {!showSearch && (
                  <p className="text-muted-foreground/60 text-xs mt-1">Seja o primeiro a enviar uma mensagem!</p>
                )}
              </div>
            ) : (
              <div className="space-y-1">
                {(showSearch && searchResults.length > 0 ? searchResults : messages).map((msg, idx, arr) => {
                  const showHeader = idx === 0 || arr[idx - 1].sender_id !== msg.sender_id;
                  const isEditing = editingMessageId === msg.id;

                  return (
                    <div
                      key={msg.id}
                      className={cn(
                        "flex items-start gap-3 group",
                        msg.is_own ? "flex-row-reverse" : "flex-row",
                        showHeader ? "mt-4" : "mt-0.5"
                      )}
                    >
                      {showHeader && (
                        <Avatar className="h-8 w-8 flex-shrink-0">
                          <AvatarFallback
                            className={cn("text-xs", msg.is_own ? "bg-primary text-primary-foreground" : "bg-muted")}
                          >
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
                            {msg.edited_at && <span className="text-xs text-muted-foreground">(editado)</span>}
                          </div>
                        )}
                        <div className="relative">
                          {isEditing ? (
                            <div className="flex gap-2">
                              <Input
                                value={editContent}
                                onChange={(e) => setEditContent(e.target.value)}
                                className="min-w-[200px]"
                                autoFocus
                              />
                              <Button size="sm" onClick={() => handleEditMessage(msg.id)}>
                                Salvar
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingMessageId(null);
                                  setEditContent("");
                                }}
                              >
                                Cancelar
                              </Button>
                            </div>
                          ) : (
                            <>
                              <div
                                className={cn(
                                  "px-3 py-2 rounded-xl text-sm leading-relaxed",
                                  msg.is_own
                                    ? "bg-primary text-primary-foreground rounded-tr-none"
                                    : "bg-muted text-foreground rounded-tl-none"
                                )}
                              >
                                {renderContent(msg.content)}
                              </div>
                              {msg.attachments && msg.attachments.length > 0 && (
                                <div className="mt-1 space-y-1">
                                  {msg.attachments.map((att, i) => (
                                    <a
                                      key={i}
                                      href={att.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-2 text-xs text-primary hover:underline"
                                    >
                                      {att.type?.startsWith("image/") ? (
                                        <ImageIcon className="h-3 w-3" />
                                      ) : (
                                        <FileIcon className="h-3 w-3" />
                                      )}
                                      {att.name} ({formatFileSize(att.size)})
                                    </a>
                                  ))}
                                </div>
                              )}
                              {msg.is_own && (
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="absolute -right-8 top-0 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                                    >
                                      <MoreVertical className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem
                                      onClick={() => {
                                        setEditingMessageId(msg.id);
                                        setEditContent(msg.content);
                                      }}
                                    >
                                      <Pencil className="h-3.5 w-3.5 mr-2" />
                                      Editar
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => handleDeleteMessage(msg.id)}
                                    >
                                      <Trash2 className="h-3.5 w-3.5 mr-2" />
                                      Excluir
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              )}
                            </>
                          )}
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
            <div className="flex gap-2 items-end">
              <AttachmentUpload
                attachments={attachments}
                onAttachmentsChange={setAttachments}
                disabled={isSending}
              />
              <div className="flex-1">
                <MentionInput
                  ref={inputRef}
                  value={newMessage}
                  onChange={setNewMessage}
                  onMentionsChange={setMentions}
                  members={members}
                  placeholder={`Mensagem em #${activeLabel}... (use @ para mencionar)`}
                  disabled={isSending}
                  onKeyDown={handleKeyDown}
                  className="min-h-[40px]"
                />
              </div>
              <Button
                size="icon"
                onClick={() => void sendMessage()}
                disabled={(!newMessage.trim() && attachments.length === 0) || isSending}
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              Enter para enviar · @ para mencionar · Shift+Enter para nova linha
            </p>
          </div>
        </div>
      </div>

      <ChannelManager
        open={showChannelManager}
        onOpenChange={setShowChannelManager}
        onChannelCreated={fetchChannels}
      />
    </MainLayout>
  );
}
