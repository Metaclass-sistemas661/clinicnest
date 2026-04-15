import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Lock } from "lucide-react";
import { apiPatient } from "@/integrations/gcp/client";
import { toast } from "sonner";

interface ReauthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  onSuccess: () => void;
}

/**
 * Re-authentication dialog for sensitive actions.
 * User must confirm their password before proceeding.
 */
export function ReauthDialog({
  open,
  onOpenChange,
  title = "Confirme sua identidade",
  description = "Para realizar esta ação, confirme sua senha atual.",
  onSuccess,
}: ReauthDialogProps) {
  const [password, setPassword] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  const handleVerify = async () => {
    if (!password.trim()) {
      toast.error("Digite sua senha");
      return;
    }

    setIsVerifying(true);
    try {
      // Get current user email
      const { data: { user } } = await apiPatient.auth.getUser();
      if (!user?.email) {
        toast.error("Sessão expirada. Faça login novamente.");
        onOpenChange(false);
        return;
      }

      // Re-authenticate by signing in with current credentials
      const { error } = await apiPatient.auth.signInWithPassword({
        email: user.email,
        password: password.trim(),
      });

      if (error) {
        toast.error("Senha incorreta");
        return;
      }

      setPassword("");
      onOpenChange(false);
      onSuccess();
    } catch {
      toast.error("Erro ao verificar senha");
    } finally {
      setIsVerifying(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && password.trim() && !isVerifying) {
      handleVerify();
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v) setPassword("");
        onOpenChange(v);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Lock className="h-5 w-5 text-amber-600" />
            {title}
          </DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-2">
          <div className="space-y-1.5">
            <Label htmlFor="reauth-password" className="text-sm">
              Senha atual
            </Label>
            <Input
              id="reauth-password"
              type="password"
              placeholder="Digite sua senha"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={handleKeyDown}
              autoComplete="current-password"
              autoFocus
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            variant="ghost"
            onClick={() => {
              setPassword("");
              onOpenChange(false);
            }}
            disabled={isVerifying}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleVerify}
            disabled={isVerifying || !password.trim()}
            className="bg-teal-600 hover:bg-teal-700 text-white"
          >
            {isVerifying ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Lock className="h-4 w-4 mr-2" />
            )}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
