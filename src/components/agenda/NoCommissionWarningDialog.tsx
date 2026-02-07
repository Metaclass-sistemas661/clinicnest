import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface NoCommissionWarningDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NoCommissionWarningDialog({
  open,
  onOpenChange,
}: NoCommissionWarningDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-warning/20 text-warning">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <div>
              <DialogTitle className="text-lg">Atenção!</DialogTitle>
              <DialogDescription>
                Entre em contato com o administrador para registrar a sua comissão ou salário fixo.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          O atendimento foi concluído normalmente. Assim que o admin configurar sua comissão na Equipe,
          você poderá acompanhar os valores na aba Minhas Comissões.
        </p>
        <Button
          className="w-full gradient-primary text-primary-foreground"
          onClick={() => onOpenChange(false)}
        >
          Entendi
        </Button>
      </DialogContent>
    </Dialog>
  );
}
