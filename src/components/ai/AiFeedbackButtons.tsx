import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ThumbsUp, ThumbsDown, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface Props {
  interactionId?: string;
  className?: string;
  size?: "sm" | "xs";
}

type Feedback = "accepted" | "rejected" | null;

export function AiFeedbackButtons({ interactionId, className, size = "xs" }: Props) {
  const [feedback, setFeedback] = useState<Feedback>(null);
  const [submitted, setSubmitted] = useState(false);

  const submitFeedback = async (value: "accepted" | "rejected") => {
    if (!interactionId || submitted) return;

    setFeedback(value);
    setSubmitted(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const url = `${import.meta.env.VITE_SUPABASE_URL || ""}/rest/v1/rpc/submit_ai_feedback`;
      fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY || "",
        },
        body: JSON.stringify({
          p_interaction_id: interactionId,
          p_feedback: value,
        }),
      }).catch(() => {});
    } catch {
      // silently fail
    }
  };

  if (submitted) {
    return (
      <div className={cn("flex items-center gap-1 text-muted-foreground", className)}>
        <Check className="h-3 w-3 text-emerald-500" />
        <span className="text-[10px]">
          {feedback === "accepted" ? "Útil" : "Não útil"}
        </span>
      </div>
    );
  }

  const iconSize = size === "xs" ? "h-3 w-3" : "h-3.5 w-3.5";
  const btnSize = size === "xs" ? "h-5 w-5" : "h-6 w-6";

  return (
    <div className={cn("flex items-center gap-0.5", className)}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(btnSize, "p-0 hover:text-emerald-600 hover:bg-emerald-50")}
        title="Sugestão útil"
        onClick={() => submitFeedback("accepted")}
      >
        <ThumbsUp className={iconSize} />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className={cn(btnSize, "p-0 hover:text-red-600 hover:bg-red-50")}
        title="Sugestão não útil"
        onClick={() => submitFeedback("rejected")}
      >
        <ThumbsDown className={iconSize} />
      </Button>
    </div>
  );
}
