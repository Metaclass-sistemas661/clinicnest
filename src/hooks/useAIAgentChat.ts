import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";

export interface AIChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  toolsUsed?: { name: string; input?: Record<string, unknown> }[];
  timestamp: Date;
}

interface SendResult {
  conversation_id: string;
  message: string;
  tools_used?: { name: string; input?: Record<string, unknown> }[];
  usage?: { input_tokens: number; output_tokens: number; rounds: number };
}

interface UseAIAgentChatOptions {
  functionName: "ai-agent-chat" | "ai-patient-chat";
  /** Override the supabase client (e.g. supabasePatient) */
  client?: typeof supabase;
}

export function useAIAgentChat(opts: UseAIAgentChatOptions = { functionName: "ai-agent-chat" }) {
  const client = opts.client ?? supabase;
  const [messages, setMessages] = useState<AIChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const conversationIdRef = useRef<string | null>(null);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isLoading) return;

      setError(null);

      // Add user message
      const userMsg: AIChatMessage = {
        id: crypto.randomUUID(),
        role: "user",
        content: text,
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, userMsg]);
      setIsLoading(true);

      try {
        const { data, error: fnError } = await client.functions.invoke(opts.functionName, {
          body: {
            conversation_id: conversationIdRef.current,
            message: text,
          },
        });

        if (fnError) throw fnError;

        const result = data as SendResult;

        // Store conversation id for continuity
        if (result.conversation_id) {
          conversationIdRef.current = result.conversation_id;
        }

        // Add assistant message
        const assistantMsg: AIChatMessage = {
          id: crypto.randomUUID(),
          role: "assistant",
          content: result.message,
          toolsUsed: result.tools_used,
          timestamp: new Date(),
        };
        setMessages((prev) => [...prev, assistantMsg]);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Erro ao conectar com o assistente. Tente novamente.";
        setError(message);
      } finally {
        setIsLoading(false);
      }
    },
    [isLoading, client, opts.functionName],
  );

  const clearChat = useCallback(() => {
    setMessages([]);
    conversationIdRef.current = null;
    setError(null);
  }, []);

  return {
    messages,
    isLoading,
    error,
    sendMessage,
    clearChat,
    conversationId: conversationIdRef.current,
  };
}
