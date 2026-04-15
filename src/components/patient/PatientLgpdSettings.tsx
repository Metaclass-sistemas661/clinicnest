import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Download,
  Trash2,
  Loader2,
  FileJson,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Scale,
} from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { toast } from "sonner";
import { logger } from "@/lib/logger";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ReauthDialog } from "@/components/patient/ReauthDialog";

export function PatientLgpdSettings() {
  const [isExporting, setIsExporting] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");
  const [deleteConfirmText, setDeleteConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);
  const [showReauthForExport, setShowReauthForExport] = useState(false);
  const [showReauthForDelete, setShowReauthForDelete] = useState(false);
  const [pendingDeletion, setPendingDeletion] = useState<{
    scheduled_for: string;
  } | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isLoadingStatus, setIsLoadingStatus] = useState(true);

  const checkDeletionStatus = useCallback(async () => {
    try {
      const { data, error } = await (apiPatient as any)
        .from("patient_deletion_requests")
        .select("scheduled_for")
        .eq("status", "pending")
        .order("requested_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!error && data) {
        setPendingDeletion({ scheduled_for: data.scheduled_for });
      } else {
        setPendingDeletion(null);
      }
    } catch {
      // ignore
    } finally {
      setIsLoadingStatus(false);
    }
  }, []);

  useEffect(() => {
    checkDeletionStatus();
  }, [checkDeletionStatus]);

  const handleExport = async () => {
    setIsExporting(true);
    try {
      const { data, error } = await (apiPatient as any).rpc("export_patient_data");

      if (error) {
        logger.error("[LGPD] export error:", error);
        toast.error("Erro ao exportar dados");
        return;
      }

      if (data?.error) {
        toast.error(data.error);
        return;
      }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `meus-dados-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      toast.success("Dados exportados com sucesso!", {
        description: "O arquivo JSON foi baixado.",
      });
    } catch (err) {
      logger.error("[LGPD] export error:", err);
      toast.error("Erro inesperado ao exportar dados");
    } finally {
      setIsExporting(false);
    }
  };

  const handleRequestDeletion = async () => {
    if (deleteConfirmText !== "EXCLUIR") {
      toast.error('Digite "EXCLUIR" para confirmar.');
      return;
    }

    setIsDeleting(true);
    try {
      const { data, error } = await (apiPatient as any).rpc(
        "request_patient_account_deletion",
        { p_reason: deleteReason.trim() || null }
      );

      if (error) {
        logger.error("[LGPD] deletion request error:", error);
        toast.error("Erro ao solicitar exclusão");
        return;
      }

      if (!data?.success) {
        toast.error(data?.error || "Erro ao processar solicitação");
        return;
      }

      toast.success("Solicitação registrada", {
        description: data.message,
        duration: 8000,
      });

      setPendingDeletion({ scheduled_for: data.scheduled_for });
      setShowDeleteDialog(false);
      setDeleteReason("");
      setDeleteConfirmText("");
    } catch (err) {
      logger.error("[LGPD] deletion request error:", err);
      toast.error("Erro inesperado");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelDeletion = async () => {
    setIsCancelling(true);
    try {
      const { data, error } = await (apiPatient as any).rpc(
        "cancel_patient_account_deletion"
      );

      if (error || !data?.success) {
        toast.error(data?.error || "Erro ao cancelar solicitação");
        return;
      }

      toast.success("Solicitação cancelada", {
        description: "Seus dados não serão excluídos.",
      });
      setPendingDeletion(null);
    } catch (err) {
      logger.error("[LGPD] cancel deletion error:", err);
      toast.error("Erro inesperado");
    } finally {
      setIsCancelling(false);
    }
  };

  return (
    <>
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Scale className="h-4 w-4 text-muted-foreground" />
            Meus dados (LGPD)
          </CardTitle>
          <CardDescription className="mt-1">
            Exerça seus direitos de acesso e exclusão de dados pessoais
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Export */}
          <div className="flex items-center justify-between gap-4 py-2">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 dark:bg-blue-950/40">
                <FileJson className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-sm font-medium">Exportar meus dados</p>
                <p className="text-xs text-muted-foreground">
                  Baixe todos os seus dados em formato JSON
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5"
              onClick={() => setShowReauthForExport(true)}
              disabled={isExporting}
            >
              {isExporting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Download className="h-4 w-4" />
              )}
              Exportar
            </Button>
          </div>

          <div className="border-t" />

          {/* Delete / Pending */}
          {isLoadingStatus ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : pendingDeletion ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/30 p-4">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1 space-y-2">
                  <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                    Exclusão agendada
                  </p>
                  <p className="text-xs text-amber-700/80 dark:text-amber-300/80">
                    Seus dados serão removidos em{" "}
                    <strong>
                      {new Date(pendingDeletion.scheduled_for).toLocaleDateString("pt-BR")}
                    </strong>
                    . Você pode cancelar antes dessa data.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 mt-1"
                    onClick={handleCancelDeletion}
                    disabled={isCancelling}
                  >
                    {isCancelling ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    Cancelar exclusão
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-4 py-2">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-red-50 dark:bg-red-950/40">
                  <Trash2 className="h-4 w-4 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium">Solicitar exclusão da conta</p>
                  <p className="text-xs text-muted-foreground">
                    Seus dados serão removidos após 30 dias
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-red-600 border-red-200 hover:bg-red-50"
                onClick={() => setShowReauthForDelete(true)}
              >
                <Trash2 className="h-4 w-4" />
                Solicitar
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Delete confirmation dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-700">
              <AlertTriangle className="h-5 w-5" />
              Solicitar exclusão de conta
            </DialogTitle>
            <DialogDescription>
              Após a confirmação, seus dados serão agendados para exclusão permanente em 30 dias.
              Você poderá cancelar a solicitação durante esse período.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="delete-reason" className="text-sm">
                Motivo (opcional)
              </Label>
              <Textarea
                id="delete-reason"
                placeholder="Por que deseja excluir sua conta?"
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                maxLength={500}
                className="resize-none"
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="delete-confirm" className="text-sm">
                Digite <strong>EXCLUIR</strong> para confirmar
              </Label>
              <Input
                id="delete-confirm"
                type="text"
                placeholder="EXCLUIR"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                autoComplete="off"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="ghost"
              onClick={() => {
                setShowDeleteDialog(false);
                setDeleteConfirmText("");
                setDeleteReason("");
              }}
            >
              Cancelar
            </Button>
            <Button
              variant="destructive"
              onClick={handleRequestDeletion}
              disabled={isDeleting || deleteConfirmText !== "EXCLUIR"}
            >
              {isDeleting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Confirmar exclusão
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Re-auth for export */}
      <ReauthDialog
        open={showReauthForExport}
        onOpenChange={setShowReauthForExport}
        title="Confirme para exportar dados"
        description="Para baixar seus dados pessoais, confirme sua senha."
        onSuccess={handleExport}
      />

      {/* Re-auth for deletion */}
      <ReauthDialog
        open={showReauthForDelete}
        onOpenChange={setShowReauthForDelete}
        title="Confirme para solicitar exclusão"
        description="Para solicitar a exclusão da sua conta, confirme sua senha."
        onSuccess={() => setShowDeleteDialog(true)}
      />
    </>
  );
}
