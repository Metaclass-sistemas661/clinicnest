import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { MessageSquareHeart, Loader2 } from "lucide-react";

const NPS_THRESHOLD = 10; // Mostrar após X atendimentos
const NPS_COOLDOWN_DAYS = 30; // Não mostrar novamente por X dias

export function FeedbackNPSDialog() {
  const { profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [score, setScore] = useState<number | null>(null);
  const [feedback, setFeedback] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!profile?.id || !profile?.tenant_id) return;

    const checkShouldShow = async () => {
      try {
        // Verificar última resposta NPS
        const lastNpsKey = `nps_last_shown_${profile.id}`;
        const lastShown = localStorage.getItem(lastNpsKey);
        if (lastShown) {
          const daysSince = (Date.now() - parseInt(lastShown)) / (1000 * 60 * 60 * 24);
          if (daysSince < NPS_COOLDOWN_DAYS) return;
        }

        // Contar atendimentos concluídos pelo profissional
        const { count } = await supabase
          .from("appointments")
          .select("*", { count: "exact", head: true })
          .eq("tenant_id", profile.tenant_id)
          .eq("professional_id", profile.id)
          .eq("status", "completed");

        if (count && count >= NPS_THRESHOLD && count % NPS_THRESHOLD === 0) {
          setOpen(true);
        }
      } catch (err) {
        logger.error("Error checking NPS eligibility:", err);
      }
    };

    // Delay para não mostrar imediatamente ao carregar
    const timer = setTimeout(checkShouldShow, 5000);
    return () => clearTimeout(timer);
  }, [profile?.id, profile?.tenant_id]);

  const handleSubmit = async () => {
    if (score === null) {
      toast.error("Por favor, selecione uma nota");
      return;
    }

    setIsSubmitting(true);
    try {
      // Salvar feedback (pode ser em uma tabela ou serviço externo)
      const { error } = await supabase.from("nps_responses").insert({
        tenant_id: profile?.tenant_id,
        user_id: profile?.id,
        score,
        feedback: feedback.trim() || null,
        created_at: new Date().toISOString(),
      });

      if (error) throw error;

      // Marcar como mostrado
      localStorage.setItem(`nps_last_shown_${profile?.id}`, Date.now().toString());

      toast.success("Obrigado pelo seu feedback!");
      setOpen(false);
    } catch (err) {
      logger.error("Error submitting NPS:", err);
      // Mesmo com erro, marcar como mostrado para não irritar o usuário
      localStorage.setItem(`nps_last_shown_${profile?.id}`, Date.now().toString());
      toast.success("Obrigado pelo seu feedback!");
      setOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    localStorage.setItem(`nps_last_shown_${profile?.id}`, Date.now().toString());
    setOpen(false);
  };

  const getScoreColor = (s: number) => {
    if (s <= 6) return "bg-red-500 hover:bg-red-600 text-white";
    if (s <= 8) return "bg-yellow-500 hover:bg-yellow-600 text-white";
    return "bg-green-500 hover:bg-green-600 text-white";
  };

  const getScoreLabel = () => {
    if (score === null) return "";
    if (score <= 6) return "Precisamos melhorar";
    if (score <= 8) return "Bom, mas pode melhorar";
    return "Excelente! Obrigado!";
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquareHeart className="h-5 w-5 text-primary" />
            Como está sua experiência?
          </DialogTitle>
          <DialogDescription>
            Sua opinião nos ajuda a melhorar o ClinicNest
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div>
            <p className="text-sm font-medium mb-3">
              De 0 a 10, qual a probabilidade de você recomendar o ClinicNest?
            </p>
            <div className="flex flex-wrap gap-2 justify-center">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((s) => (
                <button
                  key={s}
                  onClick={() => setScore(s)}
                  className={`w-10 h-10 rounded-lg font-semibold transition-all ${
                    score === s
                      ? getScoreColor(s)
                      : "bg-muted hover:bg-muted/80 border"
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
            <div className="flex justify-between text-xs text-muted-foreground mt-2 px-1">
              <span>Nada provável</span>
              <span>Muito provável</span>
            </div>
            {score !== null && (
              <p className="text-center text-sm mt-3 font-medium">{getScoreLabel()}</p>
            )}
          </div>

          <div className="space-y-2">
            <label className="text-sm font-medium">
              O que podemos melhorar? (opcional)
            </label>
            <Textarea
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              placeholder="Conte-nos sua experiência..."
              rows={3}
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="ghost" onClick={handleSkip}>
            Pular
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            variant="gradient"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Feedback"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
