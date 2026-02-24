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
import { Star, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabasePatient } from "@/integrations/supabase/client";
import { logger } from "@/lib/logger";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface PendingRating {
  appointment_id: string;
  service_name: string;
  professional_name: string;
  completed_at: string;
}

interface RatingDialogProps {
  appointment: PendingRating;
  onClose: () => void;
  onSubmit: () => void;
}

function RatingDialog({ appointment, onClose, onSubmit }: RatingDialogProps) {
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating === 0) {
      toast.error("Selecione uma avaliação");
      return;
    }

    setIsSubmitting(true);
    try {
      const { data, error } = await (supabasePatient as any).rpc(
        "submit_appointment_rating",
        {
          p_appointment_id: appointment.appointment_id,
          p_rating: rating,
          p_comment: comment.trim() || null,
        }
      );
      if (error) throw error;

      const result = data as { success?: boolean; message?: string };
      if (result?.success) {
        toast.success(result.message || "Obrigado pela sua avaliação!");
        onSubmit();
      }
    } catch (err: any) {
      logger.error("Error submitting rating:", err);
      toast.error(err?.message || "Erro ao enviar avaliação");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Como foi seu atendimento?</DialogTitle>
          <DialogDescription>
            {appointment.service_name} com {appointment.professional_name}
            <br />
            <span className="text-xs">
              {format(new Date(appointment.completed_at), "dd 'de' MMMM", {
                locale: ptBR,
              })}
            </span>
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {/* Star rating */}
          <div className="flex justify-center gap-2 mb-4">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="p-1 transition-transform hover:scale-110"
              >
                <Star
                  className={cn(
                    "h-8 w-8 transition-colors",
                    (hoveredRating || rating) >= star
                      ? "fill-yellow-400 text-yellow-400"
                      : "text-muted-foreground"
                  )}
                />
              </button>
            ))}
          </div>

          {/* Rating label */}
          <p className="text-center text-sm text-muted-foreground mb-4">
            {rating === 1 && "Muito ruim"}
            {rating === 2 && "Ruim"}
            {rating === 3 && "Regular"}
            {rating === 4 && "Bom"}
            {rating === 5 && "Excelente"}
          </p>

          {/* Comment */}
          <Textarea
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            placeholder="Deixe um comentário (opcional)"
            rows={3}
          />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Agora não
          </Button>
          <Button
            onClick={() => void handleSubmit()}
            disabled={isSubmitting || rating === 0}
            className="bg-teal-600 hover:bg-teal-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Enviando...
              </>
            ) : (
              "Enviar Avaliação"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function useAppointmentRating() {
  const [pendingRatings, setPendingRatings] = useState<PendingRating[]>([]);
  const [currentRating, setCurrentRating] = useState<PendingRating | null>(null);

  useEffect(() => {
    const loadPendingRatings = async () => {
      try {
        const { data, error } = await (supabasePatient as any).rpc(
          "get_patient_pending_ratings"
        );
        if (error) throw error;
        const ratings = (data as PendingRating[]) || [];
        setPendingRatings(ratings);
        if (ratings.length > 0) {
          setCurrentRating(ratings[0]);
        }
      } catch (err) {
        logger.error("Error loading pending ratings:", err);
      }
    };
    void loadPendingRatings();
  }, []);

  const handleClose = () => {
    setCurrentRating(null);
    setPendingRatings((prev) => prev.slice(1));
  };

  const handleSubmit = () => {
    handleClose();
    // Check for achievements after rating
    void (supabasePatient as any).rpc("check_patient_achievements");
  };

  const RatingPrompt = currentRating ? (
    <RatingDialog
      appointment={currentRating}
      onClose={handleClose}
      onSubmit={handleSubmit}
    />
  ) : null;

  return { RatingPrompt, hasPendingRatings: pendingRatings.length > 0 };
}
