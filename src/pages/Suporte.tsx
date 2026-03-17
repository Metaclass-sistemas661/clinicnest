import { useCallback, useEffect, useMemo, useState } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { parsePlanKey, useSubscription } from "@/hooks/useSubscription";
import { LifeBuoy, Plus, Loader2, Mail, MessageCircle, Send } from "lucide-react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useNavigate } from "react-router-dom";

type Ticket = {
  id: string;
  tenant_id: string;
  created_by: string;
  subject: string;
  category: string;
  priority: string;
  status: string;
  channel: "email" | "whatsapp";
  last_message_at: string;
  created_at: string;
  updated_at: string;
};

type MessageRow = {
  id: string;
  ticket_id: string;
  tenant_id: string;
  sender: "user" | "support" | "system";
  message: string;
  metadata: Record<string, unknown>;
  created_by: string | null;
  created_at: string;
};

const categoryLabel: Record<string, string> = {
  general: "Geral",
  billing: "Cobrança",
  technical: "Técnico",
  feature_request: "Sugestão",
  bug: "Bug",
  security: "Segurança",
  lgpd: "LGPD",
};

const priorityLabel: Record<string, string> = {
  low: "Baixa",
  normal: "Normal",
  high: "Alta",
  urgent: "Urgente",
};

function buildWhatsAppUrl(phoneE164Digits: string, message: string) {
  const digits = phoneE164Digits.replace(/\D/g, "");
  const base = `https://wa.me/${digits}`;
  const text = encodeURIComponent(message);
  return `${base}?text=${text}`;
}

export default function Suporte() {
  const { profile, tenant } = useAuth();
  const { plan } = useSubscription();
  const navigate = useNavigate();

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [messages, setMessages] = useState<MessageRow[]>([]);

  const [isLoadingTickets, setIsLoadingTickets] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);

  const [isNewTicketOpen, setIsNewTicketOpen] = useState(false);
  const [isSubmittingTicket, setIsSubmittingTicket] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  const [whatsappEnabled, setWhatsappEnabled] = useState<boolean | null>(null);

  const [newTicket, setNewTicket] = useState({
    subject: "",
    category: "general",
    priority: "normal",
    message: "",
  });

  const [replyMessage, setReplyMessage] = useState("");

  const planTier = useMemo(() => {
    const parsed = parsePlanKey(plan ?? null);
    return parsed?.tier ?? "basic";
  }, [plan]);

  const allowWhatsappFallback = useMemo(() => planTier === "pro" || planTier === "premium", [planTier]);

  const tenantId = profile?.tenant_id ?? null;

  const allowWhatsapp = useMemo(() => {
    if (whatsappEnabled === null) return allowWhatsappFallback;
    return whatsappEnabled;
  }, [whatsappEnabled, allowWhatsappFallback]);

  const selectedTicket = useMemo(() => {
    if (!selectedTicketId) return null;
    return tickets.find((t) => t.id === selectedTicketId) ?? null;
  }, [tickets, selectedTicketId]);

  const fetchTickets = useCallback(async () => {
    if (!tenantId) return;
    setIsLoadingTickets(true);
    try {
      const { data, error } = await supabase
        .from("support_tickets")
        .select("id,tenant_id,created_by,subject,category,priority,status,channel,last_message_at,created_at,updated_at")
        .eq("tenant_id", tenantId)
        .order("last_message_at", { ascending: false });

      if (error) throw error;
      setTickets((data as Ticket[]) || []);
      if (!selectedTicketId && data && data.length > 0) {
        setSelectedTicketId(data[0].id);
      }
    } catch (err) {
      logger.error("Error fetching support tickets:", err);
      toast.error("Erro ao carregar suporte. Tente novamente.");
    } finally {
      setIsLoadingTickets(false);
    }
  }, [tenantId, selectedTicketId]);

  const fetchMessages = useCallback(async (ticketId: string) => {
    if (!tenantId) return;
    setIsLoadingMessages(true);
    try {
      const { data, error } = await supabase
        .from("support_messages")
        .select("id,ticket_id,tenant_id,sender,message,metadata,created_by,created_at")
        .eq("tenant_id", tenantId)
        .eq("ticket_id", ticketId)
        .order("created_at", { ascending: true });

      if (error) throw error;
      setMessages((data as MessageRow[]) || []);
    } catch (err) {
      logger.error("Error fetching support messages:", err);
      toast.error("Erro ao carregar conversa. Tente novamente.");
    } finally {
      setIsLoadingMessages(false);
    }
  }, [tenantId]);

  useEffect(() => {
    fetchTickets();
  }, [fetchTickets]);

  useEffect(() => {
    const run = async () => {
      if (!tenantId) return;
      try {
        const { data, error } = await supabase.rpc("tenant_has_feature", {
          p_tenant_id: tenantId,
          p_feature: "whatsapp_support",
        });
        if (error) throw error;
        setWhatsappEnabled(Boolean(data));
      } catch (err) {
        logger.warn("Failed to check whatsapp_support feature; using fallback.", err);
        setWhatsappEnabled(null);
      }
    };
    run();
  }, [tenantId]);

  useEffect(() => {
    if (selectedTicketId) {
      fetchMessages(selectedTicketId);
    } else {
      setMessages([]);
    }
  }, [selectedTicketId, fetchMessages]);

  const handleCreateTicket = async () => {
    if (!tenantId || !profile?.user_id) return;

    const subject = newTicket.subject.trim();
    const message = newTicket.message.trim();

    if (!subject || !message) {
      toast.error("Preencha assunto e mensagem.");
      return;
    }

    setIsSubmittingTicket(true);
    try {
      const context = {
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const channel: "email" | "whatsapp" = allowWhatsapp ? "whatsapp" : "email";

      const { data: ticketInserted, error: ticketError } = await supabase
        .from("support_tickets")
        .insert({
          tenant_id: tenantId,
          created_by: profile.user_id,
          subject,
          category: newTicket.category,
          priority: newTicket.priority,
          status: "open",
          channel,
        })
        .select("id")
        .single();

      if (ticketError) throw ticketError;

      const ticketId = String((ticketInserted as any)?.id || "");
      if (!ticketId) throw new Error("Ticket inválido");

      const { error: msgError } = await supabase.from("support_messages").insert({
        ticket_id: ticketId,
        tenant_id: tenantId,
        sender: "user",
        message,
        metadata: context,
        created_by: profile.user_id,
      });

      if (msgError) throw msgError;

      setIsNewTicketOpen(false);
      setNewTicket({ subject: "", category: "general", priority: "normal", message: "" });
      await fetchTickets();
      setSelectedTicketId(ticketId);
      toast.success("Ticket criado com sucesso!");

      if (!allowWhatsapp) {
        try {
          const { data, error } = await supabase.functions.invoke("send-support-ticket-email", {
            body: { ticketId },
          });
          if (error) throw error;
          if (!data?.success) throw new Error(data?.error || "Falha ao enviar notificação");

          const notificationSent = data?.notificationSent !== false;
          if (!notificationSent) {
            toast.success("Ticket criado", {
              description: "Notificação por e-mail temporariamente indisponível.",
            });
          }
        } catch (invokeErr) {
          logger.warn("Support email function failed:", invokeErr);
          toast.success("Ticket criado", {
            description: "Notificação por e-mail temporariamente indisponível.",
          });
        }
      }
    } catch (err) {
      logger.error("Error creating support ticket:", err);
      toast.error("Erro ao criar ticket. Tente novamente.");
    } finally {
      setIsSubmittingTicket(false);
    }
  };

  const handleSendReply = async () => {
    if (!tenantId || !profile?.user_id || !selectedTicketId) return;

    const msg = replyMessage.trim();
    if (!msg) {
      toast.error("Digite uma mensagem.");
      return;
    }

    setIsSendingMessage(true);
    try {
      const context = {
        url: typeof window !== "undefined" ? window.location.href : null,
        userAgent: typeof navigator !== "undefined" ? navigator.userAgent : null,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      };

      const { error } = await supabase.from("support_messages").insert({
        ticket_id: selectedTicketId,
        tenant_id: tenantId,
        sender: "user",
        message: msg,
        metadata: context,
        created_by: profile.user_id,
      });
      if (error) throw error;

      setReplyMessage("");
      await fetchMessages(selectedTicketId);
      await fetchTickets();
      if (!allowWhatsapp) {
        try {
          await supabase.functions.invoke("send-support-ticket-email", {
            body: { ticketId: selectedTicketId },
          });
        } catch {
          // ignore
        }
      }

      toast.success("Mensagem enviada");
    } catch (err) {
      logger.error("Error sending support message:", err);
      toast.error("Erro ao enviar mensagem. Tente novamente.");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const whatsappNumber = (import.meta as any).env?.VITE_SUPPORT_WHATSAPP_NUMBER as string | undefined;
  const whatsappText = useMemo(() => {
    if (!selectedTicket) return "";
    const tenantName = tenant?.name || "ClinicNest";
    const email = profile?.email || "";
    return [
      `Olá! Preciso de suporte no ClinicNest.`,
      `Tenant: ${tenantName}`,
      `Ticket: ${selectedTicket.id}`,
      `Assunto: ${selectedTicket.subject}`,
      email ? `Email: ${email}` : null,
    ].filter(Boolean).join("\n");
  }, [selectedTicket, tenant, profile]);

  const handleOpenWhatsApp = () => {
    if (!whatsappNumber) {
      toast.error("WhatsApp de suporte não configurado.");
      return;
    }
    if (!selectedTicket) {
      toast.error("Selecione um ticket.");
      return;
    }
    const url = buildWhatsAppUrl(whatsappNumber, whatsappText);
    window.open(url, "_blank");
  };

  return (
    <MainLayout
      title="Suporte"
      subtitle="Fale com a equipe e acompanhe seus chamados"
      actions={
        <div className="flex items-center gap-2 flex-wrap justify-end">
          <Tabs value="suporte" onValueChange={(v) => v === "ajuda" && navigate("/ajuda")}>
            <TabsList data-tour="help-support-tabs">
              <TabsTrigger value="ajuda" data-tour="help-tab-ajuda">Ajuda</TabsTrigger>
              <TabsTrigger value="suporte" data-tour="help-tab-suporte">Suporte</TabsTrigger>
            </TabsList>
          </Tabs>
          <Dialog open={isNewTicketOpen} onOpenChange={setIsNewTicketOpen}>
            <DialogTrigger asChild>
              <Button variant="gradient" data-tour="support-new-ticket">
                <Plus className="h-4 w-4 mr-2" />
                Novo ticket
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Novo ticket</DialogTitle>
                <DialogDescription>
                  Descreva o problema com o máximo de detalhes possível.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="grid gap-2">
                  <Label>Assunto</Label>
                  <Input
                    value={newTicket.subject}
                    onChange={(e) => setNewTicket((p) => ({ ...p, subject: e.target.value }))}
                    placeholder="Ex.: Não consigo gerar relatório"
                    data-tour="support-ticket-subject"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="grid gap-2">
                    <Label>Categoria</Label>
                    <Select value={newTicket.category} onValueChange={(v) => setNewTicket((p) => ({ ...p, category: v }))}>
                      <SelectTrigger data-tour="support-ticket-category">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(categoryLabel).map((k) => (
                          <SelectItem key={k} value={k}>
                            {categoryLabel[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label>Prioridade</Label>
                    <Select value={newTicket.priority} onValueChange={(v) => setNewTicket((p) => ({ ...p, priority: v }))}>
                      <SelectTrigger data-tour="support-ticket-priority">
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.keys(priorityLabel).map((k) => (
                          <SelectItem key={k} value={k}>
                            {priorityLabel[k]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="grid gap-2">
                  <Label>Mensagem</Label>
                  <Textarea
                    value={newTicket.message}
                    onChange={(e) => setNewTicket((p) => ({ ...p, message: e.target.value }))}
                    placeholder="Explique o que você tentou fazer e qual foi o erro..."
                    rows={6}
                    data-tour="support-ticket-message"
                  />
                </div>
                <div className="rounded-xl border p-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    <LifeBuoy className="h-4 w-4" />
                    {allowWhatsapp ? (
                      <span>Seu plano permite suporte por WhatsApp.</span>
                    ) : (
                      <span>Seu plano utiliza suporte por e-mail.</span>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setIsNewTicketOpen(false)}
                  disabled={isSubmittingTicket}
                  data-tour="support-cancel-new-ticket"
                >
                  Cancelar
                </Button>
                <Button onClick={handleCreateTicket} disabled={isSubmittingTicket} variant="gradient" data-tour="support-create-ticket">
                  {isSubmittingTicket ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  <span className="ml-2">Criar</span>
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      }
    >
      <div className="grid gap-6 lg:grid-cols-[360px_1fr]">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Tickets</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2" data-tour="support-tickets-list">
            {isLoadingTickets ? (
              <div className="space-y-2">
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
                <Skeleton className="h-14 w-full" />
              </div>
            ) : tickets.length === 0 ? (
              <div className="rounded-xl border p-4 text-sm text-muted-foreground">
                Nenhum ticket ainda. Clique em <strong>Novo ticket</strong> para começar.
              </div>
            ) : (
              <div className="space-y-2">
                {tickets.map((t) => {
                  const active = t.id === selectedTicketId;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTicketId(t.id)}
                      className={`w-full text-left rounded-xl border p-3 transition-colors ${active ? "bg-accent/50 border-primary/30" : "hover:bg-accent/30"}`}
                      data-tour={active ? "support-selected-ticket" : undefined}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{t.subject}</div>
                          <div className="text-xs text-muted-foreground">
                            {categoryLabel[t.category] ?? t.category}
                          </div>
                        </div>
                        <Badge variant={t.status === "open" ? "default" : "secondary"}>
                          {t.status}
                        </Badge>
                      </div>
                      <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                        <span>{priorityLabel[t.priority] ?? t.priority}</span>
                        <span>·</span>
                        <span>{t.channel === "whatsapp" ? "WhatsApp" : "E-mail"}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="text-base truncate">{selectedTicket?.subject ?? "Selecione um ticket"}</CardTitle>
                {selectedTicket && (
                  <div className="mt-1 text-xs text-muted-foreground">
                    {categoryLabel[selectedTicket.category] ?? selectedTicket.category} · {priorityLabel[selectedTicket.priority] ?? selectedTicket.priority}
                  </div>
                )}
              </div>
              {selectedTicket && allowWhatsapp && (
                <Button variant="outline" onClick={handleOpenWhatsApp} data-tour="support-whatsapp">
                  <MessageCircle className="h-4 w-4 mr-2" />
                  WhatsApp
                </Button>
              )}
              {selectedTicket && !allowWhatsapp && (
                <Button variant="outline" disabled data-tour="support-email-only">
                  <Mail className="h-4 w-4 mr-2" />
                  E-mail
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedTicket ? (
              <div className="rounded-xl border p-6 text-sm text-muted-foreground">
                Selecione um ticket na coluna da esquerda para ver a conversa.
              </div>
            ) : isLoadingMessages ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : (
              <>
                <div className="space-y-2">
                  {messages.length === 0 ? (
                    <div className="rounded-xl border p-4 text-sm text-muted-foreground">Sem mensagens.</div>
                  ) : (
                    messages.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-3 ${m.sender === "user" ? "bg-accent/30" : "bg-background"}`}
                      >
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-xs font-semibold text-muted-foreground">
                            {m.sender === "user" ? "Você" : m.sender === "support" ? "Suporte" : "Sistema"}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {new Date(m.created_at).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                          </div>
                        </div>
                        <div className="mt-2 text-sm whitespace-pre-wrap">{m.message}</div>
                      </div>
                    ))
                  )}
                </div>

                <div className="grid gap-2" data-tour="support-reply">
                  <Label>Responder</Label>
                  <Textarea
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    rows={4}
                    placeholder="Escreva uma atualização, dúvida ou detalhe adicional..."
                  />
                  <div className="flex justify-end">
                    <Button onClick={handleSendReply} disabled={isSendingMessage} variant="gradient" data-tour="support-send-reply">
                      {isSendingMessage ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                      <span className="ml-2">Enviar</span>
                    </Button>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </MainLayout>
  );
}
