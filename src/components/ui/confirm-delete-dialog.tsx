import * as React from "react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MODAL_SIZES } from "@/lib/modal-constants";
import { Trash2, AlertTriangle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ConfirmDeleteDialogProps {
  open: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
  itemName: string;
  itemType: string;
  warningText?: string;
  requireTypedConfirmation?: boolean;
  isDeleting?: boolean;
  confirmButtonText?: string;
  cancelButtonText?: string;
}

/**
 * ConfirmDeleteDialog — Componente padronizado para confirmação de exclusão.
 * 
 * Características:
 * - Ícone de lixeira vermelho para indicar ação destrutiva
 * - Texto explicativo sobre o que será excluído
 * - Opção de exigir digitação do nome do item para confirmar (exclusões críticas)
 * - Estado de loading durante a exclusão
 * - Tamanho padronizado (confirmation = sm:max-w-md)
 * 
 * @example
 * ```tsx
 * <ConfirmDeleteDialog
 *   open={deleteDialogOpen}
 *   onConfirm={handleDelete}
 *   onCancel={() => setDeleteDialogOpen(false)}
 *   itemName="João Silva"
 *   itemType="paciente"
 *   warningText="Todos os prontuários e documentos serão excluídos."
 *   requireTypedConfirmation={true}
 *   isDeleting={isDeleting}
 * />
 * ```
 */
export function ConfirmDeleteDialog({
  open,
  onConfirm,
  onCancel,
  itemName,
  itemType,
  warningText,
  requireTypedConfirmation = false,
  isDeleting = false,
  confirmButtonText = "Excluir",
  cancelButtonText = "Cancelar",
}: ConfirmDeleteDialogProps) {
  const [typedConfirmation, setTypedConfirmation] = React.useState("");
  
  const isConfirmationValid = !requireTypedConfirmation || 
    typedConfirmation.toLowerCase().trim() === itemName.toLowerCase().trim();

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen && !isDeleting) {
      setTypedConfirmation("");
      onCancel();
    }
  };

  const handleConfirm = async () => {
    if (!isConfirmationValid || isDeleting) return;
    await onConfirm();
    setTypedConfirmation("");
  };

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className={cn(MODAL_SIZES.confirmation, "gap-4")}>
        <AlertDialogHeader className="gap-3">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
            <Trash2 className="h-6 w-6 text-destructive" />
          </div>
          <AlertDialogTitle className="text-center">
            Excluir {itemType}?
          </AlertDialogTitle>
          <AlertDialogDescription className="text-center">
            Você está prestes a excluir <strong className="text-foreground">{itemName}</strong>.
            {warningText && (
              <>
                <br />
                <span className="mt-2 inline-flex items-center gap-1.5 text-amber-600 dark:text-amber-500">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  {warningText}
                </span>
              </>
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>

        {requireTypedConfirmation && (
          <div className="space-y-2 py-2">
            <Label htmlFor="confirm-delete" className="text-sm text-muted-foreground">
              Digite <strong className="text-foreground">{itemName}</strong> para confirmar:
            </Label>
            <Input
              id="confirm-delete"
              value={typedConfirmation}
              onChange={(e) => setTypedConfirmation(e.target.value)}
              placeholder={itemName}
              disabled={isDeleting}
              autoComplete="off"
              className={cn(
                "transition-colors",
                typedConfirmation && !isConfirmationValid && "border-destructive focus-visible:ring-destructive"
              )}
            />
          </div>
        )}

        <AlertDialogFooter className="gap-2 sm:gap-0">
          <AlertDialogCancel 
            onClick={onCancel} 
            disabled={isDeleting}
          >
            {cancelButtonText}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={!isConfirmationValid || isDeleting}
            className={cn(
              "bg-destructive text-destructive-foreground hover:bg-destructive/90",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-4 w-4" />
                {confirmButtonText}
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/**
 * Hook para gerenciar estado do ConfirmDeleteDialog
 */
export function useConfirmDelete<T = string>() {
  const [itemToDelete, setItemToDelete] = React.useState<T | null>(null);
  const [isDeleting, setIsDeleting] = React.useState(false);

  const openDeleteDialog = (item: T) => setItemToDelete(item);
  const closeDeleteDialog = () => {
    if (!isDeleting) {
      setItemToDelete(null);
    }
  };

  const confirmDelete = async (onDelete: (item: T) => Promise<void>) => {
    if (!itemToDelete) return;
    
    setIsDeleting(true);
    try {
      await onDelete(itemToDelete);
      setItemToDelete(null);
    } finally {
      setIsDeleting(false);
    }
  };

  return {
    itemToDelete,
    isDeleting,
    isOpen: itemToDelete !== null,
    openDeleteDialog,
    closeDeleteDialog,
    confirmDelete,
  };
}
