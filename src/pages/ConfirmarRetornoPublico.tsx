import { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Calendar,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertTriangle,
  User,
  Stethoscope,
  Building2,
  Clock,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { formatInAppTz } from "@/lib/date";
import { logger } from "@/lib/logger";
import { toast } from "sonner";

interface ReturnData {
  valid: boolean;
  return_id: string | null;
  tenant_id: string | null;
  patient_id: string | null;
  client_name: string | null;
  professional_name: string | null;
  return_date: string | null;
  reason: string | null;
  status: string | null;
  clinic_name: string | null;
}

type PageState = "loading" | "valid" | "invalid" | "confirmed" | "cancelled";

export default function ConfirmarRetornoPublico() {
  const { token } = useParams<{ token: string }>();
  const [pageState, setPageState] = useState<PageState>("loading");
  const [returnData, setReturnData] = useState<ReturnData | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCancelForm, setShowCancelForm] = useState(false);
  const [cancelReason, setCancelReason] = useState("");

  useEffect(() => {
    if (!token) {
      setPageState("invalid");
      return;
    }

    const validateToken = async () => {
      try {
        const { data, error } = await supabase.rpc("validate_return_token", {
          p_token: token,
        });

        if (error) throw error;

        const result = data?.[0] as ReturnData | undefined;
        
        if (!result?.valid) {
          setPageState("invalid");
          return;
        }

        setReturnData(result);
        
        if (result.status === "scheduled") {
          setPageState("confirmed");
        } else if (result.status === "cancelled") {
          setPageState("cancelled");
        } else {
          setPageState("valid");
        }
      } catch (e) {
        logger.error("Error validating token:", e);
        setPageState("invalid");
      }
    };

    validateToken();
  }, [token]);

  const handleConfirm = async () => {
    if (!token) return;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("confirm_return_via_token", {
        p_token: token,
      });

      if (error) throw error;

      if (data) {
        setPageState("confirmed");
        toast.success("Retorno confirmado com sucesso!");
      } else {
        toast.error("Não foi possível confirmar o retorno");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao confirmar retorno");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancel = async () => {
    if (!token) return;
    setIsSubmitting(true);

    try {
      const { data, error } = await supabase.rpc("cancel_return_via_token", {
        p_token: token,
        p_reason: cancelReason || null,
      });

      if (error) throw error;

      if (data) {
        setPageState("cancelled");
        toast.success("Retorno cancelado");
      } else {
        toast.error("Não foi possível cancelar o retorno");
      }
    } catch (e: any) {
      toast.error(e.message || "Erro ao cancelar retorno");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (pageState === "loading") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-12 w-12 animate-spin text-teal-600 mb-4" />
            <p className="text-muted-foreground">Carregando...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "invalid") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 to-orange-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-red-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-red-100 mb-4">
              <AlertTriangle className="h-8 w-8 text-red-600" />
            </div>
            <h2 className="text-xl font-bold text-red-900 mb-2">Link Inválido ou Expirado</h2>
            <p className="text-muted-foreground">
              Este link de confirmação não é mais válido. Por favor, entre em contato com a clínica para mais informações.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "confirmed") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 to-teal-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-emerald-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 mb-4">
              <CheckCircle2 className="h-8 w-8 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-emerald-900 mb-2">Retorno Confirmado!</h2>
            <p className="text-muted-foreground mb-4">
              Seu retorno foi confirmado com sucesso. Aguardamos você na data agendada.
            </p>
            {returnData && (
              <div className="bg-emerald-50 rounded-lg p-4 w-full text-left">
                <div className="flex items-center gap-2 text-sm text-emerald-800">
                  <Calendar className="h-4 w-4" />
                  <span className="font-medium">
                    {returnData.return_date && formatInAppTz(returnData.return_date, "dd 'de' MMMM 'de' yyyy")}
                  </span>
                </div>
                {returnData.clinic_name && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 mt-2">
                    <Building2 className="h-4 w-4" />
                    <span>{returnData.clinic_name}</span>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (pageState === "cancelled") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-gray-50 flex items-center justify-center p-4">
        <Card className="w-full max-w-md border-slate-200">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 mb-4">
              <XCircle className="h-8 w-8 text-slate-600" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">Retorno Cancelado</h2>
            <p className="text-muted-foreground">
              Seu retorno foi cancelado. Se precisar reagendar, entre em contato com a clínica.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="flex justify-center mb-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-teal-100">
              <Calendar className="h-8 w-8 text-teal-600" />
            </div>
          </div>
          <CardTitle className="text-xl">Confirmação de Retorno</CardTitle>
          <CardDescription>
            {returnData?.clinic_name || "Sua Clínica"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Return Details */}
          <div className="bg-muted/50 rounded-lg p-4 space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Paciente</p>
                <p className="font-medium">{returnData?.client_name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-5 w-5 text-muted-foreground" />
              <div>
                <p className="text-sm text-muted-foreground">Data do Retorno</p>
                <p className="font-medium">
                  {returnData?.return_date && formatInAppTz(returnData.return_date, "EEEE, dd 'de' MMMM 'de' yyyy")}
                </p>
              </div>
            </div>

            {returnData?.professional_name && (
              <div className="flex items-center gap-3">
                <Stethoscope className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Profissional</p>
                  <p className="font-medium">{returnData.professional_name}</p>
                </div>
              </div>
            )}

            {returnData?.reason && (
              <div className="flex items-start gap-3">
                <Clock className="h-5 w-5 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm text-muted-foreground">Motivo</p>
                  <p className="font-medium">{returnData.reason}</p>
                </div>
              </div>
            )}
          </div>

          {/* Cancel Form */}
          {showCancelForm ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="cancelReason">Motivo do cancelamento (opcional)</Label>
                <Textarea
                  id="cancelReason"
                  placeholder="Informe o motivo do cancelamento..."
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  rows={3}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowCancelForm(false)}
                  disabled={isSubmitting}
                >
                  Voltar
                </Button>
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={handleCancel}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  ) : (
                    <XCircle className="h-4 w-4 mr-2" />
                  )}
                  Confirmar Cancelamento
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              <Button
                size="lg"
                className="w-full bg-emerald-600 hover:bg-emerald-700"
                onClick={handleConfirm}
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                )}
                Confirmar Retorno
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowCancelForm(true)}
                disabled={isSubmitting}
              >
                <XCircle className="h-4 w-4 mr-2" />
                Não Poderei Comparecer
              </Button>
            </div>
          )}

          <p className="text-xs text-center text-muted-foreground">
            Em caso de dúvidas, entre em contato com a clínica.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
