import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { MODAL_SIZES, type ModalSize } from "@/lib/modal-constants";
import { cn } from "@/lib/utils";

/**
 * SizedDialog — Wrapper sobre Dialog com tamanhos padronizados
 * 
 * @example
 * <SizedDialog open={open} onOpenChange={setOpen} size="form_short">
 *   <SizedDialogHeader>
 *     <SizedDialogTitle>Título</SizedDialogTitle>
 *   </SizedDialogHeader>
 *   <div>Conteúdo</div>
 *   <SizedDialogFooter>
 *     <Button>Salvar</Button>
 *   </SizedDialogFooter>
 * </SizedDialog>
 */

interface SizedDialogProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  size?: ModalSize;
  children: React.ReactNode;
  className?: string;
  hideCloseButton?: boolean;
}

export function SizedDialog({
  open,
  onOpenChange,
  size = "form_medium",
  children,
  className,
  hideCloseButton,
}: SizedDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(MODAL_SIZES[size], className)}
        hideCloseButton={hideCloseButton}
      >
        {children}
      </DialogContent>
    </Dialog>
  );
}

export const SizedDialogHeader = DialogHeader;
export const SizedDialogTitle = DialogTitle;
export const SizedDialogDescription = DialogDescription;
export const SizedDialogFooter = DialogFooter;

/**
 * Hook para determinar tamanho baseado em campos
 */
export function useModalSize(fieldCount: number): ModalSize {
  if (fieldCount === 0) return "confirmation";
  if (fieldCount <= 4) return "form_short";
  if (fieldCount <= 8) return "form_medium";
  if (fieldCount <= 12) return "form_long";
  return "wizard_preview";
}
